# Implementation map

The original application stack and historical migrations are preserved. Duplicate citizen submission code now routes through the validated report wizard; the duplicate operations dashboard re-exports the canonical staff dashboard. This consolidates security decisions rather than maintaining competing write paths.

- **Database:** one additive transactional migration resets legacy grants/policies, introduces owner/capability tracking, private evidence, trusted role checks, atomic review/assignment/status/priority/evidence operations, audit records, notifications, rate limits, redacted projections and database aggregates. Historical data is retained.
- **Server boundaries:** verified SSR Auth/PKCE cookies and server route protection replace unverified cookie decoding. API routes enforce same-origin requests, bounded input and explicit schemas. Image signatures are validated before scoped storage uploads.
- **Citizen UI:** a responsive three-stage report wizard, manual/GPS/map correction, honest errors, private tracking details, a paginated live reports workspace, secure status timeline and real in-app notifications.
- **Staff UI:** scoped subscriptions with cleanup/reconnect/polling, database-wide filters, atomic review and duplicate linking, role-appropriate operational controls, manager priority overrides with reasons, private resolution evidence and retained audit history.
- **Public UI:** existing homepage polished with pilot boundaries and actual aggregates, redacted approximate incident maps, stored-data analytics and explicit insufficient-data states. No incident history or social impact is fabricated.
- **Administration:** trusted initial-administrator procedure, protected role/department controls and category response targets.
- **Intelligence:** testable keyword/priority and geographic/time/text duplicate logic, explicit unknown recurrence, no fabricated probability, and optional authenticated/quota-limited model suggestions with validated scores and a labelled fallback.
- **Tooling:** Next.js 15.5.28, Tailwind 4, patched PostCSS override, flat ESLint configuration, frozen installation, unit/policy/browser/integration checks, CI, environment template and deployment/security/demo documentation.

Outstanding integration and operational limitations are listed in [VALIDATION.md](VALIDATION.md), [SECURITY.md](SECURITY.md) and [DEPLOYMENT.md](DEPLOYMENT.md). This is a reviewable prototype implementation, not an assertion of production readiness.

## Changed files

- `.env.example`
- `.eslintrc.json` (replaced by flat ESLint config)
- `.github/workflows/ci.yml`
- `.gitignore`
- `README.md`
- `app/admin/page.tsx`
- `app/analytics/page.tsx`
- `app/api/evidence/route.ts`
- `app/api/geocode/route.ts`
- `app/api/reports/route.ts`
- `app/api/track/route.ts`
- `app/auth/callback/page.tsx`
- `app/auth/confirm/route.ts`
- `app/citizen/dashboard/page.tsx`
- `app/citizen/login/page.tsx`
- `app/dashboard/page.tsx`
- `app/forgot-password/page.tsx`
- `app/globals.css`
- `app/incidents/[id]/page.tsx`
- `app/knowledge/page.tsx`
- `app/layout.tsx`
- `app/login/page.tsx`
- `app/map/page.tsx`
- `app/page.tsx`
- `app/profile/page.tsx`
- `app/report/page.tsx`
- `app/reset-password/page.tsx`
- `app/signup/page.tsx`
- `app/staff/dashboard/page.tsx`
- `app/staff/login/page.tsx`
- `app/track/page.tsx`
- `components/LocationCard.tsx`
- `components/auth-provider.tsx`
- `components/issue-map.tsx`
- `components/navbar.tsx`
- `components/notification-inbox.tsx`
- `components/private-evidence.tsx`
- `components/turnstile.tsx`
- `components/ui/carousel.tsx`
- `docs/DEMO.md`
- `docs/DEPLOYMENT.md`
- `docs/IMPLEMENTATION.md`
- `docs/PR_DESCRIPTION.md`
- `docs/SECURITY.md`
- `docs/VALIDATION.md`
- `eslint.config.mjs`
- `hooks/use-live-refresh.ts`
- `lib/ai-analysis.ts`
- `lib/geocode.ts`
- `lib/http.ts`
- `lib/report-schema.ts`
- `lib/security.ts`
- `lib/supabase-client.ts`
- `lib/supabase/server.ts`
- `lib/validations.ts`
- `middleware.ts`
- `next.config.js`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `postcss.config.js`
- `scripts/test-db.sh`
- `supabase/functions/ai-analyze/index.ts`
- `supabase/functions/geocode/index.ts`
- `supabase/migrations/20261021090000_secure_workflow.sql`
- `tailwind.config.ts`
- `tests/database/bootstrap.sql`
- `tests/database/policies.sql`
- `tests/e2e/smoke.spec.ts`
- `tests/supabase.integration.test.ts`
- `tests/unit.test.ts`
