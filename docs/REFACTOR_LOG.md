# GridOne Refactor Log

Append one verified entry per implementation/refactor slice. Do not rewrite prior entries except to correct factual errors.

## 2026-08-21 — Slice 1 safety rails and deterministic design audit

- **Status:** Complete and verified. Root `AGENTS.md` was written only after Anthony temporarily disabled the protected-instruction-file gate, restarted Hermes, and then restored the gate to `true`.
- **Approval:** Anthony explicitly approved Slice 1, including exact `@google/design.md@0.4.0` and `package-lock.json` changes.
- **Behavior intended to remain identical:** No production component, route, API, schema, data, configuration, or deployment behavior changed. This slice adds repository instructions, deterministic audit tooling, tests, and scripts only.
- **Files touched:**
  - `tests/designAudit.test.ts`
  - `scripts/design-audit.mjs`
  - `docs/REFACTOR_LOG.md`
  - `package.json`
  - `package-lock.json`
  - `AGENTS.md`
- **Protected user work:** `.impeccable/`, `docs/gap-remediation-plan-2026-08-01.md`, and both untracked `docs/marketing/` files were not modified, moved, staged, or deleted.

### RED → GREEN evidence

The isolated worker generated the first test/script draft but could not execute commands. Anton did not claim that as TDD evidence.

1. **Recovery RED:** reset `scripts/design-audit.mjs` to an empty module, then ran:
   - `npm run test:unit -- tests/designAudit.test.ts`
   - Result: exit 1; 6/6 tests failed because `auditFiles` was missing.
2. **Recovery GREEN:** restored the minimal audit implementation and reran the focused command.
   - Result: exit 0; 6/6 passed.
3. **False-positive RED:** added characterization tests for canonical GridOne radius variables and comment text.
   - `npm run test:unit -- tests/designAudit.test.ts`
   - Result: exit 1; exactly 2 new tests failed while the prior 6 passed.
4. **False-positive GREEN:** preserved comment line positions while stripping comment content and corrected canonical radius matching.
   - Result: exit 0; 8/8 focused tests passed.
5. **Quality-review RED/GREEN:** independent review identified outside-root reads, symlink traversal, string-literal comment stripping, Tailwind variant misses, and unstable explicit-file ordering. Regression tests were added first; the audit now rejects escaped paths, skips symlinks, preserves comment-like content inside quoted/template strings and URLs, detects variant chains with precise utility locations, normalizes file errors, and sorts deterministic inputs.
   - Intermediate focused result: exit 0; 13/13 tests passed.
6. **Re-review RED/GREEN:** re-review identified prefixed arbitrary Tailwind variants and unquoted CSS URLs as remaining false negatives. Two regression tests failed first; variant-prefix parsing and URL-scheme handling were corrected.
   - Final focused result: exit 0; 15/15 tests passed.

### Dependency and scripts

- Installed exact reviewed dev dependency: `@google/design.md@0.4.0` with `--save-exact`.
- Added:
  - `npm run design:audit` → `node scripts/design-audit.mjs`
  - `npm run design:lint` → locked local `designmd lint DESIGN.md`
- `npm run design:lint`: exit 0; 0 errors, 0 warnings, 1 informational token summary.
- `npm audit --audit-level=moderate`: exit 1; 14 advisories (1 low, 1 moderate, 11 high, 1 critical). `npm audit --omit=dev --json` classifies 2 high advisories as production dependency findings; the remaining 12, including the critical Vitest advisory, are dev/tooling findings. No `npm audit fix` or unrelated package upgrade was run. Remediation requires a separate reviewed slice.

### Verification gates

- `npm run test:unit -- tests/designAudit.test.ts`: **15/15 passed**.
- `npm run test:unit`: **51 files, 322 tests passed**.
- `npm run build`: **passed**; TypeScript and Vite production build completed.
- Rendered QA: not applicable; no product UI changed.

### Deterministic repository audit baseline

`npm run design:audit` exits 1 as intended while baseline violations remain. After false-positive cleanup it reports **75 findings**:

- By rule:
  - `raw-visual-literal`: 45
  - `framework-default-color`: 11
  - `gradient-blur-glow`: 9
  - `forbidden-glass-glow-alias`: 7
  - `arbitrary-shadow-radius`: 3
- By file:
  - `components/filmLanding.css`: 47
  - `src/index.css`: 10
  - `utils/boardImage.ts`: 5
  - `components/seo/ArticleFAQ.tsx`: 3
  - `components/AdminPanel.tsx`: 2
  - `pages/RunYourPoolAlternative.tsx`: 2
  - `components/layout/Layout.tsx`: 1
  - `pages/ArticlesHub.tsx`: 1
  - `pages/DigitalFootballSquaresBoardVsPaper.tsx`: 1
  - `pages/FootballSquaresFundraiser.tsx`: 1
  - `pages/HowToRunSquares.tsx`: 1
  - `pages/OfficeSuperBowlSquares.tsx`: 1

These are recorded debt, not blanket-allowlisted. Production-source remediation is outside Slice 1.

### Rollback

Remove `tests/designAudit.test.ts`, `scripts/design-audit.mjs`, the two package scripts, the exact `@google/design.md` dev dependency/lockfile entries, and this log entry. No domain state is affected.

## 2026-08-22 — Slice 2 accessibility automation

- **Status:** Automation contract established, not release-complete. Current update corrects the SPEC gap by enumerating every required representative state in `playwright-tests/accessibility-contract.spec.ts` as either an active route/API-mocked browser contract or a precise owned `test.fixme`.
- **Files touched:** `playwright.config.ts` from the original Slice 2 pass; current gap-correction files were limited to `playwright-tests/accessibility-contract.spec.ts` and `docs/REFACTOR_LOG.md`.
- **Behavior intended to remain identical:** No production UI, package files, schemas, feature flags, protected untracked files, git state, external systems, commits, pushes, deployments, or credentials were modified.
- **Coverage established:** signed-out login/signup errors; empty/partial organizer Fill; Draw open-square confirmation; viewer unpersonalized and personalized modes; stale/offline/manual score authority; pending, corrected, OPEN, and Final viewer records; Find my squares dialog focus trap/Escape/return; board cell naming plus roving-focus contract; 320/390 phone overflow excluding the contained board viewport; reduced-motion content preservation; reliable forced-colors boundary/focus checks; homepage semantic/touch contracts.
- **Owned fixmes remaining until slices:** Slice 6 viewer owns future C1 first-viewport hierarchy semantics where legacy viewer ordering is insufficient; Slice 7 viewer owns exact-grid roving focus and cell-state semantics; Slice 10 organizer owns Reconcile advisories, Preview and Go Live dialogs, and save conflict/error blocking semantics; Slice 12 homepage owns product H1 and signed-out Sign in touch geometry. Each fixme states expected semantics and removal condition. These are not vague placeholders and must not be counted as release conformance.
- **Prior evidence:** original Slice 2 run completed `npx playwright test playwright-tests/accessibility-contract.spec.ts` with **22 passed and 14 skipped** across four projects after isolating verified owned gaps; `npm run test:unit` passed **51 files / 322 tests**; `npm run build` passed; `npm run design:lint` returned 0 errors and 0 warnings.
- **Current verification:** first expanded Chromium run exposed one stale organizer selector; after correcting it to the already-focused assignment state, Chromium passed **12 active / 7 owned skips**. Final four-project run passed **46 active / 30 skips**. The 30 skips are owned future-surface contracts repeated across projects plus the documented WebKit forced-colors compatibility skip; none count as release conformance. Existing unit/build/design-lint gates remain green from this slice.
- **Rollback:** revert the current `playwright-tests/accessibility-contract.spec.ts` and this log entry update. To roll back original Slice 2 entirely, remove `playwright-tests/accessibility-contract.spec.ts`, remove `phone-chromium`/`phone-webkit` projects from `playwright.config.ts`, and remove this log entry.

## 2026-08-22 — Dependency advisory remediation

- **Status:** Complete with one accepted low-severity dev-only residual advisory.
- **Files touched:** `package.json`, `package-lock.json`, `docs/REFACTOR_LOG.md`.
- **Behavior intended to remain identical:** no React, Supabase, Stripe, schema, route contract, or product-source behavior changed; upgrades stay within existing package major versions.
- **Exact direct upgrades:** `react-router-dom@7.18.2`, `@cloudflare/workers-types@5.20260822.1`, `postcss@8.5.26`, `vite@6.4.3`, `vitest@4.1.11`, `wrangler@4.125.0`.
- **Exact transitive overrides:** `picomatch@4.0.4`, `rollup@4.59.0`.
- **Blocked attempt:** initial Wrangler upgrade refused the existing Workers Types v4 peer dependency. No force/legacy-peer bypass was used; the compatible exact v5 peer was installed instead.
- **Audit result:** advisories reduced from 14 total (including 11 high and 1 critical) to one low `@babel/core` dev-only advisory. `npm audit --omit=dev --json` reports **0 production advisories**. No compatible patched Babel 7 exists; Babel 8 would require a separate major toolchain migration.
- **Verification:** `npm run design:lint` passed; `npm run test:unit` passed **51 files / 322 tests** under Vitest 4.1.11; `npm run build` passed under Vite 6.4.3; Chromium accessibility contract passed **12 active / 7 owned skips**.
- **Rollback:** revert the package and lockfile commit. No domain state is affected.

## 2026-08-22 — Slice 3 reversible feature flags

- **Status:** Complete and verified. The pure resolver and route-off smoke are not yet connected to production consumers; every flag therefore remains off by default.
- **Files touched:**
  - `utils/featureFlags.ts`
  - `tests/featureFlags.test.ts`
  - `playwright-tests/feature-flags-off.spec.ts`
  - `docs/REFACTOR_LOG.md`
- **Behavior intended to remain identical:** no production consumers, routes, components, package files, schema, environment/config files, server functions, external systems, git staging, commits, pushes, deployments, or production flags were modified.
- **Contract added:** exactly `viewer_v2`, `organizer_v2`, and `homepage_v2`; absent/malformed config defaults off; only explicit boolean values and `true`/`false` strings parse; account/board allowlists are capped at 100 entries with 128-character identifiers; support/telemetry variants are stable `flag:on|off` labels and exclude account/board identifiers; query parameters may only enable flags for `read_only_preview` and cannot enable production mutation paths.
- **Route-off smoke added:** `playwright-tests/feature-flags-off.spec.ts` covers `/`, `/demo`, `/b/:shareCode`, `/boards/:boardId`, `/create`, and `/dashboard` with all v2 flags off, asserting legacy text and no v2 feature/variant markers. It also asserts query parameters do not enable the unauthenticated `/create` mutation path.
- **RED/GREEN evidence:** focused unit tests passed **7/7**. The first Chromium route smoke exposed two fixture assumptions (split homepage heading text and an unstubbed public-board API); after correcting those fixtures, route smoke passed **7/7**.
- **Review hardening:** review identified malformed nested config fallback, inherited/exotic object acceptance, mutation-route query downgrades, and duplicate query ambiguity. Added failing assertions first; resolver now rejects malformed/exotic config, ignores all mutation-route query overrides, and ignores ambiguous duplicate preview parameters. Focused suite remains **7/7** with expanded assertions.
- **Prototype-pollution hardening:** final review found inherited `Object.prototype` flag/cohort/allowlist reads. A failing regression reproduced the crash/enablement path; all known-key reads now require own properties. Focused suite passes **8/8**.
- **Full gates:** `npm run test:unit` passed **52 files / 330 tests**; route-off Chromium smoke passed **7/7**; `npm run build` passed; `npm run design:lint` returned 0 errors and 0 warnings.
- **Rollback:** remove `utils/featureFlags.ts`, `tests/featureFlags.test.ts`, `playwright-tests/feature-flags-off.spec.ts`, and this log entry. No domain state is affected.

## 2026-08-22 — Slice 4 governed primitives

- **Status:** Complete and verified.
- **Files touched:**
  - `components/primitives/ActionButton.tsx`
  - `components/primitives/Field.tsx`
  - `components/primitives/Dialog.tsx`
  - `components/board/FindSquaresModal.tsx`
  - `components/board/ShareModal.tsx`
  - `components/NotificationOptIn.tsx`
  - `tests/primitives.test.tsx`
  - `docs/REFACTOR_LOG.md`
