# SEVA demonstration and staging smoke tests

## Honest demonstration setup

Use an isolated development Supabase project, not a public production project. Create separate confirmed citizen, verifier, operator, manager and administrator accounts. Every account begins as citizen; a trusted administrator assigns operational roles. Generate unique passwords, store them in a password manager, and do not publish or share administrator credentials. Name simulated departments **Demo Drainage Team** and explicitly introduce the presentation as a prototype. No default credentials or fabricated impact records are seeded by this repository.

`npm run test:integration` creates temporary accounts/data only on a complete **local** Supabase stack, exercises real Auth/REST/Realtime/Storage and cleans them up. It refuses a remote project. It is skipped, not passed, when the actual local keys are absent. `npm run test:db` independently applies the whole migration chain and exercises real PostgreSQL RLS/transactions with local auth/storage schema contracts. The browser wizard check also requires the actual development URL and public key.

## Three-minute judge walkthrough

1. Introduce the problem: scattered everyday service failures are difficult to organise and follow up. Show the pilot disclaimer and the six categories. Explain that the project does not represent a government authority.
2. In a smartphone-sized citizen session, choose **Report an Issue**, then **Drainage Problem**. Enter an observation with no private contact details. Choose GPS only with consent, or enter a public landmark and correct the map marker. Mention the accuracy indicator and manual correction.
3. Optionally attach a non-sensitive test photo. Review the rule-based explanation: urgency 40%, impact 30%, recurrence 20%, vulnerability 10%. Explain that recurrence is currently unknown and that the score is a recommendation. Request optional model assistance only if its provider is configured; otherwise show the clearly labelled fallback.
4. Submit. Confirm the saved reference and private access key. Copy them privately. Open the authorised staff session and demonstrate the new pending report arriving without manual refresh. Show the optional duplicate candidates; a verifier reviews and chooses whether to link or create an incident.
5. As manager, assign **Demo Drainage Team**. As its operator, mark the incident In Progress, record a meaningful note, optionally attach test resolution evidence, and mark Resolved with a reason. Do not describe this as an actual repair.
6. Show the citizen tracking timeline updating through its bounded refresh. Show the private internal audit history separately in the authorised staff session. Explain that the public map is approximate and excludes the complaint, evidence and reporter identity.
7. In an unauthenticated session, show that a reference alone does not unlock the report. Close with the practical next step: a consent-based ward or village-cluster pilot with agreed human responsibilities and measured outcomes.

## Release smoke checklist

- Homepage stats reflect stored records, empty data has an honest state, and a database failure is not replaced by invented counts.
- Registration, confirmation, logout, email recovery and password update work through the configured provider.
- Citizen A cannot access Citizen B's report; metadata cannot select staff roles.
- GPS denial, unavailable lookup, corrected marker, oversized/spoofed upload, offline submission and repeated click paths are handled truthfully.
- A saved report creates its rule-based analysis atomically. Failed writes do not display success.
- Authorised staff receive Realtime insert/update events, reconnect after a network interruption, and the fallback refresh works. Unauthorised subscribers receive no private rows.
- Verification is single-use and links/creates exactly one reviewed incident. Duplicate suggestions require category, proximity, time window and textual overlap, and remain human decisions.
- Manager assignment, department-scoped operator updates, meaningful resolution/reopening notes, notifications and protected audit history work.
- Anonymous text submission fails closed without all CAPTCHA, service-key and trusted-header requirements. Anonymous evidence remains disabled.
- Anonymous REST enumeration and public evidence downloads fail. The correct access key returns only a restricted timeline. Signed evidence links expire.
- Production build, lint, type checks, logic tests, PostgreSQL policy tests, configured browser tests and real Supabase integration tests pass on the intended host/project.
- Check mobile layout, keyboard focus, contrast in both themes and reduced-motion behaviour. Review map/geocoding provider terms.
- Obtain owner approval before production SQL, secrets, deployment or merge.
