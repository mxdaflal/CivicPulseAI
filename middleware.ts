import { publicOrigin } from "@/lib/security";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const staff =
    path.startsWith("/staff/dashboard") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/incidents/") ||
    path.startsWith("/admin");
  const protectedRoute =
    staff ||
    path.startsWith("/citizen/dashboard") ||
    path.startsWith("/profile");
  if (!url || !key)
    return protectedRoute
      ? NextResponse.redirect(
          new URL("/login?configuration=missing", publicOrigin(request)),
        )
      : response;
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  // getUser verifies the token with Supabase Auth; cookie contents and metadata are untrusted.
  const {
    data: { user },
  } = await client.auth.getUser();
  const redirect = (target: string) => {
    const result = NextResponse.redirect(
      new URL(target, publicOrigin(request)),
    );
    response.cookies.getAll().forEach((c) => result.cookies.set(c));
    return result;
  };
  if (protectedRoute && !user)
    return redirect(
      `${staff ? "/staff/login" : "/citizen/login"}?redirect=${encodeURIComponent(path)}`,
    );
  if (staff && user) {
    const { data } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const roles = path.startsWith("/admin")
      ? ["admin"]
      : ["verifier", "operator", "manager", "admin"];
    if (!data || !roles.includes(data.role))
      return redirect("/citizen/dashboard");
  }
  if (protectedRoute)
    response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