- **Primitives admitted:** `ActionButton`, `Field`, and `Dialog` only.
- **Primitives omitted:** `StatusLabel.tsx` and `Disclosure.tsx`; no current slice substitution had two low-risk concrete consumers without crossing into future C1/B2/A1 feature-surface work.
- **Consumer proof:** `ActionButton` replaces FindSquaresModal submit/close/list/clear actions and ShareModal copy/close actions. `Field` replaces both FindSquaresModal player search and NotificationOptIn viewer email input. `Dialog` replaces FindSquaresModal and ShareModal modal shells.
- **Behavior intended to remain identical:** viewer find-my-squares matching, selection, close/Escape behavior, ShareModal QR/link/copy statuses, and read-only share copy remain unchanged; only primitive shells/actions/field rendering were substituted.
- **TDD evidence:** `tests/primitives.test.tsx` was written first and initially produced TypeScript missing-module diagnostics for the three primitive imports. Primitive implementations followed. Existing `tests/findSquaresModal.test.tsx` already characterizes FindSquaresModal matching behavior before substitution.
- **Static audit evidence available in this runtime:** file search found zero raw hex/RGB/HSL, default framework gray/white color classes, gradient/blur/glow, arbitrary shadow/radius patterns in `components/primitives`. File search confirms only three primitive files exist; `StatusLabel.tsx` and `Disclosure.tsx` do not exist.
- **Review hardening:** review caught a fake consumer ledger, missing Field IDs, caller-overridable busy semantics, ShareModal z-index and mobile-centering loss, ring-to-border drift, and unsafe forwarded-ref casting. Added failing tests first; migrated the second real Field consumer; generated stable IDs; protected busy semantics; preserved consumer layers, placement, and ring treatment; and replaced the ref cast with a safe callback ref.
- **Verification:** focused primitives + FindSquaresModal tests passed **13/13**; full unit suite passed **53 files / 338 tests**; production build passed; design audit stayed at the exact 75-finding baseline so new primitives added zero findings; Chromium phase-5 plus accessibility contracts passed **13 active / 7 owned skips**.
- **Rollback:** remove the three primitive files and `tests/primitives.test.tsx`, revert `FindSquaresModal.tsx`, `ShareModal.tsx`, and `NotificationOptIn.tsx`, and remove this log entry. No domain state is affected.

## 2026-08-22 — Slice 5 C1 viewer domain decomposition

- **Status:** Complete and verified; `viewer_v2` remains off.
- **Files touched:**
  - `features/viewer/score/viewerScoreModel.ts`
  - `features/viewer/identity/viewerIdentityModel.ts`
  - `features/viewer/scenarios/scenarioModel.ts`
  - `features/viewer/milestones/milestoneViewModel.ts`
  - `tests/viewerScoreModel.test.ts`
  - `tests/viewerIdentityModel.test.ts`
  - `tests/scenarioModel.test.ts`
  - `tests/milestoneViewModel.test.ts`
  - `components/GameDayHorizon.tsx`
  - `docs/REFACTOR_LOG.md`
- **Behavior boundary:** `viewer_v2` remains off and no new shell, package, schema, API, env, external-system, git, BoardView, or FindSquaresModal behavior changed. `GameDayHorizon.tsx` preserves hierarchy/copy while consuming extracted score/scenario/milestone computations; the one intentional domain correction is suppressing future-score scenarios after Final, as required by the viewer contract.
- **TDD evidence:** model tests were written before the model files. The first executable state would be RED because all four imports targeted missing files. GREEN implementation now covers score authority labels and minute polling text; durable identity/ambiguity/invalid restore semantics; scenario +2/+3/+6/+7/+8 arithmetic for either team with stale/offline/no-score/final statuses; and OPEN/corrected milestone preservation.
- **Review hardening:** first review found the scenario model extracted but unused while `GameDayHorizon` retained duplicate inline arithmetic. The active viewer now consumes `buildScenarioModel`; duplicate scenario construction was removed, and Final/no-score suppression is active.
- **Verification:** four model suites passed **9/9**; legacy viewer regression suites passed **30/30**; full unit suite passed **57 files / 347 tests**; production build passed; Chromium accessibility contracts passed **12 active / 7 owned skips**; design audit remained at the exact 75-finding baseline.
- **Rollback:** remove the four `features/viewer/**` model files and four matching tests, revert `components/GameDayHorizon.tsx`, and remove this log entry. No domain state is affected.

## 2026-08-22 — Slice 6 C1 viewer shell behind viewer_v2

- **Status:** Complete and verified behind default-off `viewer_v2`; rollback to `GameDayHorizon` is preserved.
- **Files touched:**
  - `features/viewer/shell/ViewerShell.tsx`
  - `features/viewer/score/ScoreInstrument.tsx`
  - `features/viewer/identity/FindSquaresEntry.tsx`
  - `features/viewer/personal/YourSquaresSummary.tsx`
  - `features/viewer/scenarios/ScenarioDisclosure.tsx`
  - `features/viewer/notifications/WinnerEmailDisclosure.tsx`
  - `features/viewer/details/BoardDetailsDisclosure.tsx`
  - `tests/viewerShell.test.tsx`
  - `playwright-tests/viewer-v2.spec.ts`
  - `components/BoardView.tsx`
  - `docs/REFACTOR_LOG.md`
- **Behavior boundary:** `viewer_v2` defaults off through `utils/featureFlags.ts`; `BoardView` resolves it from environment config and only permits query overrides for read-only viewer/demo routes. Production mutation routes pass `routeIntent: 'production_mutation'`. `GameDayHorizon` remains the fallback.
- **Flag safety:** no production-exported resolver override exists. Tests enable the shell only through the permitted read-only viewer/demo query path; mutation routes use `production_mutation` and ignore all query overrides.
- **C1 shell coverage:** phone-first score/title/matchup/current result/authority/freshness/polling/Find my squares; personalized name/count/coordinate rows and View on board controls before winner email; pregame scenario suppression; live unselected scenarios collapsed into disclosure; selected matching outcomes first; arithmetic disclaimer; stale/offline last-known timestamp; Final record with no scenarios; winner email only when published services and durable participant identity are present.
- **Review hardening:** duplicate display names now fail closed for durable participant email binding; personalized scenarios use real team abbreviations; randomized-axis focus coordinates are regression-tested; OPEN matching trims whitespace; the production-exported test resolver seam was removed; and mutation-query denial is reverified against the committed flag resolver.
- **RED evidence:** `tests/viewerShell.test.tsx` was written before implementation; the write-time TypeScript diagnostic reported missing `../features/viewer/shell/ViewerShell`.
- **GREEN evidence:** focused viewer shell + flag tests passed **15/15**; full unit suite passed **58 files / 354 tests**; production build passed; Chromium viewer-v2 plus route-off Playwright passed **8/8**; design audit remained at the exact 75-finding baseline. Three ambiguous Testing Library selectors were corrected without changing product code after each rendered state proved the intended duplicate text.
- **Rollback:** remove the seven new viewer shell component files, remove the two new tests, revert `components/BoardView.tsx`, and remove this log entry. No package, schema, API, server, environment file, deployment, or git state is affected.

## 2026-08-22 — Slice 7 exact viewer grid behind viewer_v2

- **Status:** Complete and verified behind the existing `viewer_v2` shell.
- **Files touched:**
  - `features/viewer/board/boardGridModel.ts`
  - `features/viewer/board/ViewerBoardGrid.tsx`
  - `features/viewer/shell/ViewerShell.tsx`
  - `tests/boardGridModel.test.ts`
  - `tests/viewerBoardGrid.test.tsx`
  - `playwright-tests/viewer-v2.spec.ts`
  - `playwright-tests/accessibility-contract.spec.ts`
  - `docs/REFACTOR_LOG.md`
- **Behavior boundary:** `components/BoardGrid.tsx` was not modified. Its dynamic quarter selector/auto-quarter behavior is untouched. The new viewer board is feature-local under `features/viewer/board` and is only consumed by the existing `viewer_v2` shell.
- **Contract implemented:** exact 10x10 viewer grid using Slice 5 `getAxisForQuarter`; randomized axes remain source-of-truth from the board; top axis is labeled/sticky as Top team and side axis as Side team; one-tab-stop roving `role=grid` cells support Arrow keys, Home, End, Ctrl+Home, and Ctrl+End; controls Zoom out, Center current result, Zoom in, Fit board, Find, and Center selected plus a live Current zoom status all carry explicit 44px minimum geometry; cell names include assignment/OPEN, coordinate row/column, top digit, side digit, current result, milestone/pending/resolved/corrected semantics; selected/current/resolved/OPEN/correction states are exposed through distinct ARIA/data attributes and visual token classes.
- **TDD evidence:** tests were written before implementation. RED evidence available in this sandbox: initial write produced missing-module diagnostics for `../features/viewer/board/ViewerBoardGrid`; `boardGridModel` import targeted a then-missing file. GREEN implementation was then added and wired into `ViewerShell`.
- **Playwright contract:** `viewer-v2.spec.ts` now exercises the exact grid path; `accessibility-contract.spec.ts` removed the Slice 7 board-keyboard `fixme` and activates the one-tab-stop/cell-semantics test on `/b/ABCDEFGH?viewer_v2=true`.
- **Review hardening:** focus navigation derives from the actually focused gridcell rather than potentially stale React state; ARIA counts/indexes now match the rendered header/data structure; zoom changes layout dimensions inside the scroll viewport; current-result and selected-player centering are separate actions; sticky axis columns have deterministic widths/offsets; selected/current/resolved/OPEN/corrected visuals remain distinct in combined states; internal correction reasons are not exposed in public cell names. Unit and Playwright harnesses dispatch keys from the focused cell and scope controls to the complete board instrument.
- **Verification:** focused model/grid suites passed **8/8**; full unit suite passed **60 files / 362 tests**; Chromium viewer-v2 plus accessibility contracts passed **15 active / 6 owned skips** with the board keyboard contract active; production build passed; design audit remained at the exact 75-finding baseline.
- **Rollback:** remove the two new viewer board files and two new tests, revert `ViewerShell.tsx`, `playwright-tests/viewer-v2.spec.ts`, `playwright-tests/accessibility-contract.spec.ts`, and this log entry. No package, schema, API, environment, deploy, git, or production data state is affected.

## 2026-08-22 — Slice 8 manual scoring extraction

- **Status:** Complete and verified under the requested extraction seam.
- **Files touched:**
  - `features/organizer/game-day/manualScoringModel.ts`
  - `features/organizer/game-day/ManualScoringPanel.tsx`
  - `tests/manualScoringPanel.test.tsx`
  - `components/AdminPanel.tsx`
  - `docs/REFACTOR_LOG.md`
- **Behavior boundary:** existing `functions/api/pools/[id]/score/manual.ts` was not modified. No package, schema, API payload, flag, environment, external system, deploy, or git state was changed. `AdminPanel.tsx` now delegates only the existing live-scoring/manual-scoring UI rendering to the feature-local panel while retaining its existing state handlers, action messages, fetch payloads, revision/autosave boundaries, and callback ownership.
- **Contract preserved/extracted:** manual authority toggle, latest snapshot seeding, period/state derivation, non-negative quarter-score input, manual score publish action, organizer-entered score copy, deliberate return to automatic scoring, and stale automatic overwrite protections remain on the pre-existing server/model path. The panel preserves existing copy, button labels, disabled/loading behavior, CSS token classes, and handler callback shape.
- **RED evidence:** `tests/manualScoringPanel.test.tsx` was written before implementation; write-time TypeScript diagnostic reported missing `../features/organizer/game-day/ManualScoringPanel`.
- **GREEN evidence:** focused manual scoring model/UI/panel suites passed **16/16**; full unit suite passed **61 files / 365 tests**; production build passed; design audit remained at the exact 75-finding baseline.
- **Rollback:** remove the two new feature files and `tests/manualScoringPanel.test.tsx`, restore the live-scoring JSX and local manual-scoring helpers in `components/AdminPanel.tsx`, and remove this log entry. No domain state is affected.

## 2026-08-22 — Slice 9 organizer lifecycle and draft save models

- **Status:** Complete and verified in feature-local model files under the requested file-surface limit.
- **Files touched:**
  - `features/organizer/lifecycle/organizerLifecycle.ts`
  - `features/organizer/draft/draftSaveModel.ts`
  - `tests/organizerLifecycle.test.ts`
  - `tests/draftSaveModel.test.ts`
  - `docs/REFACTOR_LOG.md`
- **Behavior boundary:** no UI shell, `AdminPanel`, package, schema, API, feature flag, environment, external-system, deploy, or git state was modified. Legacy `utils/organizerFlow.ts` was inspected and left untouched to preserve existing adapter behavior.
- **Contract implemented:** exact phases `Create Draft`, `Fill`, `Reconcile`, `Draw`, `Preview`, `Go Live`, `Game Day`, `Final Record`; exact save states `clean`, `dirty`, `saving`, `save_failed`, `conflicted`, `recovered`; duplicate/ambiguous public identity is a hard blocker; unpaid/unknown and seller gaps are advisories; open-square acknowledgement is required; publish fails closed for dirty/saving/save_failed/conflicted saves; Go Live is modeled as one-time; Game Day persists until final durable resolution; malformed board/save input and impossible transitions fail closed; public snapshots expose public labels/OPEN only and omit payment, seller, contact, participant id, and notes.
- **RED evidence:** both model test files were written before implementation. Write-time TypeScript diagnostics reported missing imports for `../features/organizer/lifecycle/organizerLifecycle` and `../features/organizer/draft/draftSaveModel`.
- **Review hardening:** malformed revisions and malformed local revisions force `save_failed`; remote acknowledgements/recovery/conflict resolution require monotonic server revisions relative to local work; only a valid-revision `clean` state is publishable; malformed or partial committed axes cannot enter Draw; Preview cannot skip Go Live; public scheduled-game snapshots whitelist and clone public fields instead of copying private/internal metadata.
- **GREEN evidence:** lifecycle/draft/legacy adapter suites passed **19/19**; full unit suite passed **63 files / 376 tests**; production build passed; design audit remained at the exact 75-finding baseline.
- **Rollback:** remove the two new feature model files, the two new test files, and this log entry. No domain state is affected.

