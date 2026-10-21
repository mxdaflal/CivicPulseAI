import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { serverSupabase } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/report-schema";
import { analyzeReport } from "@/lib/ai-analysis";
import { sameOrigin } from "@/lib/security";
import { boundedBody, json } from "@/lib/http";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Invalid request origin" }, 403);
  try {
    const parsed = reportSchema.safeParse(await boundedBody(request));
    if (!parsed.success)
      return json({ error: parsed.error.issues[0].message }, 400);
    const payload = parsed.data;
    let client = await serverSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    let bucket: string | null = null;
    if (!user) {
      if (payload.photoPath)
        return json({ error: "Sign in to attach private evidence" }, 400);
      const secret = process.env.TURNSTILE_SECRET_KEY;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!secret || !serviceKey || !payload.captchaToken)
        return json(
          {
            error:
              "Anonymous text reporting requires the configured anti-abuse check. Please sign in.",
          },
          403,
        );
      const result = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: new URLSearchParams({ secret, response: payload.captchaToken }),
          signal: AbortSignal.timeout(8000),
        },
      );
      const verification = await result.json();
      if (
        !result.ok ||
        !verification.success ||
        verification.hostname !== new URL(request.url).hostname ||
        verification.action !== "report"
      )
        return json({ error: "Anti-abuse check failed" }, 403);
      // Require a hosting-specific trusted header. Never trust an arbitrary client-supplied X-Forwarded-For chain.
      const header = process.env.CIVICPULSE_TRUSTED_IP_HEADER;
      const address = header && request.headers.get(header);
      if (!address || !process.env.REPORT_RATE_LIMIT_SECRET)
        return json(
          { error: "Anonymous reporting is not enabled on this host" },
          503,
        );
      bucket = createHmac("sha256", process.env.REPORT_RATE_LIMIT_SECRET)
        .update(address)
        .digest("hex");
      client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    const analysis = analyzeReport(
      payload.title,
      payload.description,
      payload.locationText,
      payload.category,
    );
    const { data, error } = await client.rpc("submit_civic_report", {
      payload,
      analysis,
      request_key: payload.requestKey,
      anonymous_bucket: bucket,
    });
    if (error)
      return json(
        {
          error: error.message.includes("Rate limit")
            ? error.message
            : "Report could not be saved. Retry with the same form; no success has been recorded.",
        },
        error.message.includes("Rate limit") ? 429 : 400,
      );
    return json(data, 201);
  } catch {
    return json(
      { error: "Unable to submit. Check your connection and form fields." },
      400,
    );
  }
}
