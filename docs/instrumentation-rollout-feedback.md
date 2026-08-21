# GridOne Instrumentation, Feedback, Rollout, and Recovery

**Status:** Planning and release authority
**Date:** 2026-08-20
**Related:** `product-metrics-and-evidence.md`, `prototype-strategy.md`, `accessibility-contract.md`

## Operating posture

GridOne is a game-day trust product. A UI rollout that cannot be observed or rolled back quickly is not production quality.

Use privacy-minimal first-party evidence, small cohorts, server-controlled feature flags, backward-compatible data changes, and explicit rollback. Do not install a broad third-party analytics suite merely because dashboards look professional.

No analytics collection, real-user outreach, production deployment, paid service, or production schema change occurs without Anthony’s applicable approval.

## Evidence layers

### 1. Durable domain outcomes

Prefer server-owned facts already required to operate the product:

- Draft created
- Assignment/readiness milestones
- Draw committed
- Board published
- Checkout/entitlement state
- Score authority state
- Milestone pending/resolved/corrected
- Notification verification/delivery
- Final qualification

These are more trustworthy than client click events and should compute the north star.

### 2. Minimal client interaction events

Collect only questions the domain model cannot answer:

- Homepage primary/secondary action
- Organizer phase entered/completed
- Find My Squares opened/resolved/no-match
- Personalized scenario disclosure
- View/center selected square
- Grid interaction mode
- Notification form opened
- Recoverable UI failure code
- Coarse performance timing

Client analytics failure never blocks the task.

### 3. Qualitative evidence

- Five target-organizer sessions
- Five phone-viewer sessions
- Prototype comprehension/usability sessions
- First ten eligible real fundraiser boards
- Support messages and observed interventions
- Individual review of every failed/ambiguous game-day run

## Privacy contract

Permitted event fields:

- Internal board/account/participant identifiers only when necessary for server-side joins
- Event schema version
- Event name
- Server/client timestamp
- Route/surface and lifecycle phase
- Success/failure code
- Tier and score authority
- Coarse viewport/device class
- Coarse performance duration
- Feature-flag variant

Prohibited:

- Display/purchaser names
- Seller/parent labels
- Email addresses or notification tokens
- Payout/rules text
- Uploaded images
- Raw score-provider payloads
- Full URLs with query values
- Free-form errors that may contain user data
- Cross-site advertising identifiers
- Fingerprinting

Retention is purpose-limited and documented per event family. Delete or aggregate events when the product question expires.

Privacy and Terms must accurately describe collection before activation.

## Instrumentation architecture recommendation

Start with a small first-party event endpoint and server-owned event schema rather than a third-party SDK.

Requirements:

- Authenticated organizer events tied to owner/board when needed
- Public viewer events use board id/share-code resolution plus an ephemeral session identifier; no durable person tracking
- Server timestamps authoritative for outcome events
- Event-name allowlist and strict payload schema
- Rate limits and abuse protection
- Non-blocking client delivery (`sendBeacon` or bounded equivalent where appropriate)
- No service-role or secret exposure
- Idempotency key for server outcome events
- Explicit environment separation
- Test fixtures never contaminate production product metrics

Implementation may choose the storage/transport after cost, retention, query, and privacy review. Do not lock a vendor in this planning document.

## Event ownership

Every event requires:

- Product question it answers
- Owner
- Schema/version
- Source of truth: server or client
- Trigger definition
- Allowed fields
- Retention
- Test
- Dashboard/query consumer
- Removal condition

An event without a decision consumer is removed.

## Prototype feedback loop

For each prototype track:

1. Render both variants at phone and desktop.
2. Anton performs independent design-director and implementation-evidence reviews.
3. Run short task tests with representative users when available.
4. Record completion, hesitation, terminology confusion, recovery, and requests for help.
5. Score against the 40-point rubric.
6. Select winner; record discarded variant and why.
7. Promote decisions—not HTML—into production plan.

Anthony is asked only if evidence suggests changing product promise, trust boundary, commercial model, or primary user.

## Feature-flag architecture

Recommended independently reversible flags:

- `viewer_v2`
- `organizer_v2`
- `homepage_v2`

Rules:

- Server/environment-controlled production eligibility
- Board/account allowlists for internal and pilot cohorts
- No public query parameter can enable production mutations or unpublished functionality
- Variant identity is observable in support/telemetry
- Flags have owner, default, expiry/removal condition, and rollback procedure
- Old/new surfaces share the same server contracts during rollout
- Remove flags after stable adoption; do not accumulate permanent forks

## Rollout sequence

### Stage 0 — Baseline and safety

- Current unit/build/browser baseline recorded
- Production contracts and metrics defined
- Feature flags wired but default off
- Error and performance visibility available
- Rollback verified before pilot

