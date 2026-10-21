import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/security";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const client = await serverSupabase();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(safeRedirect(url.searchParams.get("redirect")), url.origin),
      );
  }
  return NextResponse.redirect(
    new URL("/login?error=confirmation", url.origin),
  );
}
