---
writing-plans: 1
title: GridOne Product-Quality Production Implementation Plan
status: implementation-ready plan, not approved for implementation
created: 2026-08-20
repository: /Users/amm13/00-Projects/parkside/gridone-app
scope: planning only
allowed_write: docs/plans/2026-08-20-gridone-product-quality-implementation.md
---

# GridOne Product-Quality Production Implementation Plan

> **For Hermes:** After Anthony explicitly approves implementation, use subagent-driven-development to execute one verified slice at a time. Until that approval, this file is planning authority only. Require specification compliance, code-quality review, rendered evidence, and every stated approval gate before advancing.

**Goal:** Turn the accepted C1 viewer, B2 organizer, and A1 homepage directions into a production-quality, accessible, reversible GridOne product without changing commercial, permission, scoring, money-handling, or public-trust contracts.

**Architecture:** Establish deterministic guardrails first, then build independently reversible `viewer_v2`, `organizer_v2`, and `homepage_v2` vertical slices over the existing server contracts. Extract real feature seams before any mechanical migration into `src/`; preserve legacy surfaces as rollback targets until pilot evidence passes.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Vitest, Playwright, Cloudflare Pages Functions/Workers, Supabase/PostgreSQL/RLS, Stripe Checkout, server-side scoring provider integration, transactional email.

---

## 0. Non-negotiable contract preservation

This plan implements the accepted C1 viewer, B2 organizer, and A1 homepage decisions as small, behavior-preserving vertical slices. It does not authorize implementation, deployment, dependency changes, schema mutation, pricing changes, or broad repository migration.

Explicitly preserved contracts:

- Pricing: Free = 1 published board per account per season; Game Day = $9.99 one-time for up to 5 published boards in the 2026 season; Organization = $79 per season for up to 50 published boards, organization naming, one dashboard, and one organization receipt. Payment gates published-board count only. It never gates live scoring, scenarios, Find My Squares, winner email, QR/share, or viewer quality on an activated board.
- Permissions: one signed-in organizer owns and edits each board at launch; public viewers need no account and cannot edit; owner-only metadata, Stripe identifiers, audit history, seller labels, paid status, purchaser emails, verification state, and service credentials remain private.
- Score authority: automatic Gemini/Search scoring remains server-side beta with validated matchup/state/score/period/provenance/freshness; manual override is canonical until organizer deliberately returns to automatic; stale or older automatic data cannot overwrite manual or newer canonical data.
- No-money handling: GridOne tracks purchaser names, seller attribution, payout descriptions, and paid/unpaid status, but never collects square money, holds funds, adjudicates off-platform payments, or pays winners.
- Fixed axes: launch boards use one fixed top/side 0-9 permutation set. No per-quarter axes for new published boards. Before removing dynamic-axis UI, count existing published dynamic-axis snapshots; if any exist, stop and write an explicit legacy-preservation plan.
- Open-square behavior: publish may proceed with at least one assigned square only after explicit open-square acknowledgement. If a milestone lands on an open square, resolve as `Open square — see board rules`, send no winner email, do not roll over, do not invent a winner, preserve score digits/coordinate/milestone/timestamp.
- Correction behavior: published sold-square label changes and milestone corrections require viewer-visible audit with before value, after value, timestamp, organizer identity, expected revision/version, and reason. Private payment/seller/contact edits never appear in public correction history.
- North-star: Successful Game-Day Board Runs through Final = published/public board, committed axes, authoritative automatic or manual scoring, durable Q1/Halftime/Q3/Final resolution, no unresolved integrity/publication/score-authority failure.

## 1. Current technical map used by this plan

Existing high-risk seams:

- Viewer route/composition: `components/BoardView.tsx` orchestrates loading, owner/preview modes, selection persistence, `FindSquaresModal`, and `GameDayHorizon`.
- Viewer monolith: `components/GameDayHorizon.tsx` owns score instrument, scenarios, selected-player state rendering, grid placement, winner history, payouts/rules, and notification opt-in.
- Board instrument: `components/BoardGrid.tsx` renders table grid, axis selection for legacy dynamic boards, current/past/personal/scenario highlights, but still exposes dynamic quarter UI when `board.isDynamic` is true.
- Organizer monolith: `components/AdminPanel.tsx` is ~2350 lines and mixes draft save, bulk assignment, game picker, number draw, pricing/checkout, preview, manual scoring, payout editing, open-square assignment, correction, share/export, and visual violations.
- Existing organizer progress helper: `utils/organizerFlow.ts` is too coarse: `fill | draw | preview | live`, no explicit Create Draft/Reconcile/Go Live/Game Day/Final model.
- Server publication gate: `functions/api/pools/[id]/publish.ts` already validates owner, axes, 100 cells, at least one assignment, open-square acknowledgement, single name per square, entitlement, and fixed public board `isDynamic: false`.
- Manual scoring authority: `functions/api/pools/[id]/score/manual.ts` owns manual enable/commit/return-to-automatic endpoints.
- Tests already covering core behavior include `tests/winnerLogic.test.ts`, `tests/numberDraw.test.ts`, `tests/openSquaresOrganizerContract.test.ts`, `tests/openSquaresEndpoint.test.ts`, `tests/publishedSquareRename.integration.test.ts`, `tests/milestoneConfirmation*.test.ts`, `tests/manualScoringMode.test.ts`, `tests/manualScoringUiState.test.ts`, `tests/pricingCopyConsistency.test.ts`, `tests/publishEntitlementEndpoint.test.ts`, `tests/publicBoardVisibility.test.ts`, `tests/findSquaresModal.test.tsx`, `tests/customerFlowFixes.test.tsx`, `playwright-tests/user-workflows.spec.ts`, and `playwright-tests/phase5-accessibility.spec.ts`.

