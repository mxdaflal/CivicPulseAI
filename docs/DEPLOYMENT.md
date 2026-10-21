# Development, staging and deployment

## Required application variables (names only)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Use a development or staging Supabase project. Never use a service-role key in a `NEXT_PUBLIC_*` variable. Browser requests are intentionally subject to RLS.

Optional anonymous text reports require all of:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REPORT_RATE_LIMIT_SECRET`
- `CIVICPULSE_TRUSTED_IP_HEADER`

Create a Turnstile widget for the actual site hostname. The server verifies the token hostname and action `report`. Configure a host-provided IP header that cannot be supplied or overridden by clients; on Netlify, check its current documentation for `x-nf-client-connection-ip`. Never point this setting at an arbitrary user-controlled `X-Forwarded-For`. Keep it blank on unsupported hosts to disable anonymous reporting. Tokens are sent in request bodies and never placed in tracking URLs. Store optional secrets only in the hosting secret manager.

## Supabase schema and storage

1. Back up the target project and record migration history. Use a dedicated staging project with no production citizen data.
2. Inspect **every** existing `pg_policies` entry on the application tables and `storage.objects`, including policies added outside this repository. The new migration removes all legacy policies on application-owned public tables and all repository `evidence_*` storage policies. Unexpected generic storage policies can still combine permissively and must be reviewed.
3. Point the Supabase CLI at the staging project (`supabase link --project-ref ...`) using your own authenticated CLI. Review `supabase db push --dry-run` before `supabase db push`. These commands are operator instructions, not commands executed against production during development.
4. A new project needs the full migration chain. An existing project needs the new `20261021090000_secure_workflow.sql` after its recorded historical migrations. Do not replay already-applied history.
5. Confirm the evidence bucket is private, restricted to JPEG/PNG/WebP and 5 MB, and its new policies are effective. Existing objects are retained. Historical URLs are converted to scoped signed requests by the UI; public URL access must fail.
6. Inspect `supabase_realtime` membership. The migration adds reports, incidents and notifications if the publication exists. Supabase Postgres Changes must still enforce the subscriber's RLS. Do not enable unrestricted broadcast of rows. Private capability tracking deliberately uses a redacted polling RPC.
7. Run `docs/DEMO.md` and the negative access tests in `docs/SECURITY.md` before connecting real citizens.

## Initial administrator

Create and confirm a normal account through Supabase Auth. All new profiles must have role `citizen`, regardless of signup metadata. From the trusted Supabase SQL editor, independently verify that account's UUID and email, then use a transaction to update **only that UUID** to `admin`. Record the operator, reason and time in your operational change log. There are no default admin passwords or public bootstrap endpoints. After initial setup, admins use `/admin`; subsequent role changes go through an audited database function. Do not distribute a shared administrator account.

## Authentication providers

Set the Supabase Site URL to the actual staging/production origin and allow `/auth/confirm` and `/reset-password` redirect paths. The app uses PKCE and exchanges OAuth/email codes on the server. Verify confirmation and recovery email templates, delivery and expiry against your project configuration. Configure password policy, email confirmation, CAPTCHA and Auth rate limits in Supabase. The browser attempt guard is only a usability measure, not a security boundary. Phone sign-in and Google OAuth require their own configured providers; do not advertise delivery until tested.

## Edge Functions

Deploy `ai-analyze` and `geocode` with the Supabase CLI from the repository root. Both validate callers with Supabase Auth; the gateway's `verify_jwt` setting is not the only security check. `ai-analyze` also consumes a database-backed per-user quota. Set `OPENAI_API_KEY` **in the Supabase Edge Function secret store** if model suggestions are desired. Without it, analysis returns a clearly labelled rule-based result. Do not place it in the Next.js client environment or commit it. Never paste secret values in chat.

The Next.js `/api/geocode` endpoint is the map form's active reverse-geocoding route. It validates coordinates, authenticates users, caches results and admits at most one upstream request per second per Node process. Public Nominatim is suitable only for a small pilot with a single app instance; use a contracted provider/global limiter before scaling horizontally. Users can enter an address manually when lookup is unavailable. Review provider attribution and usage policies. No continuous location tracking is performed.

Required runtime domains include the configured Supabase project, `nominatim.openstreetmap.org`, `tile.openstreetmap.org` and, when anonymous reports are enabled, `challenges.cloudflare.com`. OpenAI requests originate from the Supabase function runtime. System fonts remove the previous build-time Google Fonts dependency.

## Hosting

The existing Netlify configuration is retained. Use Node 24, install with `npm ci`, and run `npm run build`; the Netlify Next.js adapter handles server routes, middleware and SSR. A compatible Next.js host is also possible. Set variables before building; rebuild after public variable changes. Set `CIVICPULSE_APP_ORIGIN` to the exact browser-facing HTTPS origin when TLS terminates at a reverse proxy. This gives request-origin checks and authentication redirects a canonical origin without trusting arbitrary forwarded headers. Do not export the application as a static site. No deployment URL is assumed here.

Before production: obtain owner approval, apply the reviewed migration using the authorised operator, configure secrets securely, deploy, and run staging-equivalent smoke and negative security checks on the actual host. Do not merge or publish automatically.
