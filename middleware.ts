import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const STAFF_ROLES = ['verifier', 'operator', 'manager', 'admin', 'staff'];

// Supabase v2 stores session tokens in cookies named sb-<ref>-auth-token
function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.getAll().some((c) => c.name.includes('auth-token'));
}

// Extract the user's role from their JWT's app_metadata
function getRoleFromCookie(req: NextRequest): string | null {
  const cookie = req.cookies.getAll().find((c) => c.name.includes('auth-token'));
  if (!cookie) return null;

  try {
    // The cookie value may be a JSON-encoded array [session] or a base64 string
    let raw = cookie.value;
    // Try parsing as JSON array (Supabase v2 format)
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        raw = parsed[0];
      }
    } catch {
      // not JSON, use raw value
    }

    // JWT is header.payload.signature — decode payload
    const parts = raw.split('.');
    if (parts.length < 2) return null;

    // Base64url decode the payload
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    const decoded = JSON.parse(payload);

    // Role may be in user_metadata or app_metadata
    const role =
      decoded?.user_metadata?.role ||
      decoded?.app_metadata?.role ||
      decoded?.role ||
      null;

    return role;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isCitizenProtected =
    pathname.startsWith('/citizen/') && !pathname.startsWith('/citizen/login');
  const isStaffProtected =
    pathname.startsWith('/staff/') && !pathname.startsWith('/staff/login');

  if (!isCitizenProtected && !isStaffProtected) {
    return NextResponse.next();
  }

  // No session cookie → redirect to appropriate login
  if (!hasSessionCookie(req)) {
    const loginUrl = pathname.startsWith('/staff/') ? '/staff/login' : '/citizen/login';
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }

  // Staff route role check (cookie-level check — full DB check happens client-side too)
  if (isStaffProtected) {
    const role = getRoleFromCookie(req);
    if (role && !STAFF_ROLES.includes(role)) {
      return NextResponse.redirect(new URL('/staff/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/citizen/:path*', '/staff/:path*'],
};
