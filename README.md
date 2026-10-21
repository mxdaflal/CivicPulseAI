# CIVIC PULSE AI

A SEVA First Innovation Challenge prototype for private civic reporting, human verification and accountable incident resolution. Built on the existing Next.js App Router, React, TypeScript, Tailwind/Radix UI and Supabase stack. It is not an official government service, and no municipal partnership or real-world repair impact is claimed.

## Develop

Use Node.js 22+ (Node 24 was used for validation).

```sh
npm ci
cp .env.example .env.local
# Enter the URL and public anon key of a DEVELOPMENT Supabase project.
# Follow docs/DEPLOYMENT.md to apply the migration to staging first.
npm run dev
```

The application shows a configuration screen until its required Supabase variables are present. No fake credentials or fabricated data are used. Changing `NEXT_PUBLIC_*` values requires rebuilding the production app.

```sh
npm run typecheck
npm run lint
npm test
npm run test:db  # Docker; creates and removes a disposable local PostgreSQL container
npm run build
npm run test:e2e # Uses installed Chromium when available; otherwise install Playwright Chromium
npm start
```

`test:db` applies every historical migration and the new hardening migration to PostgreSQL with minimal Supabase auth/storage schema contracts, then checks real PostgreSQL grants, RLS and workflow transactions. It is not a replacement for testing Supabase Auth, Storage HTTP downloads or Realtime in staging. Browser tests explicitly skip configured reporting checks when project credentials are missing.

## Implemented workflow

- Report wizard with bounded validation, manual/GPS location, correction on a Leaflet map and authenticated private photo uploads.
- Transactional report creation and rule-based analysis, idempotency keys and per-user database submission limits.
- Strong tracking references plus separate 256-bit access keys; verified owners need no access key. Tracking returns an explicit restricted projection and polls every 15 seconds while visible.
- Verified server-side sessions, protected staff/admin routes, database roles and department-scoped operator permissions.
- Atomic report review/linking, incident assignment/status/priority updates, protected audit history and in-app notifications.
- RLS-protected dashboard subscriptions with reconnect handling and polling fallback. Summary counts cover the caller's permitted records; tables are paginated.
- Public aggregates and a redacted approximate incident map; no public complaint enumeration, internal notes, precise reporter location or evidence.
- Optional authenticated AI Edge Function with usage limits, input/output validation, timeout and a clearly labelled rule-based fallback. Confidence is not presented as a calibrated probability. Recurrence remains unknown without verified history.
- Administrator role/department controls and category response targets. The first admin is established by a trusted SQL operator, never public signup.

Anonymous submissions are **text-only and disabled until all anti-abuse settings are configured**. They require Turnstile verification, a server-only service key and a trusted hosting IP header. Email/phone/OAuth delivery depends on configured Supabase providers; SMS or WhatsApp delivery is not claimed.

See [deployment and secure administration](docs/DEPLOYMENT.md), [security and migration review](docs/SECURITY.md), [demo and staging checks](docs/DEMO.md), and [validation evidence](docs/VALIDATION.md). Production release remains gated on staging integration and security checks, owner approval, and production configuration. No production database or deployment was changed.
