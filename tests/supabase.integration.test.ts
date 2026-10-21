import { loadEnvConfig } from "@next/env";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { analyzeReport } from "../lib/ai-analysis";
loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
test(
  "real local Supabase: drainage lifecycle, Realtime and private evidence",
  {
    skip:
      !url || !anon || !service
        ? "Requires a complete local Supabase stack and its actual keys"
        : false,
    timeout: 60000,
  },
  async () => {
    assert.ok(
      ["127.0.0.1", "localhost"].includes(new URL(url!).hostname),
      "This test creates data and may run only on a local throwaway Supabase stack",
    );
    const admin = createClient(url!, service!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ids: string[] = [];
    const clients: SupabaseClient[] = [];
    let dept: string | undefined,
      reportId: string | undefined,
      incidentId: string | undefined,
      path: string | undefined;
    try {
      for (const role of [
        "citizen",
        "citizen",
        "verifier",
        "manager",
        "operator",
      ]) {
        const email = `demo-${randomUUID()}@example.invalid`,
          password = randomBytes(24).toString("base64url");
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: `Demo ${role}`, role: "admin" },
        });
        assert.ifError(error);
        assert.ok(data.user);
        ids.push(data.user.id);
        const profile = await admin
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        assert.equal(profile.data?.role, "citizen");
        if (role !== "citizen") {
          const changed = await admin
            .from("profiles")
            .update({ role })
            .eq("id", data.user.id);
          assert.ifError(changed.error);
        }
        const c = createClient(url!, anon!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const signed = await c.auth.signInWithPassword({ email, password });
        assert.ifError(signed.error);
        clients.push(c);
      }
      const [citizen, other, verifier, manager, operator] = clients;
      const department = await admin
        .from("departments")
        .insert({
          name: `Demo Drainage Team ${randomUUID()}`,
          description: "Isolated automated test department",
        })
        .select()
        .single();
      assert.ifError(department.error);
      dept = String(department.data.id);
      assert.ifError(
        (
          await admin
            .from("profiles")
            .update({ department_id: dept })
            .eq("id", ids[4])
        ).error,
      );
      let received = false,
        privateReceived = false;
      const channel = verifier
        .channel(`test-${randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "reports" },
          () => {
            received = true;
          },
        );
      const privateChannel = other
        .channel(`test-${randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "reports" },
          () => {
            privateReceived = true;
          },
        );
      await Promise.all(
        [channel, privateChannel].map(
          (c) =>
            new Promise<void>((resolve, reject) => {
              const timer = setTimeout(
                () => reject(new Error("Realtime subscription timed out")),
                10000,
              );
              c.subscribe((s) => {
                if (s === "SUBSCRIBED") {
                  clearTimeout(timer);
                  resolve();
                }
                if (s === "CHANNEL_ERROR") {
                  clearTimeout(timer);
                  reject(new Error("Realtime unavailable"));
                }
              });
            }),
        ),
      );
      const payload = {
        category: "Drainage Problem",
        title: "Blocked drain beside demo library",
        description:
          "The blocked drainage channel is flooding a public walkway after rain.",
        locationText: "Demo library public entrance",
        latitude: 10.8,
        longitude: 78.7,
      };
      const submitted = await citizen.rpc("submit_civic_report", {
        payload,
        analysis: analyzeReport(
          payload.title,
          payload.description,
          payload.locationText,
          payload.category,
        ),
        request_key: randomUUID(),
      });
      assert.ifError(submitted.error);
      reportId = String(submitted.data.report_id);
      for (let i = 0; i < 30 && !received; i++)
        await new Promise((r) => setTimeout(r, 200));
      assert.equal(received, true, "authorised staff receives stored report");
      assert.equal(
        privateReceived,
        false,
        "other citizen receives no private report",
      );
      const hidden = await other.from("reports").select("*").eq("id", reportId);
      assert.equal(hidden.data?.length ?? 0, 0);
      const noKey = await other.rpc("track_civic_report", {
        reference: submitted.data.tracking_id,
        access_secret: "",
      });
      assert.equal(noKey.data, null);
      const verified = await verifier.rpc("review_civic_report", {
        report_id: reportId,
        decision: "verified",
      });
      assert.ifError(verified.error);
      incidentId = String(verified.data);
      assert.ifError(
        (
          await manager.rpc("update_civic_incident", {
            target: incidentId,
            next_status: "assigned",
            department: dept,
            note: "Assigned to isolated demo team",
          })
        ).error,
      );
      assert.ifError(
        (
          await operator.rpc("update_civic_incident", {
            target: incidentId,
            next_status: "in_progress",
            note: "Demo investigation began",
          })
        ).error,
      );
      let tracked = await citizen.rpc("track_civic_report", {
        reference: submitted.data.tracking_id,
        access_secret: "",
      });
      assert.equal(tracked.data.incident_status, "in_progress");
      assert.ifError(
        (
          await operator.rpc("update_civic_incident", {
            target: incidentId,
            next_status: "resolved",
            note: "Demo workflow resolution, no real repair claim",
          })
        ).error,
      );
      tracked = await other.rpc("track_civic_report", {
        reference: submitted.data.tracking_id,
        access_secret: submitted.data.tracking_secret,
      });
      assert.equal(tracked.data.incident_status, "resolved");
      assert.equal(tracked.data.events.length, 4);
      assert.equal("notes" in tracked.data.events[0], false);
      // Actual Storage HTTP access, not just table visibility.
      path = `${ids[0]}/${randomUUID()}.png`;
      const pixel = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
        "base64",
      );
      assert.ifError(
        (
          await citizen.storage
            .from("evidence")
            .upload(path, pixel, { contentType: "image/png" })
        ).error,
      );
      assert.ok(
        (await other.storage.from("evidence").download(path)).error,
        "another citizen cannot download private evidence",
      );
      const publicClient = createClient(url!, anon!, {
        auth: { persistSession: false },
      });
      assert.ok(
        (await publicClient.storage.from("evidence").download(path)).error,
        "anonymous evidence denied",
      );
      assert.ifError(
        (await citizen.storage.from("evidence").download(path)).error,
      );
      const escalation = await other
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", ids[1]);
      assert.ok(escalation.error);
      const mutation = await other
        .from("reports")
        .update({ status: "verified" })
        .eq("id", reportId);
      assert.ok(mutation.error);
      const auditDelete = await verifier
        .from("incident_events")
        .delete()
        .eq("incident_id", incidentId);
      assert.ok(auditDelete.error);
      for (const c of clients) await c.removeAllChannels();
    } finally {
      // Service-role cleanup is confined by the local-host assertion above.
      if (path) await admin.storage.from("evidence").remove([path]);
      if (incidentId)
        await admin.from("incidents").delete().eq("id", incidentId);
      if (reportId) await admin.from("reports").delete().eq("id", reportId);
      for (const id of ids) await admin.auth.admin.deleteUser(id);
      if (dept) await admin.from("departments").delete().eq("id", dept);
      for (const c of clients) {
        await c.removeAllChannels();
        await c.auth.signOut();
      }
    }
  },
);