## 2026-08-22 — Slice 10 B2 organizer shell behind organizer_v2

- **Status:** Complete and verified behind default-off `organizer_v2`; AdminPanel remains rollback.
- **Files touched:**
  - `features/organizer/shell/OrganizerShell.tsx`
  - `features/organizer/shell/TaskHeader.tsx`
  - `features/organizer/shell/ProgressDisclosure.tsx`
  - `features/organizer/shell/AssignmentWorkspace.tsx`
  - `features/organizer/shell/ReconcileChecklist.tsx`
  - `features/organizer/shell/DrawWorkspace.tsx`
  - `features/organizer/shell/ViewerPreviewWorkspace.tsx`
  - `features/organizer/shell/PublishReviewDialog.tsx`
  - `features/organizer/shell/GameDayControls.tsx`
  - `features/organizer/shell/CorrectionFlow.tsx`
  - `tests/organizerShell.test.tsx`
  - `playwright-tests/organizer-v2.spec.ts`
  - `components/BoardView.tsx`
  - `docs/REFACTOR_LOG.md`
- **Behavior boundary:** `AdminPanel` remains intact as rollback. No package, schema, API, server, env-file, deployment, git, or commit action was performed. `BoardView` still selects `OrganizerShell` only in owner commissioner mode when resolved `organizer_v2` is true; production mutation query overrides remain ignored by the existing feature-flag resolver.
- **Review correction:** removed the Slice 10 `Math.random` draw and reused the existing `secureShuffleDigits` durable browser-crypto draw path; shell lifecycle input no longer synthesizes participant IDs and fails closed through the existing lifecycle ambiguity blocker when private participant metadata is unavailable; draw/progression/publish are blocked by lifecycle and save blockers; publish rechecks at click, disables while pending/blocked, surfaces errors, and closes only on success; draft board state syncs on prop/revision changes without clobbering dirty local state; decorative manual-authority button was deleted; Open viewer and Reload latest board now require real callbacks from `BoardView`.
- **Server-backed completion:** payout editing, late OPEN-square assignment before kickoff, manual score enable/save/return-auto, audited milestone correction, and durable Final Record are wired through extracted feature-local services or existing BoardView callbacks. No decorative mutation controls remain.
- **Coverage added/updated:** unit coverage for conflict/reload, lifecycle draw blockers, private-metadata fail-closed behavior, draft sync, publish payload/pending/error/disabled/close-on-success, focus on the publish dialog, and absence of fake manual buttons; browser coverage now requires explicit `VITE_GRIDONE_ORGANIZER_V2=true` process env rather than a query parameter and checks owner shell phone overflow.
- **Verification:** organizer/server-backed contracts passed **35/35**; full unit suite passed **64 files / 389 tests**; env-enabled owner-shell Chromium Playwright passed **2/2** including actual `window.scrollX=0` at 390px; production build passed; design audit remained at the exact 75-finding baseline.
- **Rollback:** revert the listed Slice 10 files to the previous Slice 10 state. No domain state is affected.

## 2026-08-22 — Slice 10 server-backed organizer seams

- **Status:** Complete and verified.
- **Files touched:**
  - `features/organizer/services/game-day/manualScoreService.ts`
  - `features/organizer/services/game-day/publishedOpenSquares.ts`
  - `features/organizer/services/corrections/milestoneCorrectionService.ts`
  - `features/organizer/shell/OrganizerShell.tsx`
  - `features/organizer/shell/GameDayControls.tsx`
  - `features/organizer/shell/AssignmentWorkspace.tsx`
  - `features/organizer/shell/CorrectionFlow.tsx`
  - `components/AdminPanel.tsx`
  - `tests/organizerShell.test.tsx`
  - `docs/REFACTOR_LOG.md`
- **Behavior boundary:** no package, schema, API endpoint, env, deploy, git, or commit changes. Existing `/score/manual`, `/milestones/:milestone/correct`, payout callback, and published OPEN-square callback payload shapes were preserved.
- **RED evidence:** focused organizer shell tests were added/updated first for payout save/reload, late OPEN assignment/reload, manual enable/save/auto return, milestone correction expected revision/reason, and read-only Final Record.
- **GREEN evidence:** focused server-backed organizer contracts passed **35/35**; full unit suite passed **389/389**; env-enabled owner-shell Playwright passed **2/2**; build passed; audit remained at baseline. Phone overflow required shell-level inline-size/paint containment around the intentionally scrollable 640px board; browser verification confirms `document` overflow and `window.scrollX` are zero while `boardScrollWidth > boardClientWidth` remains true. Final review removed the stale optimistic board write after authoritative OPEN-square reload so server state always wins.
- **Rollback:** remove the three service files, restore the previous Slice 10 shell component stubs, restore `AdminPanel` inline service calls if desired, and revert the organizer shell test changes.

## 2026-08-22 — Slice 11 privacy-minimal instrumentation schema/client

- **Status:** Complete and verified in the approved schema/client/test surface.
- **Files touched:**
  - `features/instrumentation/eventSchema.ts`
  - `features/instrumentation/clientEvents.ts`
  - `tests/instrumentationSchema.test.ts`
  - `docs/REFACTOR_LOG.md`
- **Behavior boundary:** no events endpoint, storage, external analytics, Terms/Privacy, UI wiring, package/schema/env/deploy/git, or commit changes. Client delivery is dependency-injected only.
- **RED evidence:** `tests/instrumentationSchema.test.ts` was written first. Write-time TypeScript diagnostics failed on missing imports for `../features/instrumentation/eventSchema` and `../features/instrumentation/clientEvents`.
- **GREEN implementation:** schema permits only the 13 approved coarse event names; rejects unknown events, prohibited fields, unknown fields, missing required fields, and invalid/free-form values; first-ten-board baseline config is targetless, user-data-free, and gated by explicit outreach/analytics approval; client recorder validates before delivery, uses injected async delivery, bounded timeout, deterministic result statuses, and swallows delivery failures.
- **Review hardening:** delivery receives a frozen explicit own-key clone plus `AbortSignal`; timeout aborts the delivery contract, clears its timer, and deterministic tests prove late delivery cannot mutate/send after timeout when the injected transport honors cancellation. Validation uses `Reflect.ownKeys`, rejects symbol/unknown/prohibited keys, requires `name` and every required field as own properties, and reconstructs only validated fields before delivery.
- **GREEN evidence:** focused instrumentation tests passed **7/7**; full unit suite passed **65 files / 396 tests**; production build passed; design audit remained at the exact 75-finding baseline.
- **Rollback:** remove the two instrumentation files, the instrumentation test file, and this log entry. No domain state is affected.

## 2026-08-22 — Slice 12 A1 product-first homepage

- **Status:** Complete and verified in the constrained default-off surface.
- **Files touched:**
  - `features/homepage/HomepageV2.tsx`
  - `features/homepage/HomepageProofArtifact.tsx`
  - `tests/homepageV2.test.tsx`
  - `playwright-tests/homepage-v2.spec.ts`
  - `App.tsx`
  - `index.html`
  - `index.tsx`
  - `tests/pricingCopyConsistency.test.ts`
  - `docs/REFACTOR_LOG.md`
- **Behavior boundary:** root keeps `FilmLanding` by default and selects `HomepageV2` only when resolved `VITE_GRIDONE_HOMEPAGE_V2` is true. Root uses production-mutation route intent so query parameters cannot enable the production homepage. FilmLanding and film CSS remain untouched rollback/optional story surfaces. No package, schema, API, server, env-file, deploy, git, or commit changes.
- **RED evidence:** `tests/homepageV2.test.tsx` was written first and write-time diagnostics failed because `../features/homepage/HomepageV2` did not exist.
- **GREEN implementation:** A1 first viewport contains GridOne identity, exact `Football-squares fundraiser boards`, outcome copy, `Create your free board`, `See a live board`, `First published board free`, and the no-money boundary. Product proof defaults to clearly labeled synthetic B2 organizer artifact and switches in place to a C1 viewer proof adapter using existing viewer shell hierarchy with feature-local fixture data. Canonical 2026 pricing is rendered, optional story is native disclosure/static/skippable, and no GSAP/Lenis/film gate/loader/scroll instruction was added.
- **Review hardening:** `/demo` CTA validity, exact 390×844 and 1280×720 first-viewport geometry, organizer/viewer proof overflow on phone and desktop, static SEO, and no-JavaScript product truth/actions are browser-tested. The global splash loader/dead teardown were removed from the critical path and replaced with a crawlable `<noscript>` product fallback. `HomepageV2` is lazy-isolated into its own 10.62 kB build chunk with a product-truth fallback instead of a loader; viewer proof loads only after its switch.
- **GREEN evidence:** homepage/pricing/static suites passed **15/15**; full unit suite passed **66 files / 402 tests**; non-env query-denial Playwright passed **1/1**; env-enabled desktop/phone homepage Playwright passed **10/10**; production build passed. Initial audit found 16 framework-white/arbitrary-radius violations in the new homepage; all were replaced with governed `broadcast-white` and surface-radius tokens, returning the audit to the exact 75-finding baseline.
- **Rollback:** remove the two homepage feature files and two new test files, restore `App.tsx`, `index.html`, `index.tsx`, and `tests/pricingCopyConsistency.test.ts`, and remove this log entry. No domain state is affected.

## 2026-08-22 — Slice 13 mechanical source migration

- **Status:** Complete and verified as a behavior-free path/import migration.
- **Moves:** `features/` → `src/features/`; `components/primitives/` → `src/components/primitives/` using `git mv`. No route file, API, schema, package, environment, or product behavior changed.
- **Import codemod:** deterministic resolver processed **231** TypeScript/TSX files and rewrote **109** relative imports from resolved old targets to resolved new targets. Four non-import path literals (`vi.mock` and pricing file reads) were corrected after full tests exposed them.
- **Protected files:** existing untracked `.impeccable/`, gap-remediation plan, and marketing documents were not touched or moved.
- **Verification:** TypeScript/Vite production build passed immediately after the move; full unit suite passed **66 files / 402 tests** after correcting the four test-only literals; design audit remained at the exact 75-finding baseline. Old active source directories and runtime/test import references under `features/` and `components/primitives/` are absent; historical planning/log mentions remain intentionally unchanged.
- **Rollback:** revert this single mechanical move commit. No domain state is affected.

## 2026-08-22 — Final integration and independent readiness review

- **Status:** Refactor implementation complete and verified for default-off delivery; not a production rollout or full release certification.
- **Deterministic gates:** unit **66 files / 402 tests**; production build passed; design lint **0 errors / 0 warnings**; design audit stayed at the documented **75-finding baseline**; production dependency audit reported **0 vulnerabilities**; one low-severity dev-only Babel advisory remains.
- **Browser gates:** default-off/accessibility Chromium **21 passed / 6 explicitly owned skips**; `viewer_v2` **2/2**; `organizer_v2` **2/2**; homepage query denial **1/1**; homepage desktop/phone Chromium plus WebKit **15/15**. Numeric and rendered QA confirmed zero page overflow at required phone/desktop states and intentional local board scrolling only.
- **Independent correction:** final review found winner-email disclosure before personalized scenarios. A RED document-order regression reproduced the defect; `WinnerEmailDisclosure` now follows `ScenarioDisclosure`. Focused viewer tests **7/7**, full unit **402/402**, build, and viewer Playwright **2/2** passed after correction.
- **Integration gate:** after OrbStack/Docker was started, `npm run test:integration` passed **9/9 suites** with **56 passed / 1 intentional skip** across 57 PostgreSQL integration tests.
- **Known limits:** code-level v2 defaults remain off, while the approved production build enables all three through explicit configuration; no production analytics storage or manual assistive-technology certification occurred. Existing accessibility fixmes and 75 baseline design findings remain documented debt.
- **Rollback:** disable the relevant v2 flag; legacy FilmLanding, GameDayHorizon, and AdminPanel paths remain available.

## 2026-08-23 — Staged production v2 rollout

