# Guest Pool Invite Links Implementation Plan

> For agentic workers: use subagent-driven development for bounded independent SQL and UI tasks, with the orchestrator owning API integration and final review. Anthony requested Astra for orchestration and Sol or lower for execution. Anthony subsequently authorized commit, push and deployment; preserve the isolated feature-only release boundary.

**Goal:** Implement organizer-issued seller links with account-free holds/claims, claim-code management, external payment instructions, and live occupancy while preserving every existing board writer.

**Architecture:** Private Postgres tables and one service-only transaction RPC serialize on the canonical contest row. Cloudflare Functions validate signed invite credentials and owner/guest capabilities; React consumes narrow typed snapshots. Database events invalidate versioned public occupancy snapshots, with explicit disconnected fallback. A dev-only disconnected prototype uses the same guest UI through an injected transport.

**Tech Stack:** Existing React/Vite, Cloudflare Pages Functions, Supabase Postgres/Realtime, Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-20-guest-pool-invite-links-prd.md`

## Authorization and working boundary

Anthony first authorized local execution with “Execute once the plan is complete,” then authorized “Commit push deploy. I will test with Monday night football game tomorrow.” This permits the feature-only commit, push, production migration/configuration and deployment. The original checkout has unrelated modified/untracked work; release from `/Users/amm13/.codex/worktrees/guest-pool-invites/gridone-app`. Do not include unrelated changes or contact users. Integration tests use disposable local Postgres; production activation uses the exact board allowlist.

## Global constraints and policy resolutions

- Only the organizer creates/manages invites. Seller is an explicitly named distributor of reviewed square IDs, not a new account role.
- Require an already shared, unfinalized, non-dynamic board. Creating/copying invites does not consume an extra allowance.
- Claimable squares must be explicitly available. The creation review shows existing names and requires acknowledgement that guest claims replace those public names. Responsibility/private payment records stay unchanged.
- Default maximum is one per credential/invite, not per verified person. Regeneration retains invite/group identity and cumulative limits.
- Private draft draws do not stop claiming; final publication does. Finalization rejects active holds; organizer may explicitly cancel holds then retry. A racing new hold can cause another rejection, never a silent override.
- Disable/expiry/rotation release pending holds and preserve claims. Existing claim receipts remain accessible by private credential; mutations require an active invite and unfinalized board. Explicit organizer releases remain possible before publication. Reassignment with active claims is blocked; release them explicitly first.
- Public invite is signed with HMAC-SHA256 and current version is rechecked inside the transaction. Stable Copy deterministically recreates the same signed credential. No browser secrets or raw credentials in public projection/logs/events.
- Four-word claim credential belongs to a group. Hash-only database storage; re-issue rotates it and invalidates old code/session access. Online guessing is rate limited.
- External payment feature is generic instructions plus an optional validated HTTPS destination. No branded provider eligibility claim, bank access, transaction initiation, or automatic paid status. Details appear only in a successful claimant's receipt and organizer preview.
- Add a deliberate server-enforced `GUEST_INVITE_POOL_IDS` allowlist. Missing/empty is off. Add `GUEST_INVITE_SECRET` as a required server-only secret. Configure production values only within the approved release; never commit the secret.
- Full public selling view remains usable when guest feature is off. Hold expiry uses server deadlines; realtime notifications never authorize writes.
- Connected visibility target: p95 under 1 second for 100 connected viewers in a controlled environment; disconnected fallback polls at 15 seconds while visible. Local browser mocked transport cannot certify hosted realtime performance or LTE timing.

## Shared interfaces

Create `src/features/guest/guestInviteTypes.ts` as the authoritative client/server JSON contract. All indices are internal 0–99; UI displays index+1.

```ts
type GuestPayment = { label: string; detail: string; url?: string };
type GuestInvite = { id: string; label: string; cells: number[]; maxSquares: number; version: number; expiresAt: string|null; disabledAt: string|null };
type GuestHold = { index: number; expiresAt: string; mine?: boolean };
type GuestReceipt = { groupId: string; inviteId: string; displayName: string; cells: number[]; claimedAt: string|null; canManage: boolean; payment: GuestPayment|null; claimCode?: string };
type GuestSnapshot = { boardId: string; title: string; shareCode: string; revision: number; serverTime: string; stage: 'selling'|'finalized'; squares: string[][]; allocationLabels: (string|null)[]; availability: string[]; holds: GuestHold[]; claimedCells: number[]; invite?: GuestInvite; mine?: GuestReceipt; heldCells?: number[] };
type OrganizerInvite = GuestInvite & { url: string; payment: GuestPayment|null; counts: {available:number; held:number; claimed:number} };
type OrganizerInvites = { revision:number; invites:OrganizerInvite[]; claims:GuestReceipt[]; holds:GuestHold[] };
type GuestRequest = { action:'read'|'hold'|'confirm'|'receipt'|'release'|'swap'; inviteToken?:string; guestToken?:string; claimCode?:string; cells?:number[]; name?:string };
```

Owner endpoint: `GET/POST /api/pools/:id/invites`; POST actions `create|update|disable|regenerate|cancel_holds|release_claim|rotate_code`, with current `revision`, target `inviteId/groupId` where relevant. Creates carry `label,cells,maxSquares,expiresAt,payment,offerAcknowledged:true`. Mutation response carries fresh list and optional one-time `claimCode`.

Guest endpoint: `POST /api/pools/:id/guest` with GuestRequest; read/hold => snapshot, confirm/receipt/release/swap => receipt. Return friendly typed error `{code,error}`; wrong/private credential failures do not expose records. `GET /api/pools/:id/guest-state` yields only shared public occupancy; allowed owner UI can subscribe to the same occupancy events and independently fetch private summaries.

Database RPC:

```sql
gridone_guest_action(p_action text, p_board_id uuid,
 p_owner_id uuid default null, p_invite_id uuid default null,
 p_guest_hash text default null, p_payload jsonb default '{}'::jsonb)