No broad `move-to-src` occurs until real feature seams exist. Current production source remains in `components/`, `pages/`, `hooks/`, `utils/`, `services/`, and `functions/` until a mechanical migration can be verified without behavior changes.

## 2. Preflight and protected-work rules for every implementation session

Before any implementation slice:

1. Run `git status --short`.
   - Expected outcome: implementer sees the exact dirty/untracked inventory.
   - If untracked files exist, treat them as protected user work. Do not delete, move, format, rename, stage, or overwrite them.
   - If tracked files are already modified outside the slice, stop unless Anthony explicitly approves working on top of them.
2. Create or update root `AGENTS.md` and create `docs/REFACTOR_LOG.md` in the first implementation slice.
   - Root `AGENTS.md` points AI tools to `PRODUCT.md`, `DESIGN.md`, `docs/`, the feature-boundary conventions, protected-file rules, and verification commands; it does not duplicate those documents.
   - `docs/REFACTOR_LOG.md` is the guardrail log for every extraction/move/seam.
   - Required fields per entry: date, slice id, files touched, behavior intended to remain identical, tests run before, tests run after, rendered QA captured, rollback path, reviewer/approver.
   - The log is append-only except typo fixes. It is not a dumping ground for generic notes.
3. Do not touch production source without a failing or characterization test created first.
4. No dependency/package changes unless a later approved slice explicitly adds an audit tool. If a dependency is needed for accessibility automation or design audit, that is its own commit with approval.
5. No production schema mutation. Additive migrations are allowed only after a separate data contract and rollback review. Destructive migrations are prohibited.
6. No commit/deploy unless separately approved. This plan defines commit boundaries; it does not authorize committing.

Baseline commands before Slice 1:

```bash
npm run test:unit
npm run test:integration
npm run build
npx playwright test
```

Expected outcomes:

- Unit and build pass.
- Integration may require local Docker/Postgres; if unavailable, record the environment blocker in `docs/REFACTOR_LOG.md` and run all non-container suites.
- Playwright Chromium/WebKit pass or known pre-existing failures are recorded with screenshots/traces.
- Formal DESIGN.md lint is deferred until Slice 1 receives explicit approval to pin the tool in `package.json`/`package-lock.json`; do not use unlocked `npx -y` execution as a baseline shortcut.

## 3. Feature-flag architecture

Add exactly three independently reversible flags:

- `viewer_v2`
- `organizer_v2`
- `homepage_v2`

Initial files:

- New: `utils/featureFlags.ts`
- New tests: `tests/featureFlags.test.ts`
- Later optional server/env adapter: `functions/_lib/featureFlags.ts`

Rules:

- Defaults off in production.
- Server/environment-controlled eligibility; client query parameters cannot enable production mutation paths.
- Allow board/account allowlists for internal and pilot cohorts.
- Variant is exposed to support and privacy-minimal instrumentation as `feature_flag_variant`.
- Old and new surfaces share the same server contracts during rollout.
- Rollback = disable the affected flag only; routes, share codes, score state, milestone history, notification state, and published snapshots remain untouched.
- Each flag has owner, default, expiry/removal condition, and removal gate after stable adoption.

Tests before implementation:

- `tests/featureFlags.test.ts`: default-off, env parsing, allowlist behavior, no query-param production enable, stable variant label.
- Browser smoke later confirms `/`, `/b/:shareCode`, `/boards/:boardId`, `/create`, and `/dashboard` route to current surfaces when flags are off.

## 4. Slice sequence

### Slice 1 — Safety rails, refactor log, design audit skeleton

Purpose: add deterministic enforcement before visual/source changes.

Files:

- New: root `AGENTS.md`
- New: `docs/REFACTOR_LOG.md`
- New: `scripts/design-audit.mjs`
- New tests: `tests/designAudit.test.ts`
- Modify only after explicit Anthony approval: `package.json` and `package-lock.json` to pin an exact reviewed `@google/design.md` devDependency and add `design:audit` plus `design:lint` scripts

Approval gate inside this slice:

- Stop before changing package files until Anthony approves the exact package/version and lockfile change.
- If approval is not granted, land only the local deterministic `node scripts/design-audit.mjs` path and defer `design:lint`; do not download/execute an unlocked package.
- No later slice may begin while required `design:audit` / `design:lint` gates are unavailable. If Anthony declines the package/lockfile change, amend and re-review this plan before continuing.

Test-first work:

- Create `tests/designAudit.test.ts` asserting the audit fails on fixture strings containing raw hex/RGB/HSL outside token files, default framework color classes in production components, gradient/blur/glow, arbitrary shadow/radius utilities, and forbidden `glass`/`glow` alias consumption.
- Then implement `scripts/design-audit.mjs` as zero-LLM deterministic scanning.

Allowlist format:

```text
file: exact path
pattern: exact regex/string
reason: product/accessibility/third-party necessity
owner: named owner
expires: date or removal condition
```

Commands:

```bash
npm run test:unit -- tests/designAudit.test.ts
node scripts/design-audit.mjs
npm run design:lint
```

Expected outcome:

- Test fails before script implementation, then passes.
- Audit may initially fail on known violations in `components/AdminPanel.tsx` and `src/index.css`; record them in `docs/REFACTOR_LOG.md` with exact removal slices. Do not suppress with blanket allowlists.

Commit boundary: `safety: add refactor log and deterministic design audit`.

Rollback: remove `scripts/design-audit.mjs`, `tests/designAudit.test.ts`, package script if added, and the corresponding log entry. No domain state affected.

### Slice 2 — Accessibility automation expansion

Purpose: automate contract checks without pretending automation proves conformance.

Files:

- Modify: `playwright.config.ts` to add phone projects and, when stable, Firefox before whole-app release.
- New: `playwright-tests/accessibility-contract.spec.ts`
- New: `tests/accessibilityHelpers.test.ts` if static helpers are introduced.
- Optional new helper: `tests/helpers/accessibility.ts`

Required automated states:

- signed-out login/signup errors
- empty/partial organizer Fill
- Reconcile advisory items
- Draw confirmation
- Preview and Go Live dialogs
- save conflict/error
- viewer unpersonalized/personalized
- stale/offline/manual
- Find My Squares dialog
- board keyboard navigation
- pending/corrected/OPEN/Final record

Test-first work:

- Add Playwright assertions for semantic route headings, visible focus, dialog focus trap/return, one-tab-stop board grid target, 44x44 controls, no page overflow at 320px except board viewport, reduced-motion content preservation, and forced-colors boundary preservation where reliable.

Commands:

```bash
npx playwright test playwright-tests/accessibility-contract.spec.ts --project=chromium
npx playwright test playwright-tests/accessibility-contract.spec.ts --project=webkit
npm run test:unit
npm run build
```

Expected outcome:

- New tests fail only where known implementation gaps exist; mark failing assertions as `test.fixme` with owner/removal condition only if they block incremental merging. Serious/critical accessibility violations cannot be ignored at release gate.

Commit boundary: `test: expand accessibility contract automation`.

Rollback: remove new Playwright spec/config additions; no product behavior affected.

### Slice 3 — Reversible feature flags and legacy-route smoke

Purpose: establish rollback controls before any v2 surface or primitive migration can ship.

Files:

- New: `utils/featureFlags.ts`
- New tests: `tests/featureFlags.test.ts`
- New: `playwright-tests/feature-flags-off.spec.ts`
- Optional only if server-owned cohort resolution is required and separately approved: `functions/_lib/featureFlags.ts`

Test-first work:

- Default all flags off when configuration is absent or malformed.
- Parse only explicit `viewer_v2`, `organizer_v2`, and `homepage_v2` configuration.
- Support bounded board/account allowlists without exposing private identifiers publicly.
- Prove query parameters cannot enable production mutation paths.
- Expose a stable variant label for support/privacy-minimal telemetry.
- Characterize current routes before v2 code exists: `/`, `/demo`, `/b/:shareCode`, `/boards/:boardId`, `/create`, and `/dashboard` remain on legacy surfaces with every flag off.

Commands:

```bash
npm run test:unit -- tests/featureFlags.test.ts
npx playwright test playwright-tests/feature-flags-off.spec.ts --project=chromium
npx playwright test playwright-tests/feature-flags-off.spec.ts --project=webkit
npm run build
```

Expected outcome:

- Tests fail before the flag module exists, then pass.
- All three flags default off.
- Legacy route behavior remains unchanged.
- No production environment variable is added or enabled during this slice.

Commit boundary: `flags: add reversible viewer organizer homepage flags`.

Rollback: revert the flag module/tests. Since v2 consumers do not exist yet, no domain or route state changes.

### Slice 4 — Universal primitives only where real reuse exists

Purpose: stop duplicating button/input/dialog/status behavior without building a speculative component library.

Allowed global primitives only after two or more real consumers are identified:

- New: `components/primitives/ActionButton.tsx`
- New: `components/primitives/Field.tsx`
- New: `components/primitives/Dialog.tsx`
- New: `components/primitives/StatusLabel.tsx`
- New: `components/primitives/Disclosure.tsx`
- New tests: `tests/primitives.test.tsx`

Rules:

- No `components/primitives/GridOneEverything.tsx` garbage pile.
- Feature-specific composition remains inside feature folders once they exist.
- Primitives consume semantic CSS variables/Tailwind aliases only.
- Primitives include state semantics: rest, hover, focus-visible, pressed, disabled, loading, success, warning, error, stale/offline, destructive confirmation.

Commands:

```bash
npm run test:unit -- tests/primitives.test.tsx
npm run design:audit
npm run build
npx playwright test playwright-tests/phase5-accessibility.spec.ts
```

Expected outcome:

- Existing Login/FindSquares/AdminPanel consumers still render equivalent labels and semantics.
- No pricing, permission, score, or route behavior changes.

Commit boundary: `ui: add governed primitives for real cross-feature reuse`.

Rollback: revert primitive files and consumer substitutions in this slice only.

### Slice 5 — C1 viewer domain decomposition under `viewer_v2`, no visible behavior change first

Purpose: extract viewer computation from `GameDayHorizon.tsx` before changing hierarchy.

Files:

- New: `features/viewer/score/viewerScoreModel.ts`
- New: `features/viewer/identity/viewerIdentityModel.ts`
- New: `features/viewer/scenarios/scenarioModel.ts`
- New: `features/viewer/milestones/milestoneViewModel.ts`
- New tests: `tests/viewerScoreModel.test.ts`, `tests/viewerIdentityModel.test.ts`, `tests/scenarioModel.test.ts`, `tests/milestoneViewModel.test.ts`
- Existing read/modify later: `components/GameDayHorizon.tsx`, `components/BoardView.tsx`, `components/board/FindSquaresModal.tsx`

Test-first behavior:

- Scenario model covers +2/+3/+6/+7/+8 for either team, current-quarter only, arithmetic outcomes not probabilities, stale/offline last-known handling, no usable score, and Final suppression.
- Identity model resolves durable `participant.id` when available, handles duplicate/ambiguous display labels, restores only valid saved selection, clears invalid saved selection with explanation, and never matches a different person silently.
- Milestone model preserves OPEN and corrected states exactly.
- Score model names Live/Pregame/Manual/Refreshing/Stale/Offline/Rejected/Final and `Score updates about every minute`.

Commands:

```bash
npm run test:unit -- tests/viewerScoreModel.test.ts tests/viewerIdentityModel.test.ts tests/scenarioModel.test.ts tests/milestoneViewModel.test.ts
npm run test:unit -- tests/findSquaresModal.test.tsx tests/customerFlowFixes.test.tsx tests/publicBoardVisibility.test.ts tests/pollingDisclosure.test.ts
npm run build
```

Expected outcome:

- Models pass without UI behavior change.
- Existing viewer tests still pass with `viewer_v2` off.

Commit boundary: `viewer: extract domain models behind current surface`.

Rollback: revert model imports and files; `viewer_v2` remains off.

### Slice 6 — C1 viewer shell and first-viewport hierarchy

Purpose: implement accepted C1 Personal Summary Stack behind `viewer_v2`.

Files:

- New: `features/viewer/shell/ViewerShell.tsx`
- New: `features/viewer/score/ScoreInstrument.tsx`
- New: `features/viewer/identity/FindSquaresEntry.tsx`
- New: `features/viewer/personal/YourSquaresSummary.tsx`
- New: `features/viewer/scenarios/ScenarioDisclosure.tsx`
- New: `features/viewer/notifications/WinnerEmailDisclosure.tsx`
- New: `features/viewer/details/BoardDetailsDisclosure.tsx`
- Modify: `components/BoardView.tsx` to choose legacy `GameDayHorizon` or `ViewerShell` by `viewer_v2`.
- Keep: `components/GameDayHorizon.tsx` as rollback surface.

C1 decomposition acceptance:

- Unpersonalized phone 390x844 first viewport: board title/matchup, score/current result, score authority/freshness, `Score updates about every minute`, `Find my squares`; no payout/rules block above Find My Squares; no `me` language.
- Personalized first viewport: selected display name/count, coordinate/digit rows, `View on board`, personal current status, matching next-score result or explicit none state; email form does not precede personal summary.
- Pregame/no score: no ten inert scenario rows.
- Live/unselected: all outcomes collapsed.
- Live/selected: matching outcomes first; all outcomes secondary; statement that outcomes are arithmetic, not odds/predictions.
- Stale/offline: scenario section states it uses last-known data checked at time.
- Final: no next-score scenarios; Final record replaces future-looking section.
- Notification opt-in appears only for selected durable participant on published services; hidden in private preview/unpublished; never for OPEN outcomes.

Tests before implementation:

- New: `tests/viewerShell.test.tsx`
- New/modify: `playwright-tests/viewer-v2.spec.ts`