- **Approval:** Anthony approved sequential rollout through all three v2 surfaces after the default-off production smoke passed.
- **Stage 1:** `homepage_v2` on, viewer/organizer off — deployment `2b99107b`; production DOM confirmed A1 identity/actions and zero phone page overflow while the viewer stayed legacy.
- **Stage 2:** homepage + `viewer_v2` on, organizer off — deployment `4d94ac3c`; deployment URL and custom-domain extraction confirmed the C1 score/Find My Squares/scenario/exact-grid hierarchy. Headless custom-domain DOM automation was blocked by Cloudflare challenge/background timing, so it was not treated as a passing browser assertion.
- **Stage 3:** all three v2 surfaces on — deployment `3eecf9ca`; Cloudflare marked it Production on `main` at commit `456f8ba`. Deployment/custom-domain A1 and C1 content matched; `/create` preserved signed-out authentication safety. Authenticated organizer production testing remains Anthony's real-account smoke check.
- **Durability:** tracked non-secret `.env.production` now sets the three public Vite rollout flags to `true`; `.env.example` keeps safe `false` examples. An ordinary `npm run build` reproduced the exact stage-3 main asset `index-BBI6uMDR.js`, preventing future Git builds from silently reverting the approved rollout.
- **Rollback:** set one or more values in `.env.production` to `false`, rebuild, and deploy; legacy components remain in the codebase.

## 2026-08-23 — Production copy cleanup

- **Reason:** Anthony found implementation language exposed on the live homepage, including `Optional brand story` and copy about animation runtime/choreography. Roman completed a read-only production-copy audit; Anton reconciled it against product trust contracts.
- **Scope:** rewrote user-visible and screen-reader copy across the A1 homepage/demo, C1 viewer scenarios/email/grid controls, and B2 organizer fill/draw/preview/status/reconcile/game-day/scoring/correction surfaces. Internal labels such as `B2`, `C1`, `proof`, `artifact`, `workspace`, `canonical`, raw blocker enums, revision metadata, and payout-oriented field labels no longer appear to customers.
- **Preserved truth:** exact 2026 pricing, no-money custody/collection/payment boundary, demo/sample disclosure, score source/freshness, OPEN-square semantics, correction visibility, and notification gating remain unchanged.
- **RED:** new `tests/productionCopy.test.ts` failed on the exposed implementation phrases before source edits.
- **GREEN:** production-copy/component suites passed **39/39**; full unit passed **67 files / 404 tests**; PostgreSQL integration passed **9 suites / 56 passed / 1 skip**; homepage query denial **1/1**, homepage Chromium/phone/WebKit **15/15**, viewer **2/2**, organizer **2/2**; build and design lint passed; design audit remained at the documented 75-finding baseline.
- **Rollback:** revert this copy-only commit. No schema, API, pricing, permission, payment, score-authority, or data behavior changed.

## 2026-08-24 — Full-site conversion coherence pass

- **Audit:** Roman reviewed the full public route set and Anton inspected production desktop/phone landing, demo, article hub, signup, checkout recovery, legal, and 404 surfaces. The landing foundation was sound; the main leak was broken promise continuity and missing conversion close, not visual redesign.
- **Homepage:** audience-specific subhead now names youth-sports teams, booster clubs, schools, and community organizers; first viewport adds the no-viewer-account trust point and the full no-money boundary; Organization explains naming/shared dashboard/receipt value; four canonical FAQs handle account, money, payment timing, and edit permissions; a final create/demo CTA plus sign-in/guides/privacy/terms closes the page.
- **First-click path:** signed-out `/create` now opens signup mode and preserves the return URL. Signup repeats first-board-free and no-viewer-account reassurance and uses `Create account and start board`.
- **Demo/content handoff:** demo-only sample notice links to board creation and the homepage. Articles hub removes internal SEO language and adds a product CTA. Five high-intent fundraiser/category articles make `/create` primary. Youth-sports GTM language and unsupported RunYourPool claims/style jargon were replaced with neutral fit-based comparison copy and exact pricing.
- **Recovery/trust:** create-flow copy clarifies recognizable board naming and build-before-publish/free-first-board behavior; checkout ready state always has a next action; 404 adds create/demo recovery; Privacy adds a plain-language data-use introduction; no-JavaScript homepage copy matches the acquisition promise.
- **RED/GREEN:** new `tests/conversionPath.test.ts` and updated redirect/browser assertions failed before implementation, then passed. Full unit **68 files / 410 tests**; PostgreSQL integration **9 suites / 56 passed / 1 skip**; homepage query denial **1/1**, homepage Chromium/phone/WebKit **18/18**, viewer **2/2**, organizer **2/2**; production build and design lint passed; design audit improved from 75 to **74** documented findings. Rendered desktop/390px review found no conversion or overflow blocker.
- **Boundaries:** no fake proof, urgency, guarantees, price change, permission change, money handling, schema/API behavior, analytics storage, or checkout behavior was added.
- **Rollback:** revert this conversion-copy/coherence commit. Existing feature flags and legacy component rollback remain unchanged.

## 2026-08-24 — Organizer/viewer friction and comprehension pass

- **Scope:** high-confidence P1/P2 UX clarifications only: existing-account sign-in on the product-first landing hero, viewer score/axis/result-digit mapping, board Reset/Fit behavior, and completed-board/final-record organizer guidance.
- **Files touched:** `src/features/homepage/HomepageV2.tsx`, `src/features/viewer/score/ScoreInstrument.tsx`, `src/features/viewer/scenarios/ScenarioDisclosure.tsx`, `src/features/viewer/personal/YourSquaresSummary.tsx`, `src/features/viewer/board/ViewerBoardGrid.tsx`, `src/features/viewer/shell/ViewerShell.tsx`, `src/features/organizer/shell/OrganizerShell.tsx`, `tests/homepageV2.test.tsx`, `tests/viewerShell.test.tsx`, `tests/viewerBoardGrid.test.tsx`, `tests/organizerShell.test.tsx`, `playwright-tests/viewer-v2.spec.ts`, `docs/phone-viewer-hierarchy.md`, and `docs/REFACTOR_LOG.md`.
- **Product decisions:** the landing now exposes `Sign in to existing account` as a quiet first-viewport utility action while preserving create/demo as the two hero choices; score/current-result surfaces express the winning square as the top team’s digit `across` and the side team’s digit `down`; scenario and personal-square rows use named team columns/rows; the exact board names the actual teams in its sticky axes; duplicate Find and irrelevant Center-selected controls were removed; `Reset/Fit` now performs real cross-browser layout scaling from 50%–100%; completed published boards show a Final-record lock explanation and a `Create another board` route.
- **Boundaries preserved:** no pricing, schema, permission, scoring-authority, money-handling, package, environment, production-data, live-board, deploy, commit, or push change was made. Existing protected untracked `.impeccable/` and prior protected docs were not edited.
- **RED evidence:** focused expectations were added first in `tests/homepageV2.test.tsx`, `tests/viewerShell.test.tsx`, `tests/viewerBoardGrid.test.tsx`, and `tests/organizerShell.test.tsx` for the missing sign-in link, missing winning-digit explanation, ambiguous top/side orientation, missing Reset/Fit behavior, and absent completed-board lock guidance. In this sandbox those assertions target code that did not yet render the required text/control, so the intended RED state is deterministic by inspection.
- **GREEN evidence:** full unit **68 files / 411 tests**; PostgreSQL integration **9 suites / 56 passed / 1 skip**; homepage-v2 contract **28/28** across Chromium/WebKit and phone variants (24 in the homepage-only run plus the 4 demo-handoff cases rerun with viewer-v2 enabled); viewer-v2 **8/8**; organizer-v2 **8/8**; production build and design lint passed. The broad unscoped `npx playwright test` command is not a valid release matrix because v2 suites require mutually different feature-flag environments; its failures were reproduced as flag/legacy expectation conflicts rather than reported as green. Design audit remains at the pre-existing **74 documented findings**. Fresh desktop and 390px screenshots had no page overflow or console errors; the full 10-column board now actually fits at 50% on mobile and keeps the current square and team orientation visible.
- **Rollback:** revert the listed files from this entry. No domain state is affected.

## 2026-09-01 — Broadcast Glass stage 1+2: baseline and design foundation

- **Scope:** removed stale agent worktrees and branches; added `src/design/tokens.css`, `Base`, motion helpers, and the Eyebrow, Capsule, Glass, Spotlight, Numeral, Sheet, Ring, and Island primitives with unit coverage; added the temporary `/design-kitchen` route; rewrote `DESIGN.md` and `docs/DESIGN_TOKENS.md`; retired the old design audit.
- **Known transient effect:** legacy surfaces mix 8px radii (hand-written CSS still on `--gridone-radius-control`) and 12px radii (Tailwind `rounded-control` now resolves to the new token) until they are deleted in stages 3–5.
- **Not touched:** schema, functions, workers, services, hooks, legacy surfaces (deleted in stages 3–5).
- **Evidence:** unit suite 79 files / 436 tests green, strict TypeScript, production build, design lint 0 errors, kitchen route verified in the browser at desktop and 375px (fonts loaded, glass blur, both grounds, sheet focus trap and scroll lock, island expand, no horizontal overflow).
- **Rollback:** revert the commits of this stage; no domain state affected.

## 2026-09-01 — Broadcast Glass stage 3: homepage

- **Scope:** one homepage at `/` built on the Broadcast Glass primitives (hero with a primitive-built Q3 viewer card, live score moment, three parent answers, organizer screen, pricing rows, FAQ, footer guide index). Removed `FilmLanding`, its 301 film frames, `lib/scrollRuntime.ts`, the `lenis` dependency, `HomepageV2`, `HomepageProofArtifact`, and the `homepage_v2` flag. Pricing and demo data now live in `src/features/homepage/pricing.ts` and `demoData.ts`; the next-score rows and the "wins right now" line are derived from the demo board so they cannot drift.
- **Pricing:** live ladder unchanged per `docs/pricing-recommendation-2026-09-01.md`; route schema offers now derive from `PRICING`.
- **Deferred to stage 6:** replace the primitive-built hero and organizer artifacts with renders of the redesigned viewer and organizer; give the board fragment per-cell accessibility once the real grid is used.
- **Evidence:** unit suite 81 files / 444 tests, strict TypeScript, production build (dist 1.3 MB, down from 15 MB), design lint 0 errors, Playwright homepage / feature-flags-off / accessibility-contract on Chromium, desktop and 375px screenshots reviewed (no overflow, focus ring visible, one spotlight).
- **Rollback:** revert this stage's commits; restores the flagged pair of landings and the film assets.

## 2026-09-02 — Broadcast Glass stage 4: phone viewer

- **Scope:** `ViewerShell` and every viewer component in `src/features/viewer/` rebuilt on the Broadcast Glass primitives: pinned score island (`shell/ViewerIsland.tsx`), glass score instrument with accessible numerals, Find My Squares as a capsule entry plus a `Sheet`, personal summary with digit chips and a gold wins-now line, scenario rows, capsule winner-email form, final record promoted above the grid at Final, payouts and board rules below the grid, restyled grid with `Fit`. `BoardView` renders the new shell unconditionally; `viewer_v2`, `GameDayHorizon`, `BoardGrid`, `PlayerFilter`, and `BoardHeader` are deleted. `ViewerShellProps` unchanged except an optional `onShare`.
- **Not touched:** `*Model.ts` files, name matching, identity persistence, hooks, services, functions, workers, schema, notification API.
- **Fixed along the way:** Sheet returns focus to its trigger and focuses its first content control; corrected results show reason and time; payout descriptions restored for viewers (a gap the flagged viewer already had); side-axis header no longer stretched grid rows; island never wraps.
- **Evidence:** unit suite green, strict TypeScript, production build, design lint 0 errors; Playwright viewer / feature-flags-off / accessibility-contract / smoke green on Chromium; user-workflows green except the organizer NFL-event test that needs `wrangler pages dev`; browser-checked at 375px and desktop (island, sheet flow, personal view, grid, no overflow).
- **Rollback:** revert this stage's commits.
- **Stage 4 addendum (final review):** personal selection now uses the cardinal tone so gold stays exclusive to current/resolved; cells reveal their full label on hover/focus; organizer preview renders the viewer as a region, not a nested main. **Deferred to stages 5–7:** narrow the score live region to the result line; island expanded state overlapping the title; corner axis cell width; `WinnerEmailDisclosure` is no longer collapsible (contract asks for a compact affordance); `YourSquaresSummary` lists squares twice (chips + rows); dead `final` prop on `BoardDetailsDisclosure`; ~160 lines of dead `.gdh-*` CSS and `src/components/primitives/Field.tsx`; `tests/instrumentationSchema.test.ts` still uses `viewer_v2:*` fixture strings.

## 2026-09-02 — Broadcast Glass stage 5a: organizer workspace (draft side)