returns jsonb
```

Actions: `owner_list,owner_create,owner_update,owner_disable,owner_rotate,owner_cancel_holds,owner_release_claim,owner_rotate_code,guest_read,guest_hold,guest_confirm,guest_receipt,guest_release,guest_swap,public_state`.
Payload camelCase: `revision,label,cells,maxSquares,expiresAt,payment,offerAcknowledged,credentialVersion,credentialKind,claimCodeHash,groupId,name`. `credentialKind` is `session` or `code`. Guest session is a random 256-bit browser capability; API hashes it. API computes deterministic four-word confirmation code from secret+board+invite+session for safe confirm retry, with DB uniqueness enforcement; owner rotation uses fresh randomness. Successful code entry supports actions directly with code hash. DB checks all current lifecycle, limits and authority, including on receipt canManage.

## Review focus

1. Lost confirm response: retry returns the same claim/code without creating another claim or losing access (Tasks 1–3).
2. Existing family/owner overwrites and publication races: every writer observes occupancy; published audited corrections still work (Tasks 1,4).
3. Duplicate names and multiple devices: names never authorize access; sessions/codes and limits do (Tasks 1–3).
4. Reconnect, delayed/forged events, and expired holds: server snapshot wins and stale UI is labelled (Tasks 3,4).
5. Credential/payment leakage: public payloads and broadcast exclude secrets/details, URLs reject executable schemes, no automatic payment writes (Tasks 1–5).

## Task 1: Transactional storage and cross-writer integration

**Files:** create `supabase/migrations/029_guest_invites.sql`, `tests/guestInvites.integration.test.ts`; modify only migration-boundary fixtures/tests where needed.

**Produces:** RPC and JSON shapes above; four private RLS tables (invites, claim groups, holds, claim squares); `pool:<board UUID>` server broadcast invalidations for held/released/claimed plus invite lifecycle changes.

- [x] Write/run real-Postgres tests before migration. Follow `tests/familyAccess.integration.test.ts` fixture/bootstrap; example assertion: race two guest_hold calls for cell 0, then `SELECT count(*) FROM guest_square_holds WHERE cell_index=0` equals 1.
- [x] Add migration using existing sequence convention. Supabase CLI is absent and unapproved installation is unnecessary; use repository-native local migration artifact plus disposable SQL verification.
- [x] Serialize all actions on contest row, validate scope/availability/lifecycle/credential version, make confirm idempotent and swaps atomic. Enforce unique active occupancy and cumulative limits. Release logically expired holds on every read/mutation path without relying on background cleanup.
- [x] Protect existing writes with a contest trigger: held cells cannot change; active claimed names/availability must match current claim state, and responsibility cannot change. Guest RPC updates claim rows/removes holds before patching board so the trigger can validate relational truth; do not rely solely on a spoofable custom GUC bypass.
- [x] Preserve existing published audited corrections through existing publication integrity checks; guest mutations stop at publication. Reject active holds during publication. Validate canonical squares against snapshot only for boards participating in guest invites to avoid unrelated legacy behavior drift.
- [x] Guard scope reassignment, update, owner transfer, direct save and family paths; disable intersecting invitations on permitted reassignment. Preserve claims/history on link disable and rotation.
- [x] Add persistent bounded rate buckets usable by API per hashed IP/session/invite/credential (no raw IP retained). Keep correctness concurrency test separate from rate-limit test.
- [x] Run `npx vitest run --project integration tests/guestInvites.integration.test.ts` and existing family/pregame/published-rename suites. Record actual results; do not commit.

## Task 2: Server credentials and API boundary

**Files:** create `functions/_lib/guestInvites.ts`, credential helper/word list, `functions/api/pools/[id]/{invites,guest,guest-state}.ts`, `tests/guestInviteEndpoints.test.ts`, `tests/guestInviteCredentials.test.ts`; modify publish error mapping and test.

- [x] Write/run tests for tampered/cross-board/rotated invite tokens, absent gate, owner verification, missing/oversized fields, credential hashing, forbidden URLs, and no public payment details.
- [x] Implement signed deterministic invite URLs at `/p/<id>?invite=<token>`, cryptographic sessions/code derivation, bounded JSON parsing, response no-store/no-referrer, consistent error mapping.
- [x] Add exact UUID allowlist gate and required secret; owner auth via getUser and DB ownership recheck. Validate nonnegative indices, distinct cells, limits, lengths, ISO expiry, action allowlists, and generic HTTPS payment link.
- [x] Rate limit before capability lookups via DB RPC; never trust client-provided IP. Use Cloudflare-provided IP only, server HMAC hash, conservative fallback bucket locally.
- [x] Add friendly publish mapping for guest_holds_active and guest_square_conflict without changing publication arguments.
- [x] Run focused unit tests plus `npx tsc --noEmit`. No production secrets/settings changed.

## Task 3: Guest UI and disconnected prototype

**Files:** create `src/features/guest/{GuestPoolPage,GuestClaimBoard,ClaimReceipt,guestInviteService,guestInviteTypes,useGuestSync,guestInviteModel}.tsx/ts`, dev-only prototype fixture/page, guest semantic tests; modify `App.tsx` for public route and dev-only prototype entry.

- [x] Write/run semantic tests: account-free load, keyboard scoped selection, held pending/success/race, name validation, timeout preserving input, receipt/code, recovery, failed swap retains picks, link finalized/dead, link following does not alter paid status.
- [x] Implement shared typed transport and roving accessible grid with phone-readable square details; retain full board, no draft axes. Confirm uses existing hold capability, selection never implies accepted hold before response.
- [x] Implement browser credential persistence with storage-failure handling, claim-code entry, recovery instructions, release/swap operations, private receipt payment panel, no account nudge.
- [x] Keep transient input/receipt during refresh/error. Treat all broadcasts only as invalidation; debounce refresh, reconcile from server snapshot on reconnect/focus, show live/reconnecting/offline state and 15s fallback.
- [x] Implement disconnected dev-only prototype using same UI and injected in-memory transport. No live Supabase/API/payment requests; simulated owner creation and claim list must be inspectable. Production build must exclude fixture entry.
- [x] Run focused UI tests and inspect rendered desktop/phone via Playwright; screenshots are evidence, not proof of live transport or database races.

## Task 4: Organizer and public viewer integration

**Files:** create `src/features/organizer/workspace/GuestInvitesCard.tsx` and tests; modify `OrganizerWorkspace.tsx`, `components/BoardView.tsx`, `src/features/viewer/sales/{SalesBoardViewer,salesBoardModel}.tsx/ts` and tests as needed. Reuse existing family square-number parser without unrelated extraction/refactor.

- [x] Write/run tests for review of existing square names, owner-only issuance, stable copy/share text, disabled/regenerated links, counts and source-labelled claims, code rotation, explicit release and cancel-holds confirmation.
- [x] Implement card before private Family access, loading private summaries independently, gated off gracefully on 404. Flush existing changes before mutations and preserve unsaved input on conflict. Require explicit offer acknowledgement.
- [x] Provide link settings, claimed/held/available counts, generic payment input+preview, native share with copy fallback, organizer release/re-issue controls, cancellation of active holds before retrying publication.
- [x] Integrate public sales hold overlay and sync; feature-off path preserves normal public polling. Owner realtime invalidates summaries without replacing unsaved board edits.
- [x] Run focused organizer/public viewer tests, then existing organizer publication and family tests.

## Task 5: End-to-end proof, review and handoff

**Files:** create `playwright-tests/guest-invites.spec.ts`, append `docs/REFACTOR_LOG.md`, update affected product/architecture/contracts in this isolated checkout and add local deployment/rollback notes. Keep PRD approval history and label superseding execution authorization.

- [x] Add mocked browser journeys for organizer issuance → fresh guest claim → receipt/manage, second viewer updates, invalid/locked links, disabled race, disconnected fallback, narrow payment visibility, mobile keyboard/axe checks.
- [x] Run all non-container gates: `npx tsc --noEmit`, `npm run test:unit`, `npm run build`, `npm run design:lint`, `PLAYWRIGHT_PORT=5199 npx playwright test --project=chromium`.
- [x] Run `npm run test:integration` with disposable Docker. Run focused phone browser cases and inspect screenshots. Investigate any regression; distinguish pre-existing baseline failures.
- [x] Independent Sol review for authentication/privacy/concurrency gaps, then orchestrator review/fixes and proportionate retests. Inspect final diff and record commands/evidence plus any unverified hosted/LTE/real-provider paths.
- [x] Keep changes local/uncommitted. Present plan, prototype entry, verified behavior and release prerequisites. No deployment or production migration.

## Baseline and plan self-review

Baseline isolated HEAD: unit suite 122 files / 844 tests passed. Docker started locally for integration testing. No feature code existed before plan completion.

Coverage: tasks 1–2 own authority, lifecycle, concurrency and privacy; tasks 3–4 own the 30-second guest and organizer workflows, realtime and external handoff; task 5 owns browser/accessibility/regression evidence. API action names and JSON shapes are fixed in Shared interfaces. Work ownership excludes overlapping SQL/API/UI files except explicit integration edits by the orchestrator. The plan is complete; execute under Anthony's latest authorization without a routine reapproval prompt.


## Local acceptance evidence — September 20, 2026

All local implementation tasks are complete. The final production build and typecheck pass; unit suite is 129 files / 902 tests. Database suite is 12 files / 90 passed / one existing skipped. A real 100-contender Postgres test admits one hold, rejects 99 competing holds, and confirms one active claim. In this protocol contention is resolved before the name/confirmation step.

Chromium: the frozen full run passed 133 of 135 cases and exposed two family-form label collisions. Guest controls now mount only after explicit sharing and use the distinct Guest square numbers label. The final targeted run passed all 11 guest and existing create/family journeys, including both previously failed cases. All 135 Chromium cases have therefore been verified across the full run and focused rerun; no claim of a single green 135-case command is made.

Design lint reports zero errors and five unchanged token warnings. Cloudflare Pages Functions compile successfully with the existing Wrangler dependency. Phone/desktop screenshots were inspected; keyboard/axe checks pass. The disconnected prototype is absent from production output.

Independent Sol cross reviews found and helped close stale viewer snapshots, stale organizer revisions, owner-release reclamation, empty-hold revision churn, expired reactivation copy, seller-specific hold attribution, delayed guest response ordering, and invalidation flooding. The orchestrator reviewed the fixes and evidence. Hosted public broadcast permissions/amplification, connected p95 latency and physical LTE timing remain release-environment checks in `docs/guest-invites-operations.md`; they are not locally certified.

No commit, push, production migration, configuration change or deployment occurred. The original dirty checkout was not used for implementation. Local review entry: `http://127.0.0.1:5199/dev/guest-invites`.

Additional final check: all seven guest journeys passed in the emulated phone-WebKit project.