Commands:

```bash
npm run test:unit -- tests/viewerShell.test.tsx tests/scenarioModel.test.ts tests/viewerIdentityModel.test.ts
npx playwright test playwright-tests/viewer-v2.spec.ts --project=chromium
npx playwright test playwright-tests/viewer-v2.spec.ts --project=webkit
npm run design:audit
npm run build
```

Rendered QA:

- Capture phone 320px, 390x844, desktop, 200% text, 400% zoom, reduced motion, forced colors.
- States: loading, invalid/unpublished, defensive empty, pregame, live unselected, live selected, stale, offline, rejected, manual, pending milestone, corrected, OPEN, Final.

Commit boundary: `viewer: add C1 viewer shell behind viewer_v2`.

Rollback: disable `viewer_v2`; legacy `GameDayHorizon` remains route target.

### Slice 7 — Exact grid accessibility and fixed-axis launch guard

Purpose: make the board a real navigable instrument and prevent silent dynamic-axis flattening.

Files:

- Modify: `components/BoardGrid.tsx` or new `features/viewer/board/ViewerBoardGrid.tsx` if replacement is cleaner behind `viewer_v2`.
- New: `features/viewer/board/boardGridModel.ts`
- New tests: `tests/boardGridModel.test.ts`, `tests/viewerBoardGrid.test.tsx`
- Optional server/admin preflight script later: `scripts/count-dynamic-published-boards.mjs` only after approval; do not connect to production without approval.

Requirements:

- One-tab-stop roving-focus data-grid navigation: arrow keys, Home/End, Ctrl+Home/Ctrl+End.
- Sticky top axis during vertical movement and sticky side axis during horizontal movement.
- External orientation cue: `Top: [team]`, `Side: [team]`.
- Pan/zoom controls: zoom out, current zoom, zoom in, reset/fit, find, center selected; all 44x44.
- Cell accessible name includes assignment/open state, coordinate, top/side digits, milestone/current/corrected state.
- Personal selection, current winner, resolved winner, OPEN, and correction are visually and semantically distinct.
- If preflight finds existing published dynamic-axis boards, stop. Do not remove quarter selector or reinterpret axes until a legacy plan exists.

Commands:

```bash
npm run test:unit -- tests/boardGridModel.test.ts tests/viewerBoardGrid.test.tsx
npx playwright test playwright-tests/viewer-v2.spec.ts --grep "board"
npm run build
```

Commit boundary: `viewer: implement accessible fixed-axis exact grid`.

Rollback: disable `viewer_v2`; no snapshot/domain data changes.

### Slice 8 — Organizer extraction starts with manual scoring, not a new shell

Purpose: reduce `AdminPanel.tsx` risk at the lowest domain seam already backed by APIs/tests.

Files:

- New: `features/organizer/game-day/manualScoringModel.ts`
- New: `features/organizer/game-day/ManualScoringPanel.tsx`
- Modify: `components/AdminPanel.tsx` to delegate manual scoring UI only.
- Existing APIs unchanged: `functions/api/pools/[id]/score/manual.ts`
- Tests: `tests/manualScoringMode.test.ts`, `tests/manualScoringUiState.test.ts`, new `tests/manualScoringPanel.test.tsx`

Test-first behavior:

- Enable manual authority, seed from latest automatic/manual snapshot, validate period/state/quarter scores, commit manual score, display organizer-entered authority, return to automatic only deliberately, never let stale automatic overwrite manual/newer canonical data.

Commands:

```bash
npm run test:unit -- tests/manualScoringMode.test.ts tests/manualScoringUiState.test.ts tests/manualScoringPanel.test.tsx
npm run build
```

Expected outcome:

- Manual scoring behavior identical; smaller component seam exists.

Commit boundary: `organizer: extract manual scoring panel from AdminPanel`.

Rollback: inline legacy AdminPanel section back; API untouched.

### Slice 9 — Organizer lifecycle/draft model, still legacy UI

Purpose: create exact B2 state machine before drawing the B2 shell.

Files:

- New: `features/organizer/lifecycle/organizerLifecycle.ts`
- New: `features/organizer/draft/draftSaveModel.ts`
- Modify or replace: `utils/organizerFlow.ts` only as compatibility adapter.
- Tests: `tests/organizerLifecycle.test.ts`, `tests/draftSaveModel.test.ts`

Model must include:

- Create Draft, Fill, Reconcile, Draw, Preview, Go Live, Game Day, Final Record.
- Save states: clean, dirty, saving, save_failed, conflicted, recovered.
- Hard blockers vs advisories.
- Duplicate/ambiguous participant identity as hard blocker; unpaid/unknown and seller gaps as advisory.
- Open-square acknowledgement requirement.
- No publish while dirty/saving/failed/conflicted.
- Go Live is one-time transition; Game Day is persistent operating mode.

Commands:

```bash
npm run test:unit -- tests/organizerLifecycle.test.ts tests/draftSaveModel.test.ts tests/organizerFlow.test.ts tests/organizerPersistence.test.tsx
npm run build
```

Commit boundary: `organizer: add lifecycle and draft save models`.

Rollback: legacy `utils/organizerFlow.ts` remains compatibility path.

### Slice 10 — B2 organizer shell behind `organizer_v2`, phase by phase

Purpose: implement Task Header + Contextual Progress Disclosure without breaking legacy AdminPanel.

Files by phase:

- New shell: `features/organizer/shell/OrganizerShell.tsx`
- New header: `features/organizer/shell/TaskHeader.tsx`
- New disclosure: `features/organizer/lifecycle/ProgressDisclosure.tsx`
- Fill: `features/organizer/assignment/AssignmentWorkspace.tsx`
- Reconcile: `features/organizer/reconcile/ReconcileChecklist.tsx`
- Draw: `features/organizer/draw/DrawWorkspace.tsx`
- Preview: `features/organizer/preview/ViewerPreviewWorkspace.tsx`
- Publish: `features/organizer/publish/PublishReviewDialog.tsx`
- Game Day: `features/organizer/game-day/GameDayControls.tsx`
- Corrections: `features/organizer/corrections/CorrectionFlow.tsx`
- Modify: `components/BoardView.tsx` or `components/AdminPanel.tsx` to route organizer owners to `OrganizerShell` only when `organizer_v2` is enabled.
- Keep: `components/AdminPanel.tsx` as rollback surface until v2 is default and stable.

Implementation order inside this slice family:

1. Shell/header/progress disclosure with no domain writes.
2. Fill assignment workspace.
3. Reconcile checklist.
4. Draw preview/commit/replace draft draw.
5. Exact private viewer preview.
6. Publish review dialog/Go Live transition.
7. Game Day controls: viewer link, score authority, notification delivery issues, open-square fill before kickoff.
8. Corrections: public label and milestone correction flows.
9. Final Record.

B2 acceptance:

- Sticky header shows board name, current lifecycle phase, save state/revision/time, one primary action, conflict/error state.
- Progress disclosure closed by default on phone; no permanent phase rail; no Overview/Edit/Preview tab resurrection.
- One dominant artifact and one primary action per phase.
- Reconcile clearly labels private/advisory payment/seller issues and hard blockers.
- Draw primary action contract: before preview exists `Preview draw`; after preview exists `Commit draw`; `Regenerate preview` secondary; draft redraws allowed before publication.
- Conflict blocks phase progression until reload/recovery.
- Phone uses native scrolling; board owns horizontal viewport; no page-level overflow.

Tests before implementation:

- New: `tests/organizerShell.test.tsx`
- New: `playwright-tests/organizer-v2.spec.ts`
- Extend existing `tests/openSquaresOrganizerContract.test.ts`, `tests/payoutEditorContract.test.ts`, `tests/publishedSquareRename.integration.test.ts`, `tests/organizerPersistence.test.tsx` as needed before code changes.

Commands:

```bash
npm run test:unit -- tests/organizerLifecycle.test.ts tests/draftSaveModel.test.ts tests/organizerShell.test.tsx
npm run test:unit -- tests/openSquaresOrganizerContract.test.ts tests/payoutEditorContract.test.ts tests/manualScoringUiState.test.ts
npx playwright test playwright-tests/organizer-v2.spec.ts --project=chromium
npx playwright test playwright-tests/organizer-v2.spec.ts --project=webkit
npm run design:audit
npm run build
```

Commit boundaries:

- `organizer: add B2 shell behind organizer_v2`
- `organizer: migrate Fill workspace behind organizer_v2`
- `organizer: migrate Reconcile checklist behind organizer_v2`
- `organizer: migrate Draw workflow behind organizer_v2`
- `organizer: migrate Preview and Go Live behind organizer_v2`
- `organizer: migrate Game Day controls behind organizer_v2`
- `organizer: migrate corrections and Final record behind organizer_v2`

Rollback: disable `organizer_v2`; legacy `AdminPanel.tsx` remains available. Durable draft/published state stays server-owned and unchanged.

### Slice 11 — Privacy-minimal instrumentation and first-ten-board baseline

Purpose: observe rollout without collecting private board/contact data.

Files:

- New: `features/instrumentation/eventSchema.ts`
- New: `features/instrumentation/clientEvents.ts`
- New: `functions/api/events.ts` only after approval of storage/retention
- New tests: `tests/instrumentationSchema.test.ts`, optional `tests/eventsEndpoint.test.ts`
- Modify Terms/Privacy only after actual instrumentation is approved and exact collection is known.

Permitted event families:

- Homepage primary/secondary action
- Organizer phase entered/completed
- Find My Squares opened/resolved/no-match
- Personalized scenario disclosure
- View/center selected square
- Grid interaction mode
- Notification form opened
- Recoverable UI failure code
- Coarse performance timing

Prohibited event payload:

- display/purchaser names, seller/parent labels, emails, notification tokens, payout/rules text, uploaded images, raw score-provider payloads, full URLs with query values, free-form errors, cross-site IDs, fingerprinting.

First-ten-board baseline:

- Do not set improvement targets before collecting baseline evidence.
- Qualitative baseline: five target-organizer sessions, five phone-viewer sessions, first ten eligible real fundraiser boards, with approval before any user outreach or real production analytics.
- Every pilot board has named internal owner through Final.

Commands:

```bash
npm run test:unit -- tests/instrumentationSchema.test.ts
npm run build
```

Expected outcome:

- Event schema rejects prohibited fields and unknown event names.
- Client delivery is non-blocking; analytics failure never blocks board inspection, publication, score, or notification tasks.

Commit boundary: `instrumentation: add privacy-minimal event schema`.

Rollback: disable event endpoint/client sending; server-owned domain facts remain.

### Slice 12 — A1 homepage last, using real artifacts

Purpose: replace film-as-entrance only after C1 and B2 production components exist.

Files:

- New: `features/homepage/HomepageV2.tsx`
- New: `features/homepage/HomepageProofArtifact.tsx`
- Modify: `App.tsx` root route chooses `HomepageV2` only when `homepage_v2` enabled; `FilmLanding` remains optional/rollback.
- Keep: `components/FilmLanding.tsx` and `components/filmLanding.css` isolated unless/until optional story route is approved.
- Tests: `tests/homepageV2.test.tsx`, `playwright-tests/homepage-v2.spec.ts`, extend `tests/pricingCopyConsistency.test.ts`.

A1 acceptance:

- First viewport at 390x844 and desktop shows GridOne identity, `Football-squares fundraiser boards`, product promise/outcome, `Create your free board`, `See a live board`, `First published board free`, no-money-handling boundary, and visible synthetic product proof using accepted B2 organizer artifact by default.
- Viewer proof switches in place using accepted C1 hierarchy.
- No loader, film gate, scroll instruction, Lenis/GSAP critical path, fake customer proof, invented fundraising totals, or betting visual language.
- Pricing section uses canonical 2026 contract.
- Optional story is explicit, skippable, reduced-motion complete, and cannot affect organizer/viewer scrolling or bundles.

Commands:

```bash
npm run test:unit -- tests/homepageV2.test.tsx tests/pricingCopyConsistency.test.ts
npx playwright test playwright-tests/homepage-v2.spec.ts --project=chromium
npx playwright test playwright-tests/homepage-v2.spec.ts --project=webkit
npm run design:audit
npm run build
```

Commit boundary: `homepage: add A1 product-first homepage behind homepage_v2`.

Rollback: disable `homepage_v2`; legacy `FilmLanding` remains root route.

### Slice 13 — Source-to-src mechanical migration only after feature seams exist

Purpose: normalize project structure after, not before, real seams.

Preconditions:

- `features/viewer/*`, `features/organizer/*`, `features/homepage/*`, and real primitive seams exist.
- `viewer_v2`, `organizer_v2`, and `homepage_v2` have passed pilot gates or are safely off.
- No untracked/protected user files are in target paths.
- Import graph is stable and covered by tests.

Allowed mechanical moves:

- `features/` -> `src/features/`
- `components/primitives/` -> `src/components/primitives/`
- Stable shared helpers -> `src/utils/` only when already shared.
- Existing route files move only if imports are mechanical and covered.

Prohibited:

- No behavior changes in migration commits.
- No opportunistic redesign.
- No renaming product vocabulary unless covered by a vocabulary test and specific contract.
- No package/dependency drift.

Commands before and after mechanical move:

```bash
npm run test:unit
npm run test:integration
npm run build
npx playwright test
npm run design:audit
npm run design:lint
```

Expected outcome:

- Identical behavior and passing gates before/after. Any failure means revert the mechanical move; do not debug by changing product behavior inside the move commit.

Commit boundary: `refactor: mechanically move established feature seams under src`.

Rollback: revert the move commit. Since it is mechanical, rollback is clean or the commit was botched.

## 5. Integration, E2E, and rendered QA matrix

Required whole-journey checks before any production pilot:

- Create draft -> Fill at least one square -> Reconcile -> acknowledge open squares -> secure draw -> preview -> publish -> open viewer -> operate score authority -> resolve Q1/Halftime/Q3/Final -> verify Final Record.
- Viewer states: loading, invalid/unpublished/deleted, defensive empty, pregame, live unselected, live selected, stale, offline, rejected, manual, pending, resolved, corrected, OPEN, Final.
- Organizer states: empty draft, partial fill, duplicate identity hard blocker, unpaid/seller advisory, save dirty/saving/failed/conflict/recovered, draw preview/commit/replace, private preview, Go Live confirmation, checkout allowance exceeded, game-day manual scoring, open-square fill before kickoff, correction, Final.
- Rendered widths/modes: 320px, 390x844, desktop 1280x720, 200% text, 400% zoom, reduced motion, forced colors, keyboard-only, touch phone.
- Browsers: Chromium and WebKit every stage; Firefox added before whole-app release unless documented environment blocker remains.
- Assistive tech before release: VoiceOver + Safari/macOS or iOS-class behavior; NVDA + Chrome/Firefox on Windows when available; disclose gaps honestly.