### Stage 1 — Disposable prototypes

Order:

1. Phone viewer
2. Organizer workspace
3. Product-first homepage

No production traffic.

### Stage 2 — Foundation/enforcement

- Formal DESIGN.md and token mapping
- Deterministic design audit
- Accessibility automation
- Shared primitives only where real reuse exists
- No broad visual redesign yet

### Stage 3 — Viewer pilot

- Internal/demo and allowlisted published test boards
- Unpersonalized, personalized, stale/offline/manual, OPEN/corrected, and Final states
- Phone-first rendered and assistive-technology checks
- Compare viewer completion/friction against baseline

Viewer rollback must not affect the public snapshot, score, milestone, or notification state.

### Stage 4 — Organizer pilot

- Internal/test organizer accounts
- One phase slice at a time behind `organizer_v2`
- Preserve server contracts and current route fallback
- Start with manual-scoring extraction or the lowest-risk seam chosen by final implementation plan, then expand through lifecycle
- Verify autosave/conflict and public-trust boundaries before broadening

### Stage 5 — Homepage pilot

- Product-first homepage uses real selected product artifacts
- Optional film remains isolated
- Verify comprehension, actions, performance, SEO/static output, reduced motion

### Stage 6 — Cohort expansion

- Small real fundraiser pilot only after approval
- Review each eligible board through Final
- Increase cohort only when north-star qualification and guardrails are healthy

### Stage 7 — Default and cleanup

- New surface becomes default
- Old surface remains rollback-capable for a defined stabilization window
- Remove dead flags/code only after incident-free window and approval
- Update support, runbooks, screenshots, docs, and case-study evidence

## Release gates per stage

- Scope-specific unit/component/API tests
- Typecheck and production build
- Deterministic design audit and DESIGN.md lint
- Accessibility automated and manual checks
- Browser checks in Chromium/WebKit and Firefox where required
- Phone/desktop rendered state review
- Security/privacy review for data changes
- No unintended pricing, permission, score, notification, or schema drift
- Rollback rehearsal
- Clear go/no-go owner

A passing build is necessary and insufficient.

## Game-day health and incident ownership

Monitor at minimum:

- Public viewer availability
- Score refresh/freshness/rejection
- Manual-score availability
- Milestone pending/resolution correctness
- Notification queue/delivery failures
- Checkout/entitlement mismatch
- Client route/render failures by feature flag
- North-star qualification failures

Severity:

- **P0:** wrong/private data exposure, wrong matchup/score accepted, public viewer broadly unavailable, duplicate/incorrect winner resolution, payment/entitlement integrity failure
- **P1:** major cohort cannot complete organizer/viewer task; manual recovery unavailable; severe accessibility regression
- **P2:** recoverable interaction defect, layout/state inconsistency, isolated delivery failure
- **P3:** polish/documentation defect

During a live game, restoring trustworthy access outranks preserving the new UI.

## Rollback contract

UI rollback:

- Disable affected feature flag
- Return users to current stable surface
- Preserve route/share links and server-owned state
- Do not roll back durable correct domain events

Data rollback:

- Prefer backward-compatible additive migrations
- Deploy read compatibility before write changes
- Never require a destructive migration merely to launch a visual/feature shell
- For normalized assignment/participant changes, use explicit migration, dual-read/write only when bounded, reconciliation checks, and a documented cutoff

Operational rollback:

- Stop cohort expansion
- Mark affected events/metrics
- Preserve logs/evidence
- Communicate known state through support surface when user impact warrants
- Run incident review before re-enabling

## Feedback and support

- Support identity remains `support@getgridone.com`.
- Capture issue category, board/route identifier, time, feature variant, and non-sensitive reproduction facts.
- Do not ask users to email purchaser lists, board images, payment details, or secrets unless an approved secure process exists.
- Every pilot board has a named internal owner for follow-through through Final.
- User feedback becomes a bounded decision input, not permission for open-ended redesign.

## Success and expansion rules

Do not expand solely because:

- click-through improved;
- the new surface looks better;
- no one complained;
- automated tests passed.

Expand when:

- complete tasks improve or remain strong;
- north-star qualification is healthy;
- zero-tolerance guardrails hold;
- support burden is acceptable;
- accessibility evidence passes;
- rollback remains available.

## Final planning handoff

After winning prototypes exist, produce a production implementation plan that:

- maps exact files and feature seams;
- sequences vertical slices;
- includes tests before behavior changes;
- names feature flags and rollback;
- defines data migration only where required;
- includes rendered QA and accessibility evidence;
- records approval gates for production actions.

Until prototype evidence exists, production file-by-file planning beyond the settled seams is provisional.
