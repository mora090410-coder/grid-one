# Guest invite operations and release boundary

Status: Anthony authorized commit, push and production deployment on September 20, 2026 for a narrow Monday-night dogfood rollout. Release preparation uses the isolated worktree and preserves unrelated checkout work. Board activation remains restricted to explicitly selected UUIDs; see the release record for verified deployment and configuration results.

## Local review

The disconnected prototype is `/dev/guest-invites` under Vite development. Create a seller link, choose a square, enter a name and inspect the receipt and simulated organizer claim list. Its copied URL opens a simulated guest view. State is in memory, resets on reload and does not synchronize between tabs. It shares production guest components through an injected transport but does not call the app API, Supabase, payment or account services. Existing static font assets may load. The prototype module is excluded from production builds.

Browser journey tests mock API responses. Disposable PostgreSQL integration tests prove database authority separately. Neither test layer establishes hosted WebSocket delivery, physical LTE completion time, provider eligibility, or real payment behavior. No financial transaction is performed.

## Server configuration for the approved rollout

- `GUEST_INVITE_POOL_IDS`: comma-separated exact board UUIDs. Missing, empty or an unlisted board makes all guest endpoints return 404. This is a new server rollout gate; historical instrumentation variants do not enable the feature.
- `GUEST_INVITE_SECRET`: server-only high-entropy signing/derivation secret, at least 32 characters. Never prefix with `VITE_`, expose to browsers, log or put in a committed file. Changing it invalidates invite signatures and affects deterministic confirmation-code retries; do not rotate without a reviewed recovery plan.
- Existing server Supabase URL, anon key, service-role secret and owner verification remain required. `PUBLIC_SITE_URL` controls generated link origin; request Host is never trusted. Preview should use its own configured origin.
- Migration `029_guest_invites.sql` must be reviewed and applied in the approved environment before enabling any board. It creates private tables, service-only RPCs and relational occupancy guards. Do not apply it to production merely to demonstrate the prototype.

The database holds the canonical contest row for writes. Hold lifetime is 90 seconds in the migration function; it is not a browser setting. Hold selection changes preserve the original active deadline. Logically expired holds stop blocking transactions immediately; clients refresh at server deadlines, on invalidation/focus and through visible polling.

Rate buckets retain keyed hashes only and remove buckets older than two days on use. Current fixed-window API limits are 30 mutations per IP/minute, 300 signed-invite mutations/minute, 600 guest requests per IP/minute, 6,000 per board/minute, and 180 reads or 60 other requests per capability/minute. Code access additionally uses 10 attempts per IP and 300 per board/minute. Shared-network limits may need controlled dogfood tuning. Do not interpret a guest credential as verified human identity.

## Release and dogfood evidence

1. Review the final diff and migration against the deployment revision, reconcile other pending changes separately, and obtain Anthony's release approval.
2. Run the repository release gates and disposable integration suite on that exact release tree.
3. Validate `realtime.send` broadcast delivery and anonymous subscription behavior, private-table/RPC grants, expiry, revocation and cross-device code access. Public broadcasts contain only invalidation data and are never authority.
4. During the explicitly selected board dogfood, exercise organizer issuance → fresh mobile guest claim → second viewer/organizer convergence with real APIs. Measure tap-to-claim on LTE. Before broader availability, validate connected p95 update latency under 100 viewers in a controlled environment. Verify polling and explicit stale state with the socket disconnected. Automated local tests do not certify these live performance targets.
5. Review the external destination/instructions as intentionally claimant-facing. This feature does not establish that any named payment provider permits a particular fundraiser or supports a generic payment link.
6. Enable one specifically approved board first. Existing public viewing and private family links remain separate; do not distribute or post guest links for the organizer.

## Stop and rollback

Disable the invite to release in-flight holds while retaining confirmed claims. Removing a board from the server allowlist disables guest endpoints, including private receipt access, but does not delete claims or remove database occupancy guards. Explain that stronger stop to the organizer before using it.

Do not drop the guest tables or triggers as a rollback shortcut: that can discard claim history or permit old writers to overwrite reservations. A code rollback must preserve the compatibility guards for boards with guest history. If a schema rollback becomes necessary, prepare an explicit data-preserving migration and obtain separate approval. Organizer release revokes that claim group's ability to reclaim; a guest's own release allows later reselection while the invite remains active. This is not an identity ban across new browsers.

## Evidence

Local execution details and exact gate results are appended to `docs/REFACTOR_LOG.md`. The implementation plan records task completion. Scratch command logs and agent review reports live in `.work/guest-invites/` in the isolated worktree; they are not production assets or a substitute for release-environment verification.
