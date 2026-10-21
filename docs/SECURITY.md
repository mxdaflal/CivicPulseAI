# Security review and migration strategy

## Closed historical vulnerabilities

Historical policies allowed anonymous enumeration of reports, AI analyses, links, incidents and internal events. The bucket was public. Citizens could mutate reports, create elevated profiles through INSERT and use overly broad category/department UPDATE policies. Incident updates and audits were separate, fallible browser writes. Middleware accepted decoded, unverified cookie contents.

`20261021090000_secure_workflow.sql` removes all permissive policies on application-owned tables and reconstructs grants and RLS. Profile creation is trigger-only and defaults to citizen. Role changes use a checked administrator RPC. Operational writes are narrow SECURITY DEFINER functions with explicit role/department checks, empty search paths and revoked PUBLIC execution. Report analysis is recomputed in the database; caller-supplied model provenance or priority is not trusted. Incident actions and audit/notification writes share a transaction and lock the relevant record to prevent double verification. Normal clients cannot update/delete audit rows or delete incidents as a substitute for resolution.

Evidence is private. Uploads require authenticated ownership, type/size checks and a UUID path. The application validates file signatures server-side. Signed read URLs expire after 60 seconds. Tracking never returns files, exact coordinates, private descriptions, contacts or internal notes. The public incident view is an intentional owner-executed **redacted projection**; do not change it to expose free text. The tracking RPC is an explicit capability boundary: reference-only access is denied unless `auth.uid()` owns the report. SHA-256 hashes of 256-bit random access keys are stored, never raw tracking keys.

## Operational limits and remaining review

- Supabase Auth, Realtime delivery and Storage HTTP download behaviour require a real staging project. PostgreSQL policy tests alone cannot establish those integrations.
- Review every live storage policy; generic policies created outside this migration may override restrictions through permissive OR combinations.
- Rotate or expire access keys through an authorised operational process if a citizen loses control of one. Existing reports without a key hash remain owner-only; do not backfill predictable keys.
- Anonymous capability keys are shown once. If the submission response is lost, anonymous clients cannot recover the secret through the reference alone. An operator recovery process must verify identity/authority rather than weakening tracking security.
- A failed report retry can leave a private, unreferenced upload. Retry reuses the path. Add a privileged scheduled cleanup of unreferenced objects older than 24 hours for a deployed pilot; never delete objects referenced by reports/evidence. Report/analysis creation itself is atomic.
- Upload metadata/GPS EXIF is not automatically stripped in this revision. Warn users before uploading personal images and establish retention/redaction procedures before a real citizen pilot.
- Public summaries use approximately kilometre-level coordinates. Review rural reidentification risk and adjust rounding or omit coordinates for sensitive categories before a pilot.
- Nominatim's active proxy is rate-limited per process, not globally across scaled deployments. Anonymous reporting is disabled unless verified anti-abuse configuration is complete. Login abuse protections must be enforced in Supabase Auth, not just the browser.
- No public SMS/WhatsApp delivery or predictive accuracy is claimed. Rule-based scores are reviewable recommendations, not verified facts.

## Required staging negative checks

Using two citizen accounts, an unassigned operator, an assigned operator, a verifier, a manager and an administrator:

1. Anonymous REST SELECTs of reports, analyses, links, private incidents, events, profiles and evidence must fail or return no private rows.
2. A citizen must not SELECT another citizen's report, mutate any report status/priority, INSERT an elevated profile, UPDATE their role, change incident state, assign a department or call role-management RPCs.
3. A verifier may review a report but cannot perform operational changes. An operator can access only their assigned incident/department and cannot assign teams or override priority.
4. Try a forged session cookie with admin metadata; privileged routes must reject it after server verification.
5. Public storage URLs, private signed URLs belonging to another citizen and unauthenticated object requests must be denied. Verify signed URLs expire and existing historical objects remain owner/reviewer-only.
6. A short reference or incorrect access key must not unlock tracking. A valid key returns only the approved fields and a status-only audit projection.
7. Confirm normal staff cannot erase/rewrite audit events, and a failed operation leaves no partial report/link/incident/audit state.
8. Verify Realtime subscriptions cannot receive rows outside their RLS scope. Confirm updates/reconnects and polling fallbacks with two browser sessions.
9. Try oversized requests, unsupported/forged images, duplicate clicks, replayed idempotency keys, invalid coordinates, repeated report submissions and invalid Turnstile tokens.

Any high-severity access-control failure blocks production release.

## Migration and rollback

Historical migrations are unchanged. The new migration is transactional, adds columns/tables/functions/policies and retains existing data and objects. First apply it to staging after a backup and test the full migration chain. Inventory row counts, schema, policies, bucket settings and grants before and after.

For rollback, fail closed: stop submissions/privileged actions, preserve the database backup and post-migration data, roll back the application deployment, and retain private storage and the tightened grants. If restoration is necessary, restore the backup into an **isolated** project, apply the privacy hardening there, verify it, and switch the app only after approval. Do not restore the old anonymous SELECT policies or public bucket as a rollback. Do not drop citizen tables or reset a production project. Production changes and any restoration require owner approval.