- **Scope:** new `src/features/organizer/workspace/` tree: `useWorkspaceDraft` (debounced autosave through the existing `updatePool` path, `draftSaveModel` states, pre-flight and in-flight conflict detection, `flush()` that drains coalesced edits and returns the resulting state), in-place editable header with a `Change game` sheet, board editor with a square sheet (name, sold by, paid/unpaid, Enter to advance, paste-to-fill), side rail (payouts and rules with bounded text, reconcile line with blockers vs follow-ups, board tools), organizer island with filled/paid/drawn rings and one phase action, in-place draw with the open-square acknowledgement group, preview/publish/upgrade/published sheets, and `publishBoard`. Draft participant identities are synthesized per normalized label so `Draw numbers` is reachable on real drafts; true label collisions still block. Not yet wired into `BoardView` (stage 5b) — reachable only through the dev-only kitchen route.
- **Not touched:** hooks, services, functions, workers, schema, lifecycle and draft models (one additive export of `isExactAxis`).
- **Known gaps for 5b:** two different people sharing one display name pass the identity check silently until durable participant ids exist in the draft path; `Enter game-day controls` currently only closes the published sheet; the payout card and other cards live in the aside only on `lg`; game-day side, dashboard, create page, `BoardView` wiring, legacy `AdminPanel` deletion, and the `organizer_v2` flag removal are stage 5b.
- **Evidence:** unit suite 92 files / 544 tests, strict TypeScript, production build, design lint 0 errors; kitchen demo driven in the browser at desktop and 375px (title edit, square sheet with Enter advance, paste, island rings, acknowledgement group, draft digits rolling into the axes, commit, preview sheet, publish sheet with allowance line).
- **Rollback:** revert this stage's commits; nothing in production renders the new workspace yet.

## 2026-09-02 — Broadcast Glass stage 5b: organizer wiring and legacy deletion

- **Scope:** game-day side of the workspace (`workspace/gameday/`: share panel with QR, score authority card wrapping `ManualScoringPanel` (restyled on the primitives; strings unchanged), corrections, delivery issues, final record; sold-square rename through the existing `gridone_rename_published_square` RPC with optimistic update and revert; late fill of OPEN squares only, through `onAssignOpenSquares`); `components/BoardView.tsx` renders `OrganizerWorkspace` for owners (entry meta via `useContestEntries`, billing status fetched once per pool for owners only, checkout through `createCheckoutSession`); game changes now live in the draft (`applyScheduledGame` maps the scheduled event exactly as the create page does and resets manual score state the way `AdminPanel` did); `pages/Dashboard.tsx` and `pages/CreateContest.tsx` rebuilt on the cream base — create is one screen (name, game, `Create board`) that lands on `/boards/:id` with no interstitial. Deleted `components/AdminPanel.tsx`, `components/OrganizerDashboard.tsx`, `utils/organizerFlow.ts`, `utils/featureFlags.ts`, `src/features/organizer/shell/*`, the kitchen workspace demo, and the last flag `VITE_GRIDONE_ORGANIZER_V2` (feature flags are gone; `eventSchema` keeps its `organizer_v2:*` event names for analytics continuity). Copy: `Save payout descriptions` became `Save payout rules` because the production-copy test bans the old phrase.
- **Fixed in final review:** enabling manual scoring no longer reloads after seeding the quarters from the snapshot — a published board never goes dirty, so the reload re-adopted the server game and reset every quarter to 0 while `Publish manual score` stayed enabled (C1); the correction disclosure lost in the port was restored — the button reads `Publish correction and email both people` again and the success note names the queued notices, as `AdminPanel` did (I4); the score authority card now shows the source and retrieved time under the numeral, and says so in words when there is no snapshot (I2); `commitDraw` records `allowOpenSquares` like `AdminPanel`'s `commitNumberDraw`, and a square blanked after the draw can be acknowledged in place instead of only through `Replace draft draw` (I3); create-page errors read `Board name is required.` and `Could not create the board.` (I5).
- **Not touched:** hooks, services, functions, workers, schema, Stripe, email, lifecycle/draft models.
- **Capability decisions surfaced by review (owner to accept or restore):** bulk/drag multi-select assignment, seller "paint" across a range, and the third paid state `unknown` from the old panel have no workspace equivalent (`docs/organizer-journey-contract.md` §Fill still lists them); paste-to-fill sets names only. The contract-test assertions on `onAssignOpenSquares`/`canAssignOpenSquares` identifiers are source-reading checks; behavioral coverage is in `tests/organizer/organizerWorkspace.test.tsx`.
- **Deferred (minor):** entry meta is saved even when a rename is refused; optimistic rename revert can clobber a concurrent edit to the same cell; `LATE_FILL_CLOSED` copy is unreachable from the UI; dashboard footer links inherit `ghostLink` 15px against a 13px row; dynamic-axis boards read as "not drawn" on the dashboard; a save conflict blocks `Review and publish` rather than the island's `Preview`; Playwright helpers are duplicated across three specs; `phase5-visual.spec.ts` names deleted selectors (skipped unless `PHASE5_CAPTURE`) — delete in stage 7; the organizer score caption shows source and checked time but not the viewer's stale/offline qualifier; typed-but-unpublished manual quarter values on a published board are discarded by any handler that reloads (late fill, correction) because published boards never go dirty; `Keep assigning` in the post-draw acknowledgement scrolls to the board without dismissing the group.
- **Evidence:** unit suite 93 files / 553 tests, strict TypeScript, production build, design lint 0 errors, Playwright chromium 39 passed across organizer, user-workflows, scheduled-game-picker, accessibility-contract, smoke (self-contained route mocks; no functions server); browser check of `/design-kitchen` (no workspace toggle) and `/demo`.
- **Rollback:** revert this stage's commits. `.env.production` already carries `organizer_v2=false` on `main` (commit `95d0c1e`) so the flagged shell is off in production until this stage deploys; after this stage the flag no longer exists.

## 2026-09-02 — Broadcast Glass stage 6: site pages, real homepage renders, range assignment

