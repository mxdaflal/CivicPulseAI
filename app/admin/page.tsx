"use client";
import { useCallback, useEffect, useState } from "react";
import {
  supabase,
  type Profile,
  type Category,
  type Department,
} from "@/lib/supabase-client";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export default function AdminPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [departments, setDepartments] = useState<Department[]>([]),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [page, setPage] = useState(0);
  const load = useCallback(async () => {
    const results = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * 25, page * 25 + 24),
      supabase.from("categories").select("*"),
      supabase.from("departments").select("*"),
    ]);
    if (results.some((r) => r.error)) {
      setError("Administration data could not be loaded.");
      return;
    }
    setUsers(results[0].data as unknown as Profile[]);
    setCategories(results[1].data as unknown as Category[]);
    setDepartments(results[2].data as unknown as Department[]);
  }, [page]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (profile?.role === "admin") void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, profile]);
  if (profile?.role !== "admin")
    return <p className="p-8">Administrator access required.</p>;
  return (
    <div className="max-w-5xl mx-auto p-4 py-10">
      <h1 className="text-3xl font-bold">Administration</h1>
      <p className="mt-3 text-muted-foreground">
        Role changes are checked in the database and recorded in a protected
        audit log. You cannot change your own authority here.
      </p>
      {error && <p role="alert">{error}</p>}
      <h2 className="text-xl font-bold mt-8 mb-4">Authorised accounts</h2>
      <div className="space-y-3">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap gap-3 p-4 border rounded-xl"
          >
            <div className="flex-1 min-w-40">
              <p>{u.full_name}</p>
              <p className="font-mono text-xs break-all">{u.id}</p>
            </div>
            <select
              aria-label={`Role for ${u.full_name}`}
              className="border bg-background rounded p-2"
              disabled={u.id === profile.id}
              value={u.role}
              onChange={async (e) => {
                const { error } = await supabase.rpc("set_civic_role", {
                  target: u.id,
                  new_role: e.target.value,
                  department: u.department_id,
                });
                if (error) toast.error(error.message);
                else {
                  toast.success("Role change recorded");
                  void load();
                }
              }}
            >
              {["citizen", "verifier", "operator", "manager", "admin"].map(
                (r) => (
                  <option key={r}>{r}</option>
                ),
              )}
            </select>
            <select
              aria-label={`Department for ${u.full_name}`}
              className="border bg-background rounded p-2"
              disabled={u.id === profile.id}
              value={u.department_id ?? ""}
              onChange={async (e) => {
                const { error } = await supabase.rpc("set_civic_role", {
                  target: u.id,
                  new_role: u.role,
                  department: e.target.value || null,
                });
                if (error) toast.error(error.message);
                else void load();
              }}
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex gap-4 my-5">
        <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <span>Page {page + 1}</span>
        <Button disabled={users.length < 25} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
      <h2 className="text-xl font-bold mt-8 mb-4">Pilot departments</h2>
      <ul>
        {departments.map((d) => (
          <li key={d.id}>{d.name}</li>
        ))}
      </ul>
      <form
        className="flex gap-3 mt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("departments").insert({
            name: name.trim(),
            description: "Pilot department — no official integration implied",
          });
          if (error) toast.error(error.message);
          else {
            setName("");
            void load();
          }
        }}
      >
        <Input
          aria-label="Department name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={3}
          maxLength={100}
          required
        />
        <Button type="submit">Add department</Button>
      </form>
      <h2 className="text-xl font-bold mt-8 mb-4">Category response targets</h2>
      {categories.map((c) => (
        <form
          key={c.id}
          className="flex gap-3 items-center py-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const { error } = await supabase
              .from("categories")
              .update({ default_sla_hours: Number(form.get("hours")) })
              .eq("id", c.id);
            if (error) toast.error(error.message);
            else toast.success("Response target saved");
          }}
        >
          <label className="flex-1" htmlFor={c.id}>
            {c.name} (hours)
          </label>
          <Input
            className="w-24"
            id={c.id}
            name="hours"
            type="number"
            min={1}
            max={8760}
            defaultValue={c.default_sla_hours}
            required
          />
          <Button type="submit" variant="outline">
            Save
          </Button>
        </form>
      ))}
    </div>
  );
}