Recommended command bundle:

```bash
npm run design:audit
npm run design:lint
npm run test:unit
npm run test:integration
npm run build
npx playwright test
```

Expected outcome: all pass, or every failure is classified as pre-existing/non-blocking with owner and removal condition. P0/P1 accessibility, privacy, permission, scoring, pricing, or publication failures block release.

## 6. Production approval gates

Anthony approval is required before:

- Installing dependencies or changing package manager files.
- Creating or applying any migration.
- Connecting instrumentation to production storage or activating analytics collection.
- Editing Terms/Privacy for actual collection terms.
- Running against production Supabase/Stripe/email/Gemini/Cloudflare environments.
- Deploying to Cloudflare Pages or changing environment variables.
- Enabling any feature flag for real users beyond internal/local fixtures.
- Contacting users or running real organizer/viewer sessions.
- Making v2 surfaces default.
- Removing rollback surfaces/flags.

Release go/no-go gate requires:

- No unintended pricing, permissions, score authority, notification, no-money-handling, correction, fixed-axis, open-square, or schema drift.
- Feature flag rollback rehearsed.
- Domain state preserved under rollback.
- Design audit and DESIGN.md lint pass.
- Accessibility automation and required manual checks pass or have explicit approved exceptions.
- Rendered QA evidence for phone/desktop states exists.
- First-ten-board baseline plan approved before real cohort expansion.

## 7. Rollback plan

UI rollback:

- Disable `viewer_v2`, `organizer_v2`, or `homepage_v2` independently.
- Return users to legacy `GameDayHorizon`, `AdminPanel`, or `FilmLanding` surfaces.
- Preserve `/`, `/demo`, `/b/:shareCode`, `/boards/:boardId`, `/create`, `/dashboard` routes.
- Preserve public snapshots, score snapshots, milestone history, notification state, entitlements, share codes, and draft revisions.

Data rollback:

- Avoid needing it. Use no destructive migration.
- If future additive normalized participant/assignment changes become necessary, deploy read compatibility first, bounded dual-read/write second, reconciliation checks third, cutoff only after approval.
- Never mutate public snapshots silently to fit new UI.

Operational rollback:

- Stop cohort expansion.
- Mark affected events/metrics.
- Preserve logs/evidence.
- During live games, restoring trustworthy access outranks preserving a new interface.

## 8. Commit-boundary checklist

Each commit boundary must satisfy:

- One slice or sub-slice only.
- Tests created/updated before implementation.
- Commands run and logged in `docs/REFACTOR_LOG.md`.
- No protected untracked files touched.
- No unrelated formatting sweep.
- No broad `src` migration before seams.
- No pricing/permission/scoring/no-money/correction/open-square drift.
- Rollback path is one flag flip or one clean revert.

Recommended order:

1. `safety: add refactor log and deterministic design audit`
2. `test: expand accessibility contract automation`
3. `flags: add reversible viewer organizer homepage flags`
4. `ui: add governed primitives for real cross-feature reuse`
5. `viewer: extract domain models behind current surface`
6. `viewer: add C1 viewer shell behind viewer_v2`
7. `viewer: implement accessible fixed-axis exact grid`
8. `organizer: extract manual scoring panel from AdminPanel`
9. `organizer: add lifecycle and draft save models`
10. `organizer: add B2 shell behind organizer_v2`
11. `organizer: migrate Fill workspace behind organizer_v2`
12. `organizer: migrate Reconcile checklist behind organizer_v2`
13. `organizer: migrate Draw workflow behind organizer_v2`
14. `organizer: migrate Preview and Go Live behind organizer_v2`
15. `organizer: migrate Game Day controls behind organizer_v2`
16. `organizer: migrate corrections and Final record behind organizer_v2`
17. `instrumentation: add privacy-minimal event schema`
18. `homepage: add A1 product-first homepage behind homepage_v2`
19. `refactor: mechanically move established feature seams under src` only after approved preconditions.

## 9. Stop conditions

Stop implementation and ask for Anthony approval if any slice discovers:

- Existing published dynamic-axis boards.
- Required schema change or destructive migration pressure.
- Pricing mismatch between product docs, Terms, server pricing, checkout, or tests.
- Public/private boundary ambiguity.
- Score authority behavior that could show stale automatic data over manual/newer state.
- Existing untracked files in paths the slice needs to edit.
- Accessibility blocker that cannot be solved without changing product behavior.
- Need for new paid service, production credentials, external analytics, or deployment.

Proceeding through any stop condition without approval would be how amateurs ship expensive bugs with confidence. Do not do that.
