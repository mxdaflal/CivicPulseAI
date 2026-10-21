"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default function ResetPassword() {
  const [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold mb-5">Choose a new password</h1>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user)
            setMessage(
              "Open the reset link in your email to establish a verified session.",
            );
          else {
            const { error } = await supabase.auth.updateUser({ password });
            setMessage(
              error
                ? "The password could not be updated. Try a new reset link."
                : "Password updated. You can now sign in with your new password.",
            );
          }
          setBusy(false);
        }}
      >
        <Label htmlFor="newPassword">
          New password (at least 12 characters)
        </Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={100}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button disabled={busy} type="submit">
          {busy ? "Saving…" : "Update password"}
        </Button>
        <p role="status">{message}</p>
      </form>
    </div>
  );
}