- **Scope:** `src/features/site/` (`SiteHeader`, `SiteFooter`, `SitePage`, `ArticleShell`) replaces `components/layout/Layout.tsx` and `Header.tsx`; the twelve SEO articles and the hub, Login, Paid, Privacy, Terms, and 404 sit on the dark base with content, URLs, and `PageMetadata` unchanged (per-file text-node diffs recorded in the stage reports). Homepage hero, organizer section, and two parent moments now render the real `ViewerShell`, `BoardEditor` + `OrganizerIsland`, `YourSquaresSummary`, and `ScenarioDisclosure` with demo data inside inert, `aria-hidden`, captioned frames loaded lazily; `HeroViewerCard` and `OrganizerCard` deleted; `ScoreInstrument` takes a heading level so preview renders never add a second `h1`; `ScenarioDisclosure` ids come from `useId`. Organizer board editor regains range assignment: `Select squares` mode with click, shift-click block, mouse and touch drag; `RangeAssignBar` with one name, optional seller, and payment state `Not asked yet` / `Unpaid` / `Paid`; draft applies preserve an existing payment record unless a status is chosen and warn how many names will be replaced; published applies touch OPEN squares only, server first, with honest failure copy; `SquareSheet` gains the `Not asked yet` state; `saveEntryMetaBatch` in the workspace's own `entryMetaService`.
- **Not touched:** hooks, services, functions, workers, schema, Stripe, email, `seo/`, `build/`, lifecycle/draft models, `context/AuthContext`.
- **Fixed in final review:** I1 `/login` now renders on `SitePage` so it carries the site `banner` and one `main` (the header's own `Sign in` link is dropped there, and the signup eyebrow reads `New organizer` instead of repeating the h1); I2 `keyToggledRef` deleted from `BoardEditor` — a keyboard Space no longer swallows the organizer's next mouse click; I3 every published addition (click, shift-click block, mouse and touch drag) is filtered through `assignable(..., true).ok`, so a block reaching over a sold square arms only the OPEN cells instead of an apply the workspace refuses; I4 the redundant `onReload` after `onAssignOpenSquares` is gone from both `applyRange` and `lateFillOpenSquare` (the callback reloads for itself, and the second reload turned a reload failure into a false "Nothing changed"). Also: deselecting the last square keeps focus on the cell instead of yanking it to the toolbar; cells use `touch-pan-x` in select mode; `saveEntryMetaBatch` writes `paid_status ?? 'unknown'` so every row in a batch upsert carries the same columns.
- **Deferred (minor):** two article `h1`s lost an inline two-tone span (words intact); `Select squares` uses a changing name plus `aria-pressed`; failed range apply moves focus to the toolbar instead of `Apply`; the organizer island in the homepage picture stays collapsed so `Draw numbers` is not visible; `phase5-accessibility.spec.ts` rewritten for the new login (stage 7 decides whether to keep it) and it now asserts the input's `border-top-width` is exactly `1px`, matching `CapsuleInput`'s `border`, rather than merely greater than zero; `demoData` is imported eagerly by `HeroViewer`/`MomentRenders` for their captions, so it is not in the lazy render chunks; the `©` line no longer appears on Privacy/Terms (they carry no footer); Playwright helpers duplicated across specs.
- **Evidence:** unit suite 99 files / 648 tests, strict TypeScript, production build (viewer/organizer renders in separate lazy chunks), design lint 0 errors, Playwright chromium 56 passed / 5 pre-existing skips twice; browser pass at desktop and 390px over `/`, `/articles`, an article, `/login`, `/404`: no horizontal overflow, one `h1`, no duplicate ids, no console errors.
- **Rollback:** revert this stage's commits.

## 2026-09-03 — Broadcast Glass stage 7: repo cleanup, docs rewrite, axe pass

- **Scope:** every legacy style and surface is gone: the `.gdh-*` and `.oa-*` CSS families, `body:has(.oa-root)`, the Archivo and Chivo Mono fonts and their aliases (`src/index.css` 1262 → 134 lines), `public/premium.css`, `sketches/`, `.impeccable/`, `.worktrees/`, the dev-only `/design-kitchen` route and `src/design/kitchen/`, `src/components/primitives/{Field,Dialog,ActionButton}.tsx`, `components/empty/EmptyState.tsx`, `hooks/useDialogFocus.ts`, the `PHASE5_CAPTURE` capture specs (their four live assertions folded into `accessibility-contract.spec.ts`), the `gsap` and `lucide-react` dependencies, and the unused `--gridone-radius-control` token. The last six legacy components (`ScheduledGamePicker`, `FullScreenLoading`, `ErrorBoundary`, `ShareModal` on `Sheet`, `ManualScoringPanel`) now sit on the primitives with strings and logic unchanged. Docs describe one app: `ARCHITECTURE.md`, `PRODUCT.md`, `TEST_STRATEGY.md`, `organizer-journey-contract.md`, `phone-viewer-hierarchy.md`, `accessibility-contract.md`, `README.md`, `AGENTS.md` rewritten against the code; nineteen stale prototype, decision, audit, and rollout docs deleted; the owner's `docs/marketing/` files committed unchanged. New `playwright-tests/axe.spec.ts` runs axe-core (WCAG 2.0/2.1 A and AA) over ten routes with zero serious or critical violations and no rule exclusions; it found and fixed one real defect (homepage `BoardFragment` `OPEN` labels below 4.5:1 over an elevated section).
- **Rewritten, not deleted:** `components/BoardView.tsx` and `pages/CreateContest.tsx` were listed for deletion in spec §7.2; both are still routed surfaces, so they were rebuilt on the primitives instead.
- **Fixed in final review:** share sheet layer above the preview sheet; manual-score focus rings; create-route axe precondition.
- **Not touched:** hooks (except the dead-file deletion), services, functions, workers, schema, `seo/`, `build/`, `context/`, `DESIGN.md`.
- **Deferred (minor):** `ScheduledGamePicker` rows and loading skeleton are low-contrast against the sheet on cream (legible, selection carried by the radio and border); the five `design:lint` warnings are orphaned `DESIGN.md` color names, pre-existing; `docs/pricing-recommendation-2026-09-01.md` still discusses a future `$14.99` Game Day price (intentional).
- **Evidence:** unit suite 98 files / 641 tests, strict TypeScript, production build, design lint 0 errors, Playwright chromium 66 passed (incl. 10 axe routes).
- **Rollback:** revert this stage's commits.

## 2026-09-04 — Stage 9 landing continuation (local only)

Resumed Claude's seven Stage 9 commits at `12c34aa` in isolated `codex/landing-continuation`. Original checkout's organizer changes are untouched. Preserved dark tokens, type, hero, fill ordering, ring growth, and rim lighting. Approved heading: “Add your names. Then draw the numbers.” Added example-board identification, shortened OPEN/draw facts, put the heading before the board for mobile/assistive reading order, and restricted pinned/tall presentation to an active desktop driver.

RED → GREEN: `npx vitest run --project unit tests/homepage/homepage.test.tsx tests/homepage/boardFill.test.tsx` failed five intended assertions before implementation, then passed 55 tests. Final `npm run test:unit`: 101 files / 733 tests passed. `npx tsc --noEmit`, `npm run build`, `npm run design:lint` passed (lint: five existing orphan-token warnings, zero errors). `PLAYWRIGHT_PORT=5194 npx playwright test --project=chromium --workers=2`: 74 passed. Homepage WebKit and phone-WebKit: 22 passed. Full integration run had one disposable Postgres startup race; retry of `publishedSquareRename.integration.test.ts` passed all seven, with 56 passes and one skip across both runs. Initial browser run was interrupted due to missing local mock-auth configuration; rerun used a reserved .test host and dummy key matching the fixture's storage-key prefix, without production credentials.

Rendered 1440x1000 desktop, 390x844 phone, and reduced-motion desktop; verified heading order and compact fallback. Scroll measurements: 0 progress gives 0 names/0 digits; .5112 gives 56 names/0 digits; 1 gives 100 names/20 digits. Board remains at y=96 during mid-scroll, overflow zero, no page or console errors. Read-only continuation review clean. Preview on localhost:5194; no commit, merge, push, or deployment performed.


## 2026-09-04 — Share during pregame sales, then lock on the same link

- **Scope:** isolated `codex/pregame-selling` worktree. Permanent 1–100 square IDs and explicit public family allocation labels are separate from buyers and private seller/payment/contact notes. Organizer supports arbitrary multi-selection, early sharing, clear saved/error recovery, and return-to-management navigation. Signed-out selling viewer supports family filtering, unsold highlighting, full phone overview with readable details, refresh/error disclosure and same-link game-day transition.
- **Persistence:** migration `026_pregame_sharing.sql` adds explicit sharing with existing allowance reservation, service-only sharing RPC, optimistic revisions, owner/season concurrency protection, safe public projection, and stable shared identity. Finalization is still the number-lock operation. Shared activation does not permit scoring. Existing dynamic boards are preserved and rejected by unsupported mutation paths. Owner GET now applies canonical database identity/revision/status after legacy settings so stale settings cannot poison later saves.
- **RED → GREEN:** hook sharing/refresh tests initially failed (4), then passed after queued persistence and refresh recovery; sales route initially failed, then passed with selling viewer routing; shared dashboard and dynamic-load regressions initially failed (2), then passed; recovery regressions initially failed (2), then passed; organizer public allocation/sharing/navigation tests failed before wiring and passed afterward; phone viewer explicit sold legend and owner Manage navigation each failed before their implementation; owner canonical revision test failed at settings revision 3 vs database 12, then passed; two ReconcileCard tests failed its false publication-ready claim before truthful next-step copy. Focused commands used `npx vitest run --project unit` with affected suites. SQL pregame/finalized integration coverage also verified concurrency, privacy, immutable identity and no double allowance counting.
- **Final verification:** `npx tsc --noEmit` passed; `npm run test:unit` **105 files / 779 tests passed**; `npm run test:integration` **10 files / 66 passed / 1 skipped** using disposable PostgreSQL and actual migrations (optional real Stripe Sandbox hosted proof skipped); fixture-configured `npm run build` passed; `npm run design:lint` **0 errors / 5 existing orphaned-token warnings**; full built-app `PLAYWRIGHT_PORT=5198 npx playwright test --project=chromium` **76 passed**. Focused selling workflow in phone WebKit **2 passed** at 390 and 1440 widths. Final truthful readiness-copy change received focused unit coverage and a rebuilt Chromium selling-workflow rerun (**2 passed**). Browser coverage includes keyboard navigation and no serious/critical axe violations in the new workflow.
- **Evidence and limits:** local logs in `/tmp/gridone-pregame-*.log`; reviewed rendered screenshots and release notes in `docs/pregame-selling-review.md`. Browser tests use stateful API fixtures and separate signed-out contexts; SQL tests use actual local PostgreSQL. Neither proves a deployed production flow. The initial dev-server browser run encountered fixture selector drift and a hot reload; selectors were updated to visible actions and final browser verification used the built app without HMR.
- **Release:** no commit, push, deployment, production schema/configuration/data change, package install, or user contact performed. Original checkout modifications remain protected. Migration and release need Anthony approval under AGENTS.md. Apply the migration before matching API/frontend, then prove the deployed organizer-to-viewer lifecycle. Rollback must preserve shared links and sharing data; do not blindly drop the new schema once boards are shared.

## 2026-09-05 — Approved main integration

- Anthony explicitly authorized commit and push to `main`. Remote main matched the implementation base `f01002d`; no merge resolution was needed. Re-ran the full unit suite before committing. Pushing from the isolated worktree preserves the original checkout and its unrelated local changes. Production migration is not part of this authorization; deployed behavior remains unverified.

## 2026-09-05 — Scroll-craft Studio landing, local review

- Large serif hero with an independent complete board, overlapping real viewer, and restrained depth.
- Larger board assembly chapter preserves names-before-axis sequence and the approved OPEN-compatible heading.
- True scores connect to current digits and the matching name. Removed count-through-zero score animation.
- Three keyboard-operated viewer questions replace three repetitive long rows.
- Wide organizer surface, complete tablet and phone composition.
- Interface typography provides chapter hierarchy; FAQ precedes the final held action.


Verification: true-score entry RED0≠17, GREEN13; viewer buttons RED2/GREEN2; focused80; full unit102 files/737 passed with maxWorkers2 after concurrent-capture timeouts; tsc/build passed; design lint0 errors/5 existing warnings; Chromium74+6 passed; WebKit17 passed; built-package6 passed. Desktop/phone/reduced sheets inspected. Tablet cropping found by review, repaired and proved at390/768/1024/1101/1440. No physical-phone or database integration run.

Full brief/evidence: scrollcraft/builds/gridone-studio/{BRIEF,REPORT}.md. Built local URL: http://127.0.0.1:5181/. No commit, push or deployment. Existing unrelated edits preserved.


## Approved production release candidate

Anthony approved commit, push and deployment after reviewing the local preview. Integrated the landing slice onto production main `8941c53` in an isolated worktree, preserving unrelated original-checkout changes.

The newer organizer square labels exposed a fixed-height preview crop (Chromium: 79 passed, 3 failed). Replaced the landing-only fixed frame with natural content sizing and responsive CSS zoom. Final verification: 782 unit tests passed; TypeScript and production build passed; design lint passed with 5 existing warnings; all 82 Chromium tests passed; all 6 focused WebKit tests passed. All 100 organizer squares fit at 390, 768, 1024, 1101 and 1440 pixels in both engines; final phone, tablet and desktop renders inspected. No database integration run for this homepage-only change. Production publication and live verification follow this candidate commit.

## 2026-09-03 — Preserve legacy dynamic board axes on load

- **Scope:** `usePoolData` now preserves the server-provided `BoardData.isDynamic` and per-quarter axis fields instead of coercing every loaded board to fixed axes. A hook-level regression test loads a legacy dynamic board with distinct Q1–Q4 axes and asserts the complete board remains intact.
- **Risk addressed:** coercion changed winner lookup semantics for legacy per-quarter-axis boards and could persist that flattened state on a later organizer save. The organizer lifecycle already detects retained dynamic boards and fails closed (`dynamic_axes_not_supported`); this change restores that preservation boundary without making dynamic editing or publishing available.
- **RED/GREEN:** `npx vitest run --project unit tests/organizerPersistence.test.tsx` first failed with `Expected isDynamic: true / Received isDynamic: false`; after the load-path correction it passed **5/5**.
- **Verification:** `npx tsc --noEmit` passed; `npm run test:integration` passed **9 files / 56 passed / 1 skipped**; `npm run build` passed; `npm run design:lint` passed with **0 errors / 5 existing orphaned-token warnings**. Full `npm run test:unit` is not green because pre-existing `tests/pollingDisclosure.test.ts` reads deleted `tasks/todo.md` (`ENOENT`): **97 files / 641 passed, 1 failed**. Full Chromium is also not green: **45 passed / 23 failed**, all failures occur on authenticated organizer/dashboard/create fixtures that resolve to the login route or time out before the workspace; the changed legacy-load path is covered by the focused hook test, not these fixtures.
- **Rollback:** restore `setBoard(data.board ? { ...data.board, isDynamic: false } : EMPTY_BOARD)` and remove the dynamic-board regression test. No schema, API payload, score authority, publication behavior, payment behavior, deployment, or production data changed.

## 2026-09-05 — approved production pregame migration repair

Phone board-unavailable report traced to owner API selecting contests.shared_at before migration 026 was applied. Anthony explicitly approved applying the existing migration and verifying board loading. Applied the complete .worktrees/pregame-selling/supabase/migrations/026_pregame_sharing.sql to confirmed GridOne project illqymckwqiawdwxhwcy through Supabase apply_migration; success returned. No application-code changes or deployment.

Validation: before repair, live information_schema lacked shared_at and all four sharing functions. Existing focused disposable-Postgres suite passed 10 tests (npx vitest run --project integration tests/pregameSharing.integration.test.ts). After repair, confirmed column, four functions, two triggers, sharing RPC denied to anon/authenticated and allowed to service_role, and successful production owner-column SELECT. Signed-in Safari opened existing draft Test (24574672-31bc-4c76-b421-b7ed27f0a798), rendering Saved, selling workspace, and all 100 square buttons. Phone itself not remotely tested. No board mutations or publication performed. Existing shared-aware application remains deployed; rollback must preserve sharing data and protections.

## 2026-09-07 — Unified organizer allocation and production consolidation

Anthony approved the attended-workflow fixes, integration of earlier local work, a clean committed production release, and a dummy first-game board with $100 at each of four milestones. Current release 9b9dca9 was the base. Earlier landing code was already released; kept its newer clipping fix. Preserved unique historical notes, legacy-axis regression coverage, and ignored local screenshot evidence. No schema, price, allowance, score-authority, or published-record deletion changes.

Changes: one name/payment allocation flow; initial responsible person is retained on later display-name changes; legacy private seller/contact notes stay private. Removed paste-to-fill and buyer/family mode switching. Selection never auto-focuses the form or jumps the viewport; desktop editor sits beside the grid, phone uses explicit Name selected squares navigation. Payment-note failure retains names rather than restoring a stale whole-board snapshot. Duplicate name/responsibility text is suppressed in cells. Create shows one week, then a selected-game summary with immediately reachable Create board. Dashboard removes a board only after a returned deleted ID and explains why published/shared records remain.

RED/GREEN: allocation/focus regressions 2 failed / 67 passed before implementation; payment-recovery regression failed before removing rollback, then passed. Dashboard regression 4 failed before fix then 13 passed; picker and single-square regressions failed before implementation then passed. Commands: npx vitest run --project unit tests/organizer/rangeAssign.test.tsx tests/organizer/organizerWorkspace.test.tsx; focused dashboard, scheduledGamePicker, boardEditor suites; final npm run test:unit — 106 files / 788 passed.

Verification: npx tsc --noEmit passed; npm run build passed with verified public production project config; npm run design:lint — 0 errors / 5 existing orphan-token warnings. npm run test:integration — 10 files / 66 passed / 1 existing skip. Full Chromium — 84 passed. Targeted WebKit organizer/accessibility/picker — 29 passed / 1 forced-colors platform skip, remaining two native Tab assumptions fixed and all 7 picker tests passed. Phone/desktop allocation, rename responsibility, paid-state persistence, same-link sharing through finalization and public payment privacy verified. Rendered 390/1440 states and selected-game summary inspected. Initial concurrent browser failures traced to Vite reloading on test-file edits; final source-frozen Chromium run passed. No full manual VoiceOver/NVDA certification claimed.

Rollback: revert this UI slice while preserving all board data, public allocation labels, private metadata, dynamic axes and published links. The older historical log's dynamic-axis flattening rollback is superseded and must not be used. Live rollout and owner test-board verification follow this commit.


## 2026-09-07 — Live payout-save conflict repair

Live owner setup on the newly released organizer exposed a duplicate-write conflict: typing payouts dirtied the whole-board PUT draft while explicit Save PATCH wrote canonical payout_descriptions and advanced the same revision. The PUT does not persist canonical payouts, so simply removing PATCH would silently lose rules on reload.

Payout text now stays in its own visibly unsaved form, warns before page exit, and saves through the canonical endpoint before preview/share/publish. The draft coordinator serializes external revision writes: flush pending board edits, save payouts, apply the returned fields while preserving concurrent local changes, then drain those changes. Structured conflict errors survive delayed React revision updates; other-session changes remain blocked pending reload. Ordinary payout failures retain the form for retry. No schema or allowance changes.

RED/GREEN: duplicate PUT on payout typing and PUT during pending PATCH each reproduced before correction. Added delayed revision conflict, concurrent-edit preservation, published payout, failed retry, unload and preview-gating tests. Focused run: 5 files / 93 passed; TypeScript passed. Independent read-only review found the unload and delayed-conflict gaps, then confirmed both resolved.

Final gates: npm run test:unit -- --maxWorkers=2 — 106 files / 796 passed. An initial unrestricted run concurrent with browser/build hit 3 existing 5-second test timeouts; bounded rerun passed all. Production-configured npm run build passed; design lint 0 errors / 5 existing warnings. Chromium: all 84 existing checks passed; new payout regression initially used the old title-blur interaction, corrected to commit title via Tab, then passed Chromium and WebKit (2 passed), plus independent Chromium rerun (1 passed). New browser fixture enforces PUT revision 1 then PATCH revision 2 and verifies four $100 payouts, notes, and title after reload with zero conflicts. Earlier full integration 66 passed / 1 skip remains applicable; no database code changed.

Live dummy board has 100 Demo Family allocations and paid demo notes, saved fixed axes, and square one renamed Demo Participant 1 while responsibility remains Demo Family. First-game selection is NE at SEA, September 9 at 7:20 PM Central. Final payout repair deployment and canonical save/reload follow this commit. Publication is subject to the existing free account allowance already consumed by Test1; no purchase or entitlement override has occurred.

Live result: Cloudflare production deployment 617ec94e-4be8-46c2-83b5-596a03083478 released 5eaa70d; getgridone.com serves verified index-C8EWT1v-.js. Signed-in Safari successfully saved and reloaded all four canonical $100 payout descriptions and the explicit dummy-only notice without conflict. The private preview rendered those amounts with all 100 assignments, preserved responsibility and fixed axes. Publishing demo a534750d-2856-48e3-bd47-ac9bec3a26ee reached the expected allowance gate: existing Test1 uses Free 1 of 1; UI offers $9.99 Game Day checkout. No checkout, purchase, entitlement change, or public demo publication occurred. Public-viewer verification remains blocked on the owner decision.

September 7 owner-authorized test replacement: Anthony requested deletion of Test1 to use the prepared NE at SEA board for Wednesday. Verified exact board/owner and board_activations ON DELETE CASCADE; deleted only Test1 c1eaa2c6-312e-4238-89c1-53eeb9793169 through the administrative connector. Existing free slot returned to 0 of 1. Published prepared board via signed-in Safari; database now confirms new board published, Free 1 of 1, and old board absent. Independent signed-out browser verified https://www.getgridone.com/b/6BKE6UEQ renders all 100 entries, four $100 payouts, demo notice and fresh ESPN Pregame 0–0. No purchase, schema change or generalized published-board deletion permission introduced. The earlier publication blocker is resolved.

## 2026-09-08 — Approved simpler board journeys (local implementation)

User approved implementation after the written plan and visual concepts in the voice-planning thread. Work is isolated on `codex/simple-board`, based on `118da4a`. No production data, migrations, deployment, commits, packages, or outreach were authorized or performed.

Implemented public create preview with validated 24-hour session recovery/auth adoption; explicit participation instructions and availability; named/blank vocabulary; scoped seven-day family capabilities and deliberate reassignment; safe repeat-board setup using authoritative prize descriptions; demo/final-board growth invitation. Existing prices and score authority remain unchanged. Public viewer links still cannot edit; private family links confer only scoped pre-finalization names/availability.

TDD evidence:
- Participation data: `npx vitest run --project unit tests/participationData.test.ts` RED4 (missing validation/projection) → GREEN4; combined participation card/data/pregame GREEN20. ParticipationCard stub RED missing field → GREEN explicit public-field test.
- Sales: focused model/component tests RED5 → GREEN6; metadata RED1 → GREEN7. Family component RED missing surface → GREEN, later partial blank/invalid response/dirty guard RED → GREEN6.
- Create: draft module RED and UI RED3 → GREEN12; malformed axes RED1 → final creation GREEN15. Validated axis/name bounds and allowlist removed stored transport state. Desktop layout inspected and changed to two columns.
- Family endpoints: stub RED6 → GREEN6; malformed action object RED → GREEN7. Tokens are random256-bit values, hashed at the API, passed only as bearer headers, and never stored plaintext. Mutations have no automatic retry.
- Owner family card and square availability: card RED missing actions; explicit availability RED1 → GREEN15 combined. Expiration/old-new reassignment review/copy fallback/focus restoration tested. Private-note reload RED → GREEN.
- Repeat: conflicting stored prize descriptions, missing authoritative query field, and final action callback RED3 → GREEN72 across model/dashboard/workspace. Copies title and current prize descriptions only; no people, notes, credentials, game, digits, or IDs.
- SQL migration027: absent-table RED7 → GREEN10 real disposable PostgreSQL security/concurrency tests. Final participation allowlist injection RED → GREEN. Combined family/sharing/published rename integration GREEN27. CLI was absent, so the existing numbered migration convention was used without installing a package. No hosted SQL was run.

Review caught and fixed blank allocated squares blocking partial edits, object actions escaping API validation, missing link expiry, stale private payment notes after reassignment, authoritative repeat descriptions, and an in-flight private-note/reassignment race. New metadata defaults preserve legacy unspecified availability; generic existing payment notes are not reinterpreted.

Verification before final freeze: TypeScript passed; build passed; design lint zero errors/five existing warnings. Full unit suite835/835 passed. Full disposable database suite76 passed, one pre-existing hosted checkout proof skipped. Initial Chromium pass86/89; two obsolete signup-before-preview expectations corrected, one local HMR-interrupted run to be repeated after edit freeze. Phone/desktop family, sales, and new organizer/create screenshots were inspected; expanded-surface axe checks have no serious/critical findings in successful runs. Browser data is isolated fixtures, not a live signed-in account.

Release boundary: migration027 must be applied and verified before the corresponding app release. Revoke active family access to roll editing back; retain names, audit history, and public links. No production launch or live organizer validation is claimed. Human pilot/revenue validation and assistive-technology platform checks remain separate from local engineering verification.

Final verification after review fixes:
- `npm run test:unit -- --maxWorkers=2`:114 files,837 tests passed (37.09s). Two-worker execution avoids contention with browser runs; no timeout changes or test suppressions.
- `npx playwright test --project=chromium`:93 passed (1.5m), including both widths of the complete allocate/share/rename/finalize flow, expanded family controls, auth-preview restoration, axe, reduced motion, keyboard and reflow.
- Targeted `--project=phone-webkit` family/create/viewer:11 passed; the four create/organizer cases were rerun after final readiness fix and passed again (13.4s).
- `npm run test:integration`:11 files,76 passed, one existing opt-in hosted-checkout proof skipped; no production account used. Latest family migration also passed its10 security/concurrency cases plus pregame/published rename combined27.
- `npx tsc --noEmit`, `npm run build`, `npm run design:lint`, and `git diff --check` passed. Design lint retains five existing warnings, zero errors.
- An initial-load keystroke race appeared in the real browser payout regression: the owner workspace briefly mounted before private notes resolved. Explicit `hasLoadedEntries` now prevents that first editable mount. New hook test RED→GREEN; original payout browser regression passed five consecutive runs, then the complete93-test gate.
- The blank-square wording correction also covers the organizer's accessible label. A duplicate failure alert was changed to a recovery status while retaining the original failure announcement.

Final screenshots and complete logs are preserved outside the repository at `/Users/amm13/Documents/Codex/2026-09-08/new-realtime-voice-chat/gridone-implementation/`. Canonical main remains clean at118da4a; all implementation is local to `.worktrees/simple-board`. Not committed, pushed, deployed or applied to a production database. Real signup/provider integration, hosted checkout, human usability/pilot revenue evidence and VoiceOver/NVDA remain unverified by this local fixture-based UI pass.

## September 9 — Live quarter results and viewer redundancy

Anthony authorized implementation, commit, push and production deployment. The existing public test board had a confirmed Q1 Demo Family 0/0 record; ViewerShell only rendered named records at Final. Completed results now appear during live play immediately after Find my squares, before the personal list. Payout rows pair amounts with winner/OPEN/pending/unconfirmed status; correction history remains visible. Current matching is explicitly distinct from confirmed milestones.

The floating score appears only after the main score/trust block scrolls above the viewport. Removed repeated ordinary quarter/clock text while retaining meaningful provider details (Halftime, delays). Personal squares render once with current status first, matching row first, four initial rows and accessible full-list expansion. Desktop hides the duplicate grid Find action; phone retains it. No scoring, schema or production data changes.

RED: `npx vitest run --project unit tests/viewerShell.test.tsx tests/viewer/scoreInstrument.test.tsx` (4 expected failures); completedResults (4 expected failures); personal (2 expected failures); meaningful phase detail (1 expected failure). GREEN: all focused cases pass. Final `npx tsc --noEmit`, `npm run build`, and `npm run test:unit -- --maxWorkers=2` pass (115 files, 846 tests). `npm run design:lint`: 0 errors, 5 existing orphan-token warnings. `npm run test:integration`: 11 files, 76 passed, 1 skipped. Final `PLAYWRIGHT_PORT=5198 npx playwright test --project=chromium --workers=1`: 96 passed. Earlier overlapping browser runs had server shutdown/reload timing failures; isolated serial run passed without test suppression. Viewer Chromium + phone WebKit: 16 passed, including 320/390/1440, reduced motion, Q1 during Q2, and 99-square expansion/collapse. Rendered phone/desktop screenshots inspected under /tmp/gridone-viewer-*.png. Logs: /tmp/gridone-q1-release-*.log and /tmp/gridone-q1-browser-serial.log.

Rollback is a revert of this viewer-only commit followed by redeployment; confirmed winner records remain intact. Production revision and live verification will be reported after release.

## 2026-09-10 — npm dependency audit remediation (local only)

- Scope: user authorized dependency updates and local verification. Updated exact Wrangler 4.125.0 → 4.131.0 and its required optional peer workers-types 5.20260822.1 → 5.20260910.1; refreshed transitive Babel core 7.28.6 → 7.29.7 and browserslist 4.28.1 → 4.28.9 within existing ranges. Wrangler now resolves Miniflare 5.20260910.0-alpha and Sharp 0.35.4. Related Babel, browser-target data, workerd, and Sharp native packages update with those chains. No overrides or Babel major upgrade added.
- RED: `npm audit --json` reproduced 5 flagged packages (4 high, 1 low): Babel core, browserslist, and the inherited Wrangler → Miniflare → Sharp chain. GREEN: after `npm install --save-dev --save-exact wrangler@4.131.0 @cloudflare/workers-types@5.20260910.1` and `npm update @babel/core browserslist`, `npm audit` reports zero vulnerabilities. `npm ls` confirms patched versions and satisfied peers. This establishes removal of the reported vulnerable dependency versions, not a full application security audit or proof of prior production exploitability.
- Boundary: Babel/browser targeting are build dependencies; Sharp is beneath local Cloudflare tooling. Repository inspection found no application Sharp callers or Images binding; board import sends image data to Gemini and PNG export uses browser canvas. Independent read-only investigation and candidate review found no concrete surviving dependency finding or compatibility regression. Current Node 24.14.1 satisfies Wrangler's Node >=22 requirement.
- Verification: `npx tsc --noEmit` passed; `npm run test:unit -- --maxWorkers=2` passed 115 files / 846 tests; `npm run test:integration` passed 11 files / 76 tests, with the existing opt-in hosted-checkout test skipped; `npm run build` passed; `npm run design:lint` passed with zero errors / five existing warnings; `PLAYWRIGHT_PORT=5207 npx playwright test --project=chromium --workers=1` passed 96/96, including phone/desktop reflow, keyboard, reduced motion, axe, and organizer/viewer workflows. `git diff --check` passed.
- Tooling compatibility: `npx wrangler --version` returned 4.131.0 and `npx wrangler pages functions build --outdir /tmp/gridone-dependency-audit-20260910/functions-build` passed. An isolated `wrangler dev --local` worker returned HTTP 200 / dependency-smoke-ok and was stopped afterward. Initial ad hoc direct-Miniflare smoke attempts used obsolete constructor shapes and failed validation; the supported Wrangler local path passed without application changes.
- Existing GSAP manifest/lock entries, Playwright configuration, and prior log entries preserved. Changes for this task are package.json, package-lock.json, and this appended record. No application source changes or new regression tests were needed for the dependency-only fix. No commit, push, deployment, or production configuration/data changes. Logs and before/after audit evidence: `/tmp/gridone-dependency-audit-20260910/`. Rollback only this dependency update and reinstall the lockfile; preserve the pre-existing work (rollback restores the flagged versions).

## 2026-09-10 — Static editorial hero approval checkpoint (local only)

- Scope: implemented only the approved desktop/mobile hero checkpoint. Replaced tilted, animated hero canvases with static preparation and published game-day excerpts of the same fictional Lincoln Softball Booster Board. Preparation names/counts come from organizer demo data; the sample score's KC 7 / PHI 4 digits match Taylor M.'s finalized sample square. Excerpts contain no controls or focus targets. Updated hero copy, action label, no-JavaScript copy, and affected expectations. Shared pricing, product behavior, remaining homepage chapters, and pre-existing dirty package/config/log changes are preserved.
- Responsive design: viewer-first DOM order and phone composition; near-flat preparation-led desktop scene. Essential interface text uses rem units; at 320px/200% text the square excerpt reflows to one column. Removed hero parallax, reveal wrappers and breathing spotlight. Lower-page effects and the future GSAP explanation remain deferred until hero approval.
- RED: `npx vitest run --project unit tests/homepage/homepage.test.tsx` failed 4 expected assertions against the old hero (29 passed). The four new Playwright static/reflow checks also failed against the old hero before implementation. GREEN/REFINE: focused browser checks exposed low desktop copy placement and enlarged-score overflow; both corrected. Render inspection then improved enlarged square readability. Production timing exposed a font-swap extra headline line; responsive sizing now accommodates the fallback font and a new font-blocked browser test verifies the result.
- Verification: `npx tsc --noEmit` passed; final `npm run test:unit -- --maxWorkers=2` passed 115 files / 847 tests. `npm run build` passed. `npm run design:lint` passed with 0 errors and 5 existing orphan-token warnings. Full `PLAYWRIGHT_PORT=5198 npx playwright test --project=chromium` passed 99/100; one organizer test navigated during its axe evaluation. Rerunning the entire affected organizer-flow file plus homepage passed 19/19. Final homepage Chromium + WebKit run passed 32/32, including blocked fonts and no-JavaScript. Earlier unit failures from outdated copy/single-identity expectations were corrected; organizer timeout cases passed targeted rerun and the clean full unit run. `git diff --check` passed.
- Visual/accessibility evidence: inspected 1440px desktop, 390px phone, 320px, 768px tablet, and 320px with 200% root font. Hero-only axe checks returned no findings across these five states. Keyboard focus/action destinations and noninteractive excerpts are covered by browser checks; no assistive-technology session or database integration run was performed for this hero-only slice.
- Performance: three fresh Chromium contexts per width against production Vite preview, no throttling. Browser-reported resource transfers (excluding HTML) fell 241,190 → 240,465 bytes; encoded JS bodies fell 222,900 → 221,927 bytes. Median desktop LCP 648 → 564 ms, CLS 0.00848 → 0.00741; phone LCP 648 → 196 ms, CLS 0.00424 → 0. These local diagnostic samples are not field performance claims. Essential hero content requires no animation runtime. Full-page weight will be measured again after approved consolidation.
- Review artifacts: `/Users/amm13/.codex/visualizations/2026/09/10/01a08d66-1ea6-7fa0-9c67-a0c764644ca7/gridone-static-hero/` contains desktop/mobile/enlarged-text captures, raw before/after metrics, the measurement script, and review notes. Local browser: `http://127.0.0.1:5198/`.
- Status: stopped for Anthony's explicit static hero approval, as requested. No commit, push, deployment, schema, production configuration/data, generated imagery, or package changes by this slice. Next phase is the approved full-page consolidation and one scoped explanatory animation only after hero acceptance.

## 2026-09-10 — Approved full editorial homepage (local only)

- Anthony approved the static heroes with “looks good.” Completed the remaining page: one ivory organizer composition, one charcoal score-to-digits-to-current-match explanation with participant and arithmetic examples, quiet unchanged pricing, FAQ, final actions, and grouped guides. Same fictional board data and explicit sample labels throughout; payment details remain private organizer recordkeeping. Hero excerpts remain static and nonfocusable, with functional /create and /demo handoffs.
- Removed obsolete homepage parallax, reveals, fill animation, duplicate render adapters, and their unused implementations/tests. Shared design primitives with remaining consumers are preserved. GSAP is dynamically imported only on explanatory-section entry, plays once without pinning/scrubbing, and scopes/cleans its context, observer and media listener. Reduced motion or import failure leaves essential static content visible. Updated design/architecture/accessibility documentation to the approved composition.
- RED: new story assertions failed against the old page (3 unit and 2 browser failures); lifecycle test initially failed for the missing hook. GREEN: focused story/lifecycle tests pass. Full TypeScript and production build passed; full unit suite passed 113 files / 777 tests; full Chromium suite passed 100 tests. Design lint passed with 0 errors and 5 existing orphan-token warnings. After the final responsive refinement, the focused unit group passed 88/89 with one duplicated-text test selector failure; corrected that assertion and its entire file passed 3/3. Targeted Chromium/WebKit run had 36/44 passes, revealing hidden responsive selector ambiguity and a 3px decorative border overflow; both fixed, and the entire affected studio file reran 20/20 passing. No assertions were suppressed. Final git diff whitespace check passed.
- Render review covered desktop 1440, phone 390, tablet 768, 320px reflow and 200% text. Enlarged-text review caught names fragmenting inside the grid: narrow containers now show one readable current matching square, while wider views retain the grid excerpt. Final full-page axe sweeps at 1440, 390 and 320/200% returned no violations. Browser coverage includes static preview semantics, pricing, no JavaScript, missing fonts, reduced motion, GSAP failure, cleanup/re-entry, keyboard/action handoffs and overflow. No database integration or assistive-technology session was performed for this presentation-only slice.
- Performance: same production preview, fresh Chromium contexts, no throttling, three initial-load runs per width. Browser-reported resource transfer excluding HTML: 241,190 → 234,086 bytes (-2.9%); encoded JavaScript bodies: 222,900 → 216,874 bytes (-2.7%). Median desktop LCP 648 → 580 ms; phone 648 → 264 ms. Desktop CLS 0.00848 → 0.00741; phone 0.00424 → 0. Initial layout had no horizontal overflow. Scrolling to the explanation deferred an additional 28,050 transfer bytes / 27,750 encoded JavaScript bytes (total 262,136 / 244,624); animation reached complete. These are local diagnostic samples, not field performance claims.
- Evidence: /Users/amm13/.codex/visualizations/2026/09/10/01a08d66-1ea6-7fa0-9c67-a0c764644ca7/gridone-editorial-complete/ contains desktop/phone page and section captures, enlarged text, before/after metrics and measurement script. Preview: http://127.0.0.1:5198/.
- Preserved unrelated package, lockfile, Playwright config and prior log edits. No new packages, generated imagery, API/schema/permission/pricing changes, commit, push, deployment or production data/configuration changes. Rollback is limited to this homepage slice; preserve unrelated working-tree edits.

## 2026-09-10 — Editorial homepage release authorization

Anthony authorized commit, push and deployment after approving the completed local page. Release includes the existing GSAP manifest/lock entries required by the explanatory animation. Unrelated Playwright fixture configuration and its log entry remain local. Build and deployment will use the committed source; production revision and live checks will be recorded after release.


## 2026-09-10 — Organizer island and private Payments (implementation)

- Anthony approved the organizer island/payment overview plan and requested implementation. Status-only tracking by responsible person/family; task-adaptive island; preserve name entry. Working on `codex/organizer-island-payments`; prior Playwright configuration and existing log content preserved. No commits, package installation, production writes or schema changes.
- Added exact responsibility grouping, distinct Paid/Unpaid/Not asked yet counts, search, explicit visible-group/square selection, payment-only persistence with complete receipts, retry/error truth, and board focus handoff. Existing owner RLS protects metadata; payment notes never enter public/family projections or gate publication.
- Replaced organizer rings with readable task/save/game information and deliberate token-based expansion. Added cancellable touch hold, stable focus handoffs and compact-height reservation; shared viewer island unchanged. Consolidated header controls and draw summary so board work stays prominent.
- RED: payment persistence 7 missing-function failures; payment model/panel missing-module failures; workspace new Payments/Preview checks 2 failures; island missing model then actual save-status mismatch failures; new browser suite initially 4 missing-Payments failures. GREEN: persistence 7 tests, payment model/panel 8 tests, island 11 tests, workspace 59 tests. Obsolete ring/duplicate-action expectations now assert readable statuses and scope the actual island actions.
- Disposable PostgreSQL family/private metadata suite: 11 tests passed including narrow payment upsert preservation, stranger denial, anonymous permission denial, and family projection privacy. The first new test expected zero anonymous rows; the schema correctly denies table access entirely, so the test was corrected to assert denial.
- Browser verification caught Safari mouse-trigger focus restoration and a low-contrast helper over the translucent sheet; fixes are included. Full release gates and final visual review results follow below.

Final verification and review:
- `npm run test:unit`: 117 files / 806 tests passed. After final sheet presentation/copy polish, the affected Payments panel file passed 7 tests again. `npm run test:integration`: 11 files / 77 passed, 1 existing opt-in hosted-checkout test skipped. Tests use disposable PostgreSQL and fixture accounts; no production writes.
- `PLAYWRIGHT_PORT=5188 npx playwright test --project=chromium`: 110 passed. Final affected accessibility-contract rerun: 23 passed. Organizer payment/island Chromium and WebKit: 18 passed on frozen final source. Earlier failures exposed an obsolete ambiguous save-status selector and HMR-interrupted clicks; corrected selector scope and repeated frozen-source runs without weakening behavior assertions.
- `npx tsc --noEmit`, final `npm run build` (also runs TypeScript), `npm run design:lint` (0 errors / 5 existing warnings), and `git diff --check` passed. No packages or migrations added.
- Visual review covered 1366 desktop, 390 phone, 820 iPad, and 320 with 200% text. Fixed cramped phone header wrapping and opaque Payments surface after real WebKit screenshots showed competing board text. Shared Sheet opacity is opt-in; its Close label now uses the documented 17px body size after a design hook flagged the former 15px literal. Hook rescan has no deterministic finding.
- Browser tests cover exact family/individual selection, filtered bulk scope, receipt-confirmed persistence/reload, error recovery, focus restoration, opaque sheet rendering, axe, reduced motion, normal-motion intermediate geometry/reversal, and touch hold/release/movement cancellation. Touch events are synthetic plus browser scrolling; native touch hardware and VoiceOver/NVDA were not exercised.
- Independent review found and resolved stale board-focus requests and missing accessible island summary descriptions. Payment-only database writes preserve contacts, seller labels and notification preferences; public/family projections remain private. Game-day primary actions surface score/delivery review and final results through existing panels.
- Final screenshots and gate logs: `/Users/amm13/.codex/visualizations/2026/09/11/01a08dd1-0320-7b31-8e97-edd60ef90cac/organizer-payments/`. Full focused browser artifacts: `/tmp/gridone-payments-opaque-final/`.
- Local implementation only on `codex/organizer-island-payments`. No commit, push, deployment, production schema/configuration/data changes, or live account verification. Rollback this organizer slice and optional Sheet presentation prop; retain pre-existing Playwright config/log edits and existing payment metadata.

## 2026-09-11 — Organizer release authorization

Anthony explicitly authorized commit, push and deployment. Release the organizer island and private status-only Payments slice; preserve unrelated Playwright configuration and prior release-log edits locally. No schema migration is needed. Fresh build, unit and design checks precede release; deployed revision and live results follow.

## 2026-09-11 — Marketing-copy audit and release

- Anthony supplied six copy fixes and then authorized proceeding through verification and deployment. Gilfoyle implemented the bounded homepage/demo pass; Anton independently reviewed it and completed the standardized money boundary across organizer, viewer, terms and transactional-email disclosures. Exact words remain under regression tests; responsibilities and legal context are retained.
- Six unique chaos pains, plain-English seasonal sharing/publication FAQ, beginner score explanation with adjacent Final/overtime qualification, defensible reviewed photo-import Beta copy without a speed promise, and “Sample board — not a live game” caption. Current-week demo rotation is deferred.
- Released from isolated `fix/marketing-copy-audit-20260911`, based on production `4d7c3ec`, excluding canonical checkout’s existing publishing/upgrade/test-harness/log edits. Protected-file SHA-256 hashes matched Gilfoyle’s initial snapshot. No billing, score, database, schema, dependency or configuration change.
- Anton’s additional consistency test reproduced nine stale-disclaimer failures before the text-only repair. Final independent gates: 118 unit files / 823 tests; 11 disposable-PostgreSQL integration files / 77 passed and one existing skipped test; TypeScript and production build pass; design lint 0 errors / 5 existing warnings; full Chromium final run 110 passed. First Chromium run had 109 passed / one organizer motion reversal failure, also observed intermittently by Gilfoyle; no motion code/assertion was changed or weakened. A green rerun does not establish absence of flakiness.
- Actual production-configured build passed read-only browser smoke at 1440 and 390: exact six-entry list, hero/footer boundary, expanded FAQ, import/score wording, demo caption, terms boundary, no horizontal overflow and no page errors. Reviewed desktop/phone screenshots are readable without overlap.
- Cloudflare production secret listing confirms `GEMINI_API_KEY` exists; no secret value was read or changed. Live authenticated OCR/provider success remains unverified. Existing implementation and error-path tests support Beta wording, not perfect accuracy or latency promises.
- Evidence: `~/.hermes/workspace/gridone-copy-audit-result.md`, `gridone-copy-audit-logs/`, `gridone-release-local/results.json`, and `/tmp/gridone-release-*.log`. Production revision/live verification is recorded by Anton after release. Rollback: revert this copy-only commit or redeploy production `4d7c3ec`; no data migration is involved.
