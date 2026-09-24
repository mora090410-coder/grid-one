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

## 2026-09-10 — Deterministic authenticated Playwright fixture configuration

- **Scope:** `playwright.config.ts` now pins the browser dev server to a non-secret Supabase-shaped test URL and dummy anon key. Organizer fixtures seed the matching project-derived local-storage key, so authenticated browser routes no longer silently boot the placeholder client and redirect to `/login` when local environment variables are absent.
- **Behavior boundary:** production source, server functions, schema, score authority, publication, payment, deployment, and production credentials/data are unchanged. The test URL/key are fixture values; all browser data and API calls remain intercepted by Playwright routes.
- **Failure reproduced:** an environment-unset `npx playwright test --project=chromium` run failed **30/96** checks. The common failure was the login route replacing mocked organizer routes; a targeted `playwright-tests/organizer.spec.ts` rerun failed **4/5**.
- **GREEN verification:** after configuration, `PLAYWRIGHT_PORT=5199 npx playwright test --project=chromium` passed **96/96**. `npx tsc --noEmit`, `npm run test:unit` (**115 files / 846 tests**), `npm run test:integration` (**11 files / 76 passed / 1 skipped**), `npm run build`, `npm run design:lint` (**0 errors / 5 existing warnings**), and `git diff --check` passed.
- **Rollback:** revert the `playwright.config.ts` test-environment addition. This restores the prior environment-dependent browser fixture behavior; no domain state is affected.

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

## 2026-09-10 — Editorial homepage production verification

- Committed and pushed `aaa46178dd16226eb9fd952ff5bf5b48800d572b` to origin/main with Anthony's explicit authorization. Clean git-archive production build (TypeScript included), 113 unit files / 777 tests, and design lint passed (0 errors, 5 existing warnings).
- Cloudflare Pages project grid-one deployed production revision aaa4617: direct deployment f8e77bf7-3abc-4ab7-97b7-abb9fa4da763; Git-connected deployment 1273d4f7-a899-43a6-b856-c455c271d574 also reports the same source. The canonical domain served index-DzrXjrwx.js during final browser verification.
- Live https://www.getgridone.com/ verified at 1440 and 390: approved heading/story, zero horizontal overflow, explanatory animation complete, no page errors, sample-board handoff renders demo score and participant content, creation handoff renders board naming and game selection. No board was created or production data mutated. Initial networkidle-based probe timed out on network activity; bounded DOM/content checks then passed both widths.
- Live captures and JSON evidence saved alongside prior review artifacts in gridone-editorial-complete. Unrelated playwright.config.ts and its earlier log entry remain uncommitted; this post-release evidence is appended locally. Rollback target preceding this homepage release is 74f029d; no database rollback is required.


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

## 2026-09-11 — Organizer production verification

- Committed `4d7c3eca93b06a53b3bf73a0b10989ab833099a8` and pushed atomically to origin/main and codex/organizer-island-payments with Anthony's explicit authorization. Local main points to that revision. Pre-existing Playwright configuration and earlier release-log edits remain local.
- Fresh release checks: build/TypeScript passed; design lint 0 errors / 5 existing warnings; unit suite 117 files / 806 passed. A separate clean git-archive build used committed public Vite configuration and passed.
- Cloudflare Pages grid-one production deployment f44df85c-c5e8-44ad-990e-9bb82ca2c562 completed from the clean committed-source build. Git-connected production deployment 46631912-d4b0-43da-b1cb-38203e0494ef also completed for the same source. Canonical www.getgridone.com serves index-DYtSiNO3.js.
- Live homepage-to-sample-board handoff verified at 1440 and 390, no horizontal overflow and no page errors. Deployed organizer assets passed all 18 Chromium/WebKit payment/island checks with isolated API fixtures; unmatched writes were explicitly aborted. This verifies the deployed frontend, not a real account payment write.
- The Mac was locked, preventing native access to Anthony's signed-in board. No production payment data was changed, and a live authenticated owner save is not claimed. No schema migration was required. Rollback is redeploying aaa4617.
- Logs and deployed frontend captures preserved under the current organizer-payments visualization directory. This post-release evidence is appended locally; application release remains exactly 4d7c3ec.

## 2026-09-11 — Clarify seasonal board allowance

Replaced conversational free-to-Game-Day upgrade copy with the one-board-per-season rule, the paid plan name, $9.99 once for five total published boards in 2026 including the first board, and an explicit statement that a finished game does not reset the allowance. Updated the publish endpoint message to remove the misleading claim that the first board is still live. Pricing, allowance enforcement and checkout behavior unchanged. Existing focused UI/API expectations RED: 2 failed / 19 passed; GREEN with pricing consistency: 24 passed. Build including TypeScript passed; design lint 0 errors / 5 existing warnings. Local copy changes only; no commit, push, deployment or payment performed.

## 2026-09-11 — Marketing-copy audit and release

- Anthony supplied six copy fixes and then authorized proceeding through verification and deployment. Gilfoyle implemented the bounded homepage/demo pass; Anton independently reviewed it and completed the standardized money boundary across organizer, viewer, terms and transactional-email disclosures. Exact words remain under regression tests; responsibilities and legal context are retained.
- Six unique chaos pains, plain-English seasonal sharing/publication FAQ, beginner score explanation with adjacent Final/overtime qualification, defensible reviewed photo-import Beta copy without a speed promise, and “Sample board — not a live game” caption. Current-week demo rotation is deferred.
- Released from isolated `fix/marketing-copy-audit-20260911`, based on production `4d7c3ec`, excluding canonical checkout’s existing publishing/upgrade/test-harness/log edits. Protected-file SHA-256 hashes matched Gilfoyle’s initial snapshot. No billing, score, database, schema, dependency or configuration change.
- Anton’s additional consistency test reproduced nine stale-disclaimer failures before the text-only repair. Final independent gates: 118 unit files / 823 tests; 11 disposable-PostgreSQL integration files / 77 passed and one existing skipped test; TypeScript and production build pass; design lint 0 errors / 5 existing warnings; full Chromium final run 110 passed. First Chromium run had 109 passed / one organizer motion reversal failure, also observed intermittently by Gilfoyle; no motion code/assertion was changed or weakened. A green rerun does not establish absence of flakiness.
- Actual production-configured build passed read-only browser smoke at 1440 and 390: exact six-entry list, hero/footer boundary, expanded FAQ, import/score wording, demo caption, terms boundary, no horizontal overflow and no page errors. Reviewed desktop/phone screenshots are readable without overlap.
- Cloudflare production secret listing confirms `GEMINI_API_KEY` exists; no secret value was read or changed. Live authenticated OCR/provider success remains unverified. Existing implementation and error-path tests support Beta wording, not perfect accuracy or latency promises.
- Evidence: `~/.hermes/workspace/gridone-copy-audit-result.md`, `gridone-copy-audit-logs/`, `gridone-release-local/results.json`, and `/tmp/gridone-release-*.log`. Production revision/live verification is recorded by Anton after release. Rollback: revert this copy-only commit or redeploy production `4d7c3ec`; no data migration is involved.


## 2026-09-13 — Organizer availability, person payments, and publishing continuity (local)

- Anthony approved the bounded UX follow-up after the live Raiders and Sunday Night test-board walkthrough: preserve name entry; separate public availability; make marking a person's remaining squares paid direct; keep publishing progression visible.
- Removed availability from SquareSheet while preserving existing labels during name saves. Added explicit board selection actions for available, unavailable and removing a label; names and private metadata remain unchanged.
- Compact payment responsibility rows expose Mark all N paid / Mark remaining N paid before individual-square expansion. Group actions include the full person's scope with explicit filtered-view copy, receipt-based success, duplicate-write protection and retry invalidation when group contents change. Closing Payments restores the organizer board task.
- Prepare to publish continues through Use numbers and continue directly into the saved private preview. Review and publish remains outside scrolling content; a wider desktop preview fixes the compressed embedded viewer. Shared selling boards retain the same link through finalization.
- Verification: npx tsc --noEmit passed; npm run test:unit 119 files / 836 passed; npm run build passed; npm run design:lint zero errors / five existing orphaned-token warnings; npm run test:integration 11 files / 77 passed / one existing skip. Full serial Chromium run: 114 passed, one ambiguous partial-name test selector failed after action-label changes. Scoped that selector to the private-preview dialog with exact button name; affected user-workflows file rerun: six passed. All 115 cases have passing evidence. Phone/desktop screenshots and keyboard, touch target, payment persistence, availability isolation and shared-link finalization checks passed. Independent diff review found no substantive defects.
- Evidence: /Users/amm13/.codex/visualizations/2026/09/13/01a09ace-e68d-75d2-9ec0-d72734077fa5/gridone-ux/local/implementation.md; command logs /tmp/gridone-ux-{unit-final,integration,build-final,design-final,chromium-final,workflows-final}.log. Existing unrelated checkout edits preserved. Local implementation only: no commit, push, deployment, schema or configuration change.


## 2026-09-13 — Organizer UX production release verification

Committed and pushed `09cea569188ebce2346dd8545ac710c1e1cde86b` to origin/main. Cloudflare Pages deployment `091f43e9-152b-41d0-98a6-ed5b56408794` succeeded. Canonical production and deployment serve the identical index-B9r8g8F6.js asset (SHA-256 b8744061b0fd9eb34ff67a188cfa183b60d2e1f37105d2030fbaf83ff03af563).

Exact staged-source validation: 119 unit files / 836 passed, production build including TypeScript passed, design lint zero errors / five existing warnings. Prior full implementation verification included 77 passing integration tests and all 115 Chromium cases (one selector correction followed by a passing six-test file rerun).

Deployed frontend verification: 17 Chromium tests passed at phone/desktop widths, covering direct person payment actions, persistence/failure behavior, keyboard availability selection, visible publish continuation, and shared-link finalization. These tests used isolated API fixtures with unmatched API/auth/database requests blocked; no production fixture writes occurred. In the actual signed-in browser, the published Raiders test board showed all 100 squares paid in the new compact Payments panel. Closing it restored pregame status; the browser returned to Your boards.

Unrelated working files were hash-checked unchanged before commit and remain local. No schema or configuration change. Rollback is redeploying prior production revision 373f1ee. Release evidence is local; the application commit remains exactly 09cea56.

One redundant unit run in the dirty canonical checkout, overlapping isolated verification, timed out in a 5-second workspace test; the complete exact staged-source run passed. No timeout/assertion was weakened.


## 2026-09-13 — Remove extra ESPN live-score CDN delay

- Reported severe score delay reproduced against Bears event401872661. At17:58UTC the stable CDN scoreboard showed CHI21–CAR7 and13:57Q2 while ESPN's site scoreboard showed21–13 and12:40Q2. The CDN advertised minutes of remaining cache lifetime. Scheduler tail showed healthy minute ticks.
- Confirmed Cloudflare still receives an HTML denial from the site API. A remote development probe on Cloudflare at18:00:04UTC returned21–7 from the stable CDN URL and21–14 from the same CDN with a current gridone_live query bucket. A later actual-adapter probe showed the revised scoreboard advancing to11:57 while the stable URL remained12:40. No production probe route or credentials added.
- Live scoreboard and live exact-event summary requests now use one shared CDN query key per30-second window. Schedule discovery retains stable URLs. Upstream call frequency, timeouts/retries, leases, event/team identity validation, manual authority, milestone and notification logic remain unchanged.
- RED tests captured stale scoreboard27 instead of30 and stale exact-game clock0:00 instead of12:40. Focused adapter/cache/activation suite GREEN43/43. Full unit suite GREEN838/838 after fixing pregame workspace fixtures that depended on the real wall clock and failed after today's kickoff. Integration checks also exposed fixed-date pregame fixtures; only fixture times are being repaired, with cutoff assertions retained. Production build/TypeScript and design lint passed; final browser/integration and live release evidence follow below.

- Final release validation:838 unit tests;43 focused provider/cache/activation tests;77 integration tests with one existing skip (75 passed initially, then both date-fixture failures passed in focused5+7-test reruns); TypeScript, clean staged-source build and design lint passed. Chromium113 passed initially; two navigation-interrupted cases passed on focused rerun with no assertion change. Independent review found no substantive defects. No production scoring, milestone, permission or schema logic changed beyond upstream live request cache keys.


## 2026-09-13 — Live scoring cache fix production verification

- Released d509ff1 to origin/main and Cloudflare deployment 0b21535e-4caa-4092-b1d4-5e902ad177be. At 18:09 UTC production and the fresh adapter matched 21–14, 9:21 Q2; the stable CDN URL still showed 10:34. The signed-in Bears organizer displayed the updated score after reload. Existing polling/feed latency remains.
- Full evidence: /Users/amm13/.codex/visualizations/2026/09/13/01a09ace-e68d-75d2-9ec0-d72734077fa5/score-delay/result.md. Unrelated local changes preserved; rollback 09cea56. This verification note remains local.


## 2026-09-13 — Halftime Q2 confirmation correction prepared

- Live Bears board CUTHWDMM showed 31–24, period 2, state in, detail Halftime, clock 0:00, with only Q1 confirmed and no Q2 pending. Read-only production SQL confirmed Q2 eligibility waited for period > 2 or post. Production unchecked-function prosrc MD5 d75b7cc0c655f9692d12925c27a094cf matched migration 022 exactly.
- Prepared 028_halftime_milestone_confirmation.sql. The sole body change is a five-line Q2 eligibility clause for period 2/state in/explicit trimmed case-insensitive Halftime detail. No inference from 0:00 alone. Existing distinct stable 45-second reads, changed-score reset, cumulative quarter totals, manual authority, OPEN handling, notification deduplication and grants are retained.
- Disposable PostgreSQL RED: two halftime failures/nine passed on full chain 027. GREEN: all 11 milestone integration tests passed on full chain 028. Coverage includes repeated-snapshot exclusion, 44-second early read, exact 45-second confirmation, cumulative Q1+Q2 scoring, and reset after changed halftime totals. Independent function diff review found no other body changes.
- Prepared locally only. This is a production database function change; awaiting explicit approval before applying the migration. No winner resolution or notification manually altered.
- Additional checks: nine focused unit tests and TypeScript passed.

- Anthony approved applying the prepared migration. Applied to production project illqymckwqiawdwxhwcy successfully; read-back verified explicit Halftime Q2 eligibility. Before application, the Bears board had already confirmed Q2 Anthony W at 31–24 after Q3 began (19:03:56 UTC). This live game therefore does not prove the new halftime transition; the 11 passing database tests provide that evidence. No score or winner manually changed.

## 2026-09-13 — Independent NFL score recovery prepared

- Reproduced production ESPN slate and exact-event HTTP403 failures in the preceding investigation; both dependent paths failed. During this implementation the Bears public API recovered to fresh ESPN data (59–37, 3:40 Q4, retrieved20:28:54UTC), demonstrating intermittent failure rather than a permanent game identity problem.
- Prepared a server-only API-Sports NFL adapter with exact home/away/kickoff identity, explicit halftime/final states, complete played-quarter validation, cumulative totals, bounded fetch timeout, transport-age rejection and sanitized errors. No new schema or manually changed score authority.
- Date-batched independent recovery runs only in the existing authenticated cron, caches successful and failed requests within each tick, and skips repeated denied ESPN summaries after a slate403 when the alternate key is configured. Viewer traffic cannot trigger paid requests. Completely failed ticks now return503 for scheduler visibility.
- Persistence rejects observations at least120seconds old or more than5seconds in the future before DB insertion; live expiration follows observation time. Stale automatic finals stay visibly degraded and keep polling instead of stopping as trusted final.
- RED reproduced two missing-recovery/outage-status failures, three observation-freshness failures, and stale-final hook/model failures. Focused recovery tests passed50/50 before the final age guard; guard plus scheduler/activation passed18/18. Milestone PostgreSQL suite passed11/11. Full Chromium passed116/116 including phone/desktop stale-final checks; screenshots visually inspected. TypeScript and design lint passed (zero errors/five existing warnings). Final unit/build results follow below.
- Read-only Cloudflare production secret-name listing confirms API_SPORTS_KEY is absent. No new account, purchase, key, configuration change, production fallback activation or deployment performed. API-Sports Pro is documented at$15/month with7,500requests/day and30second game updates. Provider account approval and a securely configured key are necessary to validate an actual live response and activate this prepared integration. The adapter's HTTP age guard cannot certify an undocumented underlying per-game update timestamp; no live latency guarantee is claimed from fixtures.
- Final validation:869 full unit tests passed; subsequent adapter-only boundary correction passed16/16 (adds one Age30 acceptance case). Production build and TypeScript passed. Independent review's aged-observation and viewer-quota findings were addressed and focused18-test regression run passed. Work is prepared locally, not committed/pushed/deployed; activation is pending paid-provider/account approval and secure key configuration.


## 2026-09-13 — Three-minute automatic scoring cadence

- Anthony requested one score pull every three minutes. Set production SCORE_POLL_SECONDS and server/browser defaults to180seconds. The existing minute scheduler heartbeat retains its atomic slot gate, so provider polling happens once per180seconds. Live freshness is240seconds to avoid routinely marking scores stale between expected polls. Viewer and current product/design copy now disclose three-minute updates.
- Isolated the cadence release from the locally prepared, unapproved paid-provider integration and other protected checkout work using an exact HEAD-based release tree and selective index blobs. No new provider, subscription, credential or database migration.
- Exact release tree:35 focused tests passed initially; full unit run837/838 passed with the one failure an old60second response expectation, corrected to180. Focused hook/cache/scheduler rerun verifies180second polling with no early request, server override support and hidden-tab pause. TypeScript, build and design lint passed (zero errors/five existing warnings). Full current-checkout Chromium verification covers matching disclosure on phone/desktop; release results recorded below.

- Final cadence verification: isolated hook/cache/scheduler22/22 passed after correcting the old response expectation and removing a fake-timer wait that advanced past the boundary. Full Chromium114 passed initially; two navigation-interrupted cases passed on unchanged serial rerun. No test assertion weakened. Cadence-only indexed diff inspected; paid-provider code and unrelated work excluded.

- Released cadence-only commit0c9c1ab to main; Cloudflare deployment6c436139-9375-43d8-868b-f21601a274c0 succeeded. Canonical public Bears score API verified nextPollSeconds180 with fresh score. Canonical frontend asset verified three-minute disclosure. Pending paid-provider work and unrelated checkout edits remain local.


## 2026-09-13 — View on board navigation

- Reproduced the reported no-op in phone and desktop browser tests: YourSquaresSummary only set highlight coordinates through ViewerShell; the grid never received a navigation request.
- View on board now sends a fresh explicit row/column request, maps shuffled axis digits to the actual square, focuses that cell and scrolls both the board viewport and page to reveal it. Repeated taps on the same square work. Passive name selection and score updates do not initiate navigation. Scrolling is immediate for reduced-motion compatibility.
- Browser RED: both390px and1440px target-focus assertions failed before implementation. GREEN: both passed in Chromium and WebKit, including repeated keyboard activation, fully visible bottom-right square and shuffled axes. Phone/desktop screenshots inspected. TypeScript, production build and design lint passed (zero errors/five existing warnings). Full unit837/838 initially; the existing View on board test needed a jsdom scrollIntoView stub, then all12 tests in that file passed in the exact release tree.
- Design hook's font-size findings are unchanged production typography outside this navigation-only diff; classified as pre-existing out-of-scope findings, with no ignore configuration added. Unapproved provider work and other checkout changes are excluded from this release.

- Full isolated Chromium run108 passed initially; all9 failed cases passed on unchanged serial rerun. Total117 cases verified. Failures were timing/navigation under concurrent build/unit/browser load; assertions and production code were not altered to clear them.
- Released6924ec7 to main; Cloudflare deploymentc272ba3c-fb3f-416b-b4b2-71259d79530f succeeded. Canonical getgridone.com frontend passed all4 phone/desktop Chromium/WebKit View on board checks: selected cell focused and fully visible, shuffled axes and repeated keyboard activation verified. Browser checks used isolated API fixtures with all unmatched API/Supabase traffic blocked; no production board data changed. Other checkout work remains local.

## 2026-09-16 — Replacement context notch, verified locally

- Anthony authorized replacing the existing organizer/viewer islands rather than adding another toolbar, including a web translation of Codenotch's effects and animation. Implemented by Gilfoyle; independently inspected and tested by Anton. No commit, push, deployment, dependency installation, backend/schema/scoring change, or production-data mutation.
- Added shared ContextNotch with circular module controls, concave top attachment, one measured attached detail card, explicit pin/close, keyboard/touch/hover access, stable dialog-return focus and safe viewer retirement. Public viewer modules are Game / Find squares or Your squares / Results; organizer setup uses Board / Payments / Share and published organizer uses Game / Results / Share. Existing confirmations, readiness checks, private payment boundaries and main board content remain authoritative.
- Motion uses sampled damped springs mapped from pinned upstream commit32512080d5ff506e6405b9a1a2f82264136ae06d: unfold, stagger, measured detail travel/resize, genuine assignment-ring reading changes, crossfade and prompt retraction. Reduced-motion preference changes cancel in-flight animations. MIT attribution retained; this is not native SwiftUI/macOS glass or hardware-notch integration.
- TDD caught missing module semantics, a real focus-return lifecycle issue, interrupted-geometry snapping, and OPEN precedence over stale participant names. Actual browser geometry/animation evidence verifies intermediate sizes, settle, source-cell connector alignment, reversal continuity at the same instant, 44px targets, safe narrow-screen resize and published organizer destinations. Refined phone/desktop screenshots visually reviewed.
- Anton's independent final gates: TypeScript, build, design lint and diff-check exit0; unit125 files/876 tests passed; complete Chromium suite129 passed with workers=1. Fresh read-only code review found no blocking security, logic or accessibility issue.
- Preserve qualification: parallel browser sampling is not claimed stable. Original reversal-frame assertions also failed on pre-notch source in2 of5 concurrent repeats; the homepage720.609375px boundary failure likewise reproduced twice on baseline. Both passed in the final full serial run. No assertion tolerance was weakened. Database integration was not run because Docker was unavailable; no physical-device/screen-reader certification claimed.
- Protected unrelated work was preserved:24 non-exempt hashed files unchanged; only seven authorized focus-retirement lines were added to the already-dirty viewer C1 test. Existing dirty docs were updated narrowly without discarding their prior changes.
- Evidence and exact commands: `.hermes/notch-implementation/anton-verification.md`, `implementation-report.md`, `refinement-report.md`, `anton-chromium-final.log`, `anton-unit-final.log`, baseline snapshots and `evidence-pass-refine1/`. Non-blocking lifecycle/test hardening suggestions are recorded in Anton's report, not claimed completed.

### Notch release result

Anthony approved commit, push and deployment of the notch-only slice. Release preparation excludes all unrelated working-tree edits, including score-provider recovery, pricing/copy changes and existing Playwright fixture config. Exact release tree is verified separately; deployment results are recorded after remote read-back.


## 2026-09-20 — Guest claim links implemented locally

- Anthony authorized execution after the written plan. Implemented in the isolated Codex `guest-pool-invites/gridone-app` worktree from `9e73acb`; preserved the original checkout's unrelated work. No commit, push, package installation, production migration/configuration, deployment, public distribution or financial transaction.
- Organizer-owned seller links offer explicitly reviewed available square IDs on shared, unfinalized boards. Added stable copy/share, settings, revocation/regeneration, exact source counts/holds, claim-code rotation and explicit claim release. Existing family editing links remain separate; guest controls do not appear before sharing.
- Guest route supports account-free 90-second holds, atomic confirmation/swaps/releases, browser persistence, four-word receipt recovery and post-claim generic external payment instructions. Private payment records are untouched. Mobile continuation focuses the name field on explicit activation; grid selection is keyboard accessible. Public viewers and clean organizer workspaces converge from canonical snapshots without overwriting dirty edits.
- Local migration029 uses service-only RPCs, private RLS tables, canonical row serialization, active-claim uniqueness, version/scope/revocation checks and relational cross-writer guards. No custom-GUC authority bypass. Organizer release revokes group management; self-release permits repicking. Rate limits and 500ms invalidation cadence bound anonymous work. Default server allowlist is off.
- Final verification: `npm run test:unit` —129 files/902 tests passed; `npm run test:integration` —12 files/90 passed/one existing skipped; `npx tsc --noEmit`, `npm run build`, `npm run design:lint` and `git diff --check` passed. Design lint retains five existing warnings, zero errors. `WRANGLER_SEND_METRICS=false npx wrangler pages functions build --outdir .work/guest-invites/functions-build` compiled successfully.
- Database pressure test uses100 distinct contenders for one square:1 hold accepted,99 expected conflicts, then exactly1 active claim after confirmation. Concurrent contention is resolved at the hold boundary. Existing family, pregame, publication and audited published-rename regressions pass.
- Browser evidence: `PLAYWRIGHT_PORT=5199 npx playwright test --project=chromium --workers=1` on frozen source passed133/135 and found two duplicate-label failures in existing family flows. After the shared-only mount/unique-label fix, `PLAYWRIGHT_PORT=5199 npx playwright test playwright-tests/new-board-flows.spec.ts playwright-tests/guest-invites.spec.ts --project=chromium --workers=1` passed11/11, including both failures. All135 cases verified across the full run and focused rerun. Earlier runs during source edits are retained as diagnosis, not substituted for final results.
- Guest browser coverage includes organizer issuance to a fresh guest claim and organizer convergence, same-device return, atomic swap intent, payment privacy, disabled-link handling, finalization, disconnected polling, phone overflow, keyboard and axe. Phone/desktop renders inspected. Prototype is dev-only, simulated and excluded from production output.
- Independent Sol reviews and orchestrator acceptance resolved the concrete authority, snapshot and workflow issues documented in `.work/guest-invites/`. Release still requires Anthony's approval and hosted Realtime permission/amplification tests,100-viewer p95 and LTE timing. See `docs/guest-invites-operations.md`; local passing tests are not live-release proof.
- Additional mobile engine verification: `PLAYWRIGHT_PORT=5199 npx playwright test playwright-tests/guest-invites.spec.ts --project=phone-webkit --workers=1` —7/7 passed. This is emulated iPhone/WebKit coverage, not a physical-device or LTE certification.

## 2026-09-20 — Guest invite production release preparation

- Anthony explicitly authorized “Commit push deploy. I will test with Monday night football game tomorrow.” Release is isolated from canonical checkout's unrelated edits and limited to the guest invite feature. Distribution and financial transactions remain outside this work.
- Fresh exact-tree verification: TypeScript passed; 129 unit files / 902 tests passed; production build and Cloudflare Functions compilation passed; design lint zero errors / five existing warnings; disposable PostgreSQL 12 files / 90 passed / one existing skipped. Full Chromium verified 134/135; the remaining test assumed an absent Realtime connection. The test now explicitly closes the socket, and the complete seven-case guest browser file passed under canonical public configuration. No application behavior was changed to satisfy the test.
- Independent final SQL/API review approved the migration and existing-writer compatibility. Applied migration029 as hosted migration `20260921035556_guest_invites` to GridOneApp. Read-back confirmed all five guest tables use RLS, anon/authenticated table access is denied, both RPCs deny anon/authenticated execution and permit service_role, and function search paths are pinned. No existing board content, guest invite or guest claim was created or altered during setup.
- Added production `GUEST_INVITE_SECRET` securely without reading or logging it. The exact-board allowlist remains off until the Monday-night board is identified; no broad enablement was inferred.
- Hosted diagnostic broadcast on a unique non-board topic reached two anonymous subscribers in61ms and67ms. This verifies hosted public subscription and server-send compatibility, not full claim-to-render latency,100-viewer p95 or physical LTE completion time. Those performance goals remain dogfood/broader-rollout checks.
- Push, Cloudflare source-revision confirmation and rendered live smoke follow this commit. Scratch evidence stays in `.work/guest-invites/`; rollback must retain guest data and database occupancy guards.

## 2026-09-21 — Family sharing handoff and scoped buyer collection

- Anthony approved local implementation after the live walkthrough: retain assignment/name entry, give participants a share action derived from their assigned squares, and show buyers only that participant's squares. Work remained in the isolated guest-invite worktree; unrelated original-checkout and scratch files were preserved.
- Organizer wording now says **Send families their squares**, displays the selected assignment, and explains direct text/email delivery of the private link. The family workspace adds **Share your squares**, explicit creation/copy/native sharing and a prepared public message. No automatic messaging, availability changes or financial transactions.
- Added migration030 and POST `/api/family/guest-link`: a private family capability resolves exact board scope server-side, respects the existing exact-board gate, and creates/reuses one stable public invitation under the canonical board lock. Disabled, expired, mismatched, revoked or reassigned authority cannot be bypassed. Owner settings remain unchanged; response projection omits private credentials and payment metadata.
- Link creation refreshes the complete saved family record while editing is disabled; it never advances a revision over stale names. Dirty drafts, refresh failures, stale reads, clipboard failures, native cancellation and mid-create disablement have focused coverage.
- Guest UI now renders only invite cells as a responsive native list with toggle semantics and roving keyboard focus. Scattered permanent numbers and one/ten/twenty-square scopes are preserved; unrelated names do not enter the rendered collection. Ordinary public boards remain full-board views.
- Fresh checks: `npx tsc --noEmit`, `npm run build`, Cloudflare Functions build and `git diff --check` passed. Unit suite:131 files/930 passed. Disposable PostgreSQL:13 files/97 passed/one existing skipped. Design lint:zero errors/five existing warnings.
- Full Chromium at port5207 passed134/136; two existing confirmation/animation checks failed while other implementation/test activity was completing. Both exact failed cases passed on unchanged frozen source (2/2). No test assertions or application behavior were changed to make those reruns pass. Browser evidence therefore consists of the full run plus the explicit focused rerun, not a claim of one all-green full run.
- Targeted phone-WebKit family/guest journeys passed10/10. Family phone390/desktop1440 and buyer phone renders were inspected; automated accessibility and overflow checks passed. Test fixtures are simulated, not live transaction or physical-LTE evidence.
- Independent API/SQL review and orchestrator acceptance completed. No commit, push, new production migration, or deployment performed for this follow-up. Migration030 and release remain a separate approved production action. Logs/screenshots are in `.work/guest-invites/`; the plan is `docs/superpowers/plans/2026-09-21-family-sharing-handoff.md`.

## 2026-09-21 — Approved family sharing release

- Anthony explicitly approved “Commit push and deploy” for the verified family-sharing follow-up. Original checkout work and scratch evidence remain excluded.
- Applied reviewed migration030 to GridOneApp as `family_guest_links` before application rollout. New RPC uses a pinned search path and service-only execution; existing data, availability, names and rollout scope remain unchanged.
- Release uses the verified source recorded above:930 unit tests,97 integration passes/one skip, build/typecheck/Functions/design gates, full Chromium134 plus the two unchanged focused passes, and10 phone-WebKit journeys. Exact deployment revision and rendered live workflow are checked after push.

## 2026-09-21 — Notch inline quick views

Approved scope: organizers and viewers read results directly in the existing notch. Shared Results presentation shows four milestones, canonical published/OPEN/corrected records, pending state, scores and labeled digits, with an explicit empty-history message. Organizer Share owns copy/open actions; correction navigation is labeled explicitly and requires an existing published result. Viewer Game includes score/period and Your squares includes original square numbers. No API, schema, scoring authority, payment or permission changes.

Verification: organizer regression reproduced the missing inline results before implementation. Initial focused organizer suite: 77 passed. Full unit suite: 934 passed before final legacy-result coverage; subsequent focused verification and browser evidence recorded in `.work/notch-quickviews/` and `.work/notch-*.log`. Build passed; design lint passed with five existing orphan-token warnings. Changes are local, not deployed.

Final review added legacy-record/pending-score isolation and all-four-milestone empty-state coverage. Final unit run: 131 files / 938 tests passed; final TypeScript/build passed. Manual phone inspection also exposed sticky board headers painting over notch controls; notch layering now sits above board headers and below modal sheets. Viewer phone and desktop screenshots inspected under `.work/notch-quickviews/`.

Browser verification completed: `PLAYWRIGHT_PORT=5192 npx playwright test playwright-tests/context-notch.spec.ts playwright-tests/context-notch-refine1.spec.ts playwright-tests/context-notch-quickviews.spec.ts --project=chromium --project=phone-webkit` — 30/30 passed. The mock server uses the fixture Supabase project URL and a non-secret test key; an initial missing-env sign-in redirect was resolved without production/auth changes. Four 390px/1280px organizer/viewer screenshots were reviewed. Keyboard activation, focus, overflow and topmost footer hit testing passed. No commit, push or deployment performed for this slice.

Release authorization received for commit, push to main and deployment. Full Chromium release gate: 140/140 passed (1.6m); prior targeted Chromium/phone WebKit 30/30, unit 938/938, TypeScript/build/design gates passed. Release uses the isolated worktree and preserves unrelated canonical-checkout changes.

## 2026-09-22 — Restrained marketing and board motion

Polish only. No pricing, copy, board-rule, or schema changes. Motion ideas from 21st.dev (Text Effect, Blur Fade, Interactive Hover Button, Number Flow, Spotlight Card) were reimplemented with the existing CSS tokens. No framer-motion dependency and no copied component source. Button Magnetic and Dot Pattern were not used.

- Hero entrance is a one-shot stagger (`data-enter`) that floors opacity at 0.45 and moves 8px, so the first paint and the primary actions stay available. It is not `data-reveal`.
- Primary links and primary capsule buttons lift, deepen their shadow, and nudge a decorative arrow. The accessible name is unchanged.
- Create preview crossfades the “Choose your game above” line into the selected matchup without moving the 10×10.
- Scores, filled/open counts, drawn axis digits, and last-digit labels roll only the characters that changed. A newly matching viewer square gets an inset ring. Cells do not scale. Demo pan/zoom uses smooth scrolling and a zoom transition when motion is allowed.
- Below-the-fold organizer, score, and pricing introductions use `Reveal`. FAQ questions use `keepVisible` so they never hit opacity 0.

### RED → GREEN

1. RED: `npm run test:unit -- tests/design/polishMotion.test.tsx` failed to resolve `CrossfadeText` (modules not written yet).
2. GREEN: same command, 8/8 passed after the primitives landed. A follow-up kept stable numerals as one text node so `getByText('14 – 7')` still matches; `tests/organizer/gameday.test.tsx` and the motion file passed 21/21.
3. `npx tsc --noEmit` passed. `npm run build` passed. `npm run design:lint` passed with the five existing orphan-token warnings and zero errors.
4. `npm run test:unit` passed: 132 files / 947 tests.
5. `npx playwright test --project=chromium playwright-tests/homepage.spec.ts playwright-tests/smoke.spec.ts playwright-tests/studio-landing.spec.ts` passed 27/27 after installing the Chromium browser. `npm run test:integration` was not run: Docker is unavailable in this environment.

## 2026-09-22 — Dark premium marketing stage

Visual chrome only, after the motion pass was rejected as too plain. Home, the `/create` preview frame, and the `/demo` board chrome share one near-black stage with lifted glass cards and a static white spotlight. Brand yellow stays on primary actions. No pricing, copy, board-rule, auth, payment, or schema changes. Viewer and article ground stay `#14161D`. The cream organizer workspace stays cream. Reference images were mood only and were not added to the repo.

- New `:root` tokens: `--g-stage`, `--g-glass`, `--g-glass-fill`, `--g-glass-edge`, `--g-glass-sheen`, `--g-stage-light`, `--g-shadow-float`, `--g-cta-glow`. Shared classes `.g-float`, `.g-pill`, `.g-chip`, `.g-cta`. Glass is a translucent fill plus a short top sheen. No `backdrop-filter`, so open squares stay sharp.
- Homepage organizer chapter leaves the cream island and sits on the same stage. Hero, score, and price cards use `.g-float`. Status, price, and matching accents on these surfaces are white. Gold remains on `.g-cta` and on dark-base `button.bg-action` (the demo “Find my squares” control).
- Create preview is a nested dark stage. The 10×10 keeps `grid-cols-10`, `aspect-square`, and opaque `bg-ground` cells.
- Demo chrome is opt-in (`stageChrome` only when `demoMode && !previewMode`). Current non-corrected cells and axis digits are white. The spotlight is a sibling, never a filter on the grid.

### Reduced motion and transparency

`prefers-reduced-motion: reduce` still collapses the one-shot hero entrance, digit roll, crossfade, match-emphasis pulse, and spotlight breathe. The stage light, glass fill, and action glow are paint, not animation, so they stay. `prefers-reduced-transparency: reduce` replaces `.g-float`, `.g-pill`, and `.g-chip` with the solid chyron. Forced colors strip the shadows.

### RED → GREEN

1. RED: `tests/design/marketingStage.test.tsx` did not exist. The characterization was added with the chrome, then `npm run test:unit -- tests/design/marketingStage.test.tsx` passed 5/5. An earlier `.ts` filename failed esbuild on JSX and was replaced by the `.tsx` file.
2. `npm run test:unit` passed: 133 files / 952 tests.
3. `npx tsc --noEmit` passed. `npm run build` passed. `npm run design:lint` passed with the five existing orphan-token warnings and zero errors.
4. `npx playwright test --project=chromium playwright-tests/homepage.spec.ts playwright-tests/smoke.spec.ts playwright-tests/studio-landing.spec.ts` passed 27/27. `npm run test:integration` was not run: Docker is unavailable in this environment.
5. Before screenshots are a local checkout of `origin/main` at `5fbb7b5`. The live site returned a Cloudflare challenge from this environment, so it was not used as the before.
- Anthony authorized commit, push and deploy. Released notch-only commit `9e73acb879e7e11675a84969d164ba7f2b3f36b9` to origin/main; remote SHA read-back matches. Cloudflare Pages production deployment `8ef458ea-bc22-4301-a156-054d3711d67e` completed successfully for that source. Canonical browser loaded `/assets/index-Cj-4wBIh.js` and rendered the new notch markup. Unrelated provider/copy/config changes remain local.
- Exact isolated release tree passed TypeScript,844 unit tests, build and design lint. Full Chromium127 passed/one known reversal-sampling failure; unchanged retry and pre-notch serial baseline each passed1/failed2. The previous876-unit/129-browser full working-tree counts include unrelated local changes and are not exact-release counts.
- Live UI acceptance is incomplete: three isolated canonical smoke attempts could not scroll the fixture's main score out of view (observed scrollY122), so the viewer notch stayed hidden. No actual production data was changed. Stopped after the third blocked attempt; manual real-board verification requested rather than claiming full live UI success. Complete release evidence and rollback handle: `.hermes/notch-release/release-report.md`.

## 2026-09-17 — Desktop first-viewport trust copy without web fonts

- Task `t_da4584f4`, isolated worktree, baseline `9e73acb`. Selected one reproduced trust/readiness defect: fallback font metrics pushed the free-board/no-account assurances and full money boundary below a 720px desktop viewport. No pricing, wording, font size, target size, score, publication, payment, schema, or API changes.
- RED: baseline `npm run test:unit` passed 844 tests; full Chromium with two workers passed 127/128, failing the desktop first-viewport contract. Repeating that contract failed 2/3. Added `playwright-tests/homepage-viewport.spec.ts`, blocking non-local requests and measuring all hero identity/action/assurance/boundary boxes. All three new tests failed at 1024/1280/1440px. Money-boundary bottom edges were 790.9375/807.1875/762.328125px, respectively.
- GREEN: seven CSS lines in `src/features/homepage/sections/hero-studio.css` remove decorative top spacing only on desktops at least 1024px wide and at most 800px tall. Phone and tall-desktop rules remain unchanged. No assertions weakened, font-arrival wait added to conceal fallback, or content hidden. The new regression passed 6/6 across Chromium/WebKit; boundary bottoms are 706.9375/699.1875/654.328125px in both engines.
- Browser command prefix for every run: `PLAYWRIGHT_PORT=5197 VITE_SUPABASE_URL=https://illqymckwqiawdwxhwcy.supabase.co VITE_SUPABASE_ANON_KEY=playwright-test-anon-key`. These are the previously reviewed non-secret fixture values, supplied via environment rather than duplicating the protected canonical config change.
- Verification: `npx tsc --noEmit` exit 0; `npm run test:unit` 122 files / 844 tests passed; `npm run build` exit 0; `npm run design:lint` zero errors / five existing warnings. `npx playwright test --project=chromium --workers=1 --reporter=json` passed 131/131. `npx playwright test playwright-tests/homepage.spec.ts playwright-tests/homepage-viewport.spec.ts playwright-tests/studio-landing.spec.ts --project=webkit --project=phone-chromium --project=phone-webkit --workers=2 --reporter=json` passed 75/75, including phone reflow, 200% text, blocked fonts, reduced motion and keyboard FAQ. Full Chromium includes the ten-route axe sweep and keyboard/target contracts. Earlier post-fix two-worker Chromium run was 130/131: the known unrelated organizer reversal-frame sampling assertion failed; unchanged serial run passed. No claim of parallel-suite stability.
- Evidence: `.hermes/qa-t_da4584f4/{red,green,chromium,chromium-serial,cross-browser}.json`, including screenshot and geometry attachments in focused reports. Rendered browser geometry/overflow inspected programmatically; no human visual or VoiceOver/NVDA certification claimed. PostgreSQL and Stripe smoke are not applicable to this CSS-only production change. No release surface, deployment configuration, or persisted state changed.
- Risk: low, homepage layout only. Rollback removes the seven-line media-query block; no data rollback. Recommend independent Anton review/reconciliation, not deployment from this worker. No commit/push/deploy, production access, or customer-metric change occurred. Preserve the canonical dirty tree. Hotspot: this log already has protected canonical edits; append this entry only, never replace the file.

### Anton independent review and canonical reconciliation

- Review `t_aa458df2`: approved the bounded local homepage slice, not a whole-app release. Exact CSS and regression spec match Gilfoyle's isolated files. All 29 other protected files remain SHA-256-identical; the complete pre-review log byte prefix is preserved. Worker evidence above is relative to `.worktrees/t_da4584f4/`, not this canonical root.
- Independently reran isolated Chromium/WebKit regression: 6/6 passed. Canonical `npx tsc --noEmit`, `npm run test:unit` (125 files / 876 tests), `npm run build`, `npm run design:lint` (0 errors / 5 warnings), and `git diff --check` passed. `PLAYWRIGHT_PORT=5198 npx playwright test --project=chromium --workers=1 --reporter=json` passed 131/132; the known organizer reversal-frame assertion at `organizer-payments.spec.ts:260` failed even serially. Do not describe that problem as parallel-only or claim the canonical release gate is green. Scoped homepage/studio WebKit and phone projects passed 75/75; no test weakened or retry substituted for the failed full-run result.
- Independent offline rendered comparison used exact pre-fix CSS in disposable browser pages: six short-desktop cases reproduced the overflow before and passed after across Chromium/WebKit; six phone/tall-desktop controls retained identical measured geometry. At 1280×720 the boundary bottom moved from 807.1875px to 699.1875px without changing heading/disclaimer font or action dimensions. Desktop Chromium and phone WebKit screenshot review found no visible action/disclaimer clipping or overlap; secondary desktop demo content intentionally continues below the fold. This is not human or assistive-technology certification.
- Exact commands, JSON, screenshots, protected-file snapshot and review result are in `.hermes/review-t_aa458df2/`. `git apply --reverse --check --include=src/features/homepage/sections/hero-studio.css --include=playwright-tests/homepage-viewport.spec.ts .worktrees/t_da4584f4/.hermes/qa-t_da4584f4/CHANGE.patch` passed. Database/Stripe checks are not applicable to this CSS-only slice. No commit, push, deploy, payment/provider action or production metric change; existing organizer-motion, manual-AT and live-release gates remain unwaived.
Anthony approved commit, push and deployment of the notch-only slice. Release preparation excludes all unrelated working-tree edits, including score-provider recovery, pricing/copy changes and existing Playwright fixture config. Exact release tree is verified separately; deployment results are recorded after remote read-back.

## 2026-09-23 — UX friction pass (branch `claude/ux-friction-pass`, uncommitted)

- **Scope:** Anthony-approved, no schema, pricing, permission or deploy changes. Brief: `tasks/ux-friction-brief-2026-09-23.md` in the main checkout.
- **S1 sample board:** `/demo` now renders the homepage's Lincoln Softball board (`demoData.ts`) and not `SAMPLE_BOARD` "Demo Player" data with a 2025 game.
- **S2 returning buyer:** `YourSquaresSummary`/`ViewerIsland` headlines now say "You’re winning right now." or "Not winning right now. Next winning score: …". `phone-viewer-hierarchy.md` updated.
- **S3 money line:** hero uses the new `MONEY_LINE`; the exact `MONEY_BOUNDARY` stays in the FAQ, footer, no-JS fallback and all pinned in-app surfaces.
- **S4 copy:** plain-language rewrites across homepage, sales viewer, game-day viewer, family view, family access, draw, share and final record.
- **RED:** updated tests failed first: 13 unit failures for copy, then 4 for the personal headline.
- **GREEN:** `npx tsc --noEmit` pass; `npm run test:unit` 122 files, 846 tests pass; `npm run build` pass; `npm run design:lint` pass.
- **Browser:** chromium run in a cloud copy without `.env.local` gave 78 passed and 50 failed. The same run on untouched `9e73acb` gave 49 failures, all in that set of 50. The one extra failure (demo identity text) was fixed, and viewer, smoke, homepage and demo specs rerun at 26 passed. The shared failures are organizer and auth flows that need local env. Rerun the full suite on the Mac with `.env.local` before merging.
- **Landed on main (2026-09-23):** applied onto the committed scoring-recovery work. Kept the approved photo-import Beta and review sentences exactly. Tightened the upgrade line to "Your free board is used. $9.99 covers up to 5 boards this season, counting your first. It doesn’t reset after a game." With the pinned Playwright env, chromium ran 126 passed / 6 failed. After updating 5 copy expectations, those reran green (8/8). The remaining failure, "representative public controls have visible focus", also fails on the prior commit and is pre-existing.

## 2026-09-23 — Landing the UX pass on current origin/main

- The local checkout was 7 commits behind origin/main, which already shipped scoped guest claim links and family buyer links (migrations 029/030). The Sep 17 working-tree changes and the UX copy pass were rebased onto `8190985`. Conflicts were resolved by keeping origin's new layout and motion and reapplying the plain-language copy: hero money line, organizer, score, pricing, family access, sales availability, viewer island.
- A parallel "seller links" implementation (its own migration 029) duplicated the shipped guest links. It was not landed, and it stays on branch `claude/seller-links-simple` for reference. The hero focus-ring fix was dropped because origin's redesign removed the offending rule.
- Gates on the rebased tree: `npx tsc --noEmit` pass; `npm run test:unit` 136 files / 986 tests; `npm run test:integration` 13 files / 97 passed / 1 skipped; build and design lint pass; chromium 142 passed / 2 failed. Both failures reproduce on untouched origin/main `8190985`: an axe color-contrast finding on the hero CTA (sampled mid-entrance: #0e0f12 on #0e0c04) and the viewer C1 first-viewport ordering check. They are pre-existing and were left for a focused follow-up.
## 2026-09-23 — Seller links and simple buyer claiming (replaces guest-link entry points)

- **Approval:** Anthony approved seller links and the simpler buyer-claiming design from `tasks/ux-friction-brief-2026-09-23.md` (S6). No holds, claim codes, or payment integrations.
- **Schema:** `031_seller_links.sql` (first written as 029, renumbered after origin's 029/030) adds the service-only `seller_links` table and the `gridone_seller_link(sync|rotate|read|claim)` RPC. Scope is the board's current allocation label, and a square is claimable while it still shows the seller's name. Claims lock the contest row, write names atomically (up to 10 per claim), and audit `seller_claim`. S7 ("unsold squares keep the seller's name") needed no change: assigned squares already carry the seller's name.
- **API/UI:** `POST /api/pools/:id/seller-links` (owner), `GET|POST /api/sellers/:code` (public), `/s/:code` buyer page, and the organizer `Send seller links` card. The buyer page stores the claimed name under the viewer's existing `gridone:find-squares:{CODE}` key, so game day opens on their squares.
- **RED → GREEN:** each layer was written test-first and failed first (missing modules). SQL: `tests/sellerLinks.integration.test.ts` 8/8 on disposable Postgres after fixing a bigint jsonb index cast and using the real publish path. Endpoints: 5/5. Buyer page and model: 10/10. Organizer card and model: 7/7. Browser: `playwright-tests/seller-links.spec.ts` 4/4 at 390 and 1440 with axe and overflow checks; screenshots were inspected.
- **Release still required:** review and apply migration 029 before deploying the matching frontend and API. Rollback: redeploy the prior revision. The table can stay; dropping it only disables links.
- **Final gates (seller links on main):** `npx tsc --noEmit` pass; `npm run test:unit` 128 files / 900 tests; `npm run test:integration` 12 files / 88 passed / 1 skipped (migration-sequence guard bumped to 029); `npm run build` and `npm run design:lint` pass; chromium 135/136, with the one failure the pre-existing hero focus-ring bug. That was fixed in a separate commit (the quiet hero link's `box-shadow: none` also hid its focus ring), and the accessibility, homepage and studio specs then passed 52/52.
- **Simplification (Anthony: "simplify everything"):** seller links replace the organizer "Guest claim links (optional)" card and the family "Share your squares" public buyer link. Both UIs and their component tests were removed. Guest backend tables, endpoints, `/p/` guest pages and occupancy guards stay so posted links and existing claims keep working. Seller claims are compatible with those guards because a guest-claimed square no longer shows the seller's name.

## 2026-09-23 — New numbers each quarter (organizer option)

- **Approval:** Anthony asked for his team's paper-board format (different numbers for 1st, 2nd, 3rd and Final) as an organizer option, and asked to finish the Sept 11 `feat/quarter-specific-numbers` / `fix/quarter-poc-browser-gates` work and ship it.
- **Port:** the Sept 11 changes were brought onto current main (`c60c33e`). The migration was renumbered 028 → `032_quarter_specific_numbers.sql`. Its asserted function patches still apply cleanly after 028–031. A new delta lets seller links (031) work on per-quarter boards (test-first: `seller_board_locked` RED, then GREEN). Changes that had already landed another way were dropped: homepage and payments spec hardening, hero CSS, upgrade copy, the `revealFocus` scroll mechanism (replaced by main's `viewSquareRequest`) and the machine-specific `repair01-evidence.py` plus its archive-dependent test.
- **Simplified for organizers:** plain labels (`One set for the whole game` / `New numbers each quarter`; tabs `1st`, `2nd`, `3rd`, `Final`, matching paper boards). The extra "Draw all four sets" button was removed; the normal `Prepare to publish` draw produces all four sets. Digit-by-digit inputs show only for photo-imported boards. Viewers can open any quarter's numbers.
- **Kept from the branch:** DB validation and locking of every set, milestone scoring per quarter (`gridone_axis_for_milestone` patched into milestone observation and corrections), public projection allowlist, publish checks (ten unique digits per set), photo-import team orientation review, board image footer per quarter, and per-quarter viewer/scenario/your-squares math.

## 2026-09-23 — Organizer live refresh for seller-link claims, and two browser-suite fixes

- **Status:** Complete and verified.
- **Approval:** Anthony asked for both ("Do 2 and 3").
- **Live refresh:** a shared, unpublished board in the organizer workspace now re-reads the board every 20 seconds, and on window focus or tab return, so names claimed through seller links appear without a manual reload. It never refreshes while the organizer has unsaved edits, a save in flight, an open sheet or dialog, a selected square, or a hidden tab, and never stacks refreshes. New hook `src/features/organizer/workspace/useSharedBoardRefresh.ts`.
  - RED → GREEN: `tests/organizer/organizerWorkspace.test.tsx` "pulls in names from seller links on a shared board without a manual reload" failed first (onReload never called), then passed. Hook unit tests in `tests/organizer/sharedBoardRefresh.test.tsx` (4).
- **Homepage axe color-contrast (gold CTA):** false positive. The hero grain overlay carried `mix-blend-mode: overlay` and a CSS opacity; axe folded that layer into the button and read gold as near-black (1.02:1). Proven by hiding only the blend in a probe. Fix: the texture faintness is baked into the SVG, and the blend moved to a `.g-grain::before` in `src/design/tokens.css`. Visual result is unchanged.
- **Viewer C1 order check:** the test matched the button's raw `textContent`, which now includes the decorative aria-hidden arrow. The check now reads the spoken text, skipping aria-hidden children. No product change.
- **Gates:** tsc, unit (1012), integration (116 + 1 skipped), build, design lint, and Playwright chromium 151/151 all pass.

## 2026-09-24 — Whole-codebase review and refactor

- **Status:** Complete and verified. Anthony asked for a full review and refactor where it has a specific purpose, without breaking anything.
- **Method:** four read-only reviews (dead code and duplication, server layer, frontend architecture, load performance), each finding verified before acting. Behavior fixes were test-first (RED then GREEN); pure refactors rely on the existing suite plus new characterization tests.
- **Bugs fixed:**
  - The 20-second shared-board refresh reloaded private notes through the blocking path, making the editor inert every tick. Background reloads now stay quiet (`useContestEntries` `background`).
  - Reload latest board after a conflict marked the stale local draft clean at the new revision; the next edit could overwrite the newer board. It now adopts the server copy (`useWorkspaceDraft`).
  - A board load answering after a newer acknowledged save rolled the organizer back; it is now dropped. Open-square assignment joined the single write queue (`usePoolData`).
  - Live scoring could overlap reads, let an older or other-board answer overwrite a newer score, and refetched on a cadence change (`useLiveScoring`).
  - The viewer grid reset keyboard position on every score poll (`ViewerBoardGrid`).
  - A failed published rename or late fill still saved private notes.
  - The viewer grid marked Q2 only after the third quarter began; the database confirms it at explicit halftime (migration 028). `calculateWinnerHighlights` now matches.
  - A just-published correction could be replaced by an in-flight older poll (`mergeWinnerHistory`).
  - Server: auth outages returned 401 "session expired" (now 503); malformed JSON and bad ids returned raw 500s; raw Postgres text leaked; `OPTIONS /api/pools` threw; allowance copy was wrong for Organization plans; Resend and Gemini calls had no timeout and the Gemini key sat in the URL; the season was set in two ways that could disagree; `signUnsubscribe` had two copies.
- **Speed:** every route is its own chunk. The first script drops from about 106 KB to about 6 KB gzip; the homepage loads about 92 KB less and a viewer link about 67 KB less. The current route's chunk starts at boot in parallel with the sign-in check. `/assets/*` is cached immutably. The cron score refresh runs four boards at a time; the NFL schedule is edge-cached; share-code reads skip the auth call; the owner read saves a round trip. The organizer's 100-square editor no longer redraws on unrelated renders.
- **One source of truth:** `functions/_lib/http.ts` and `crypto.ts` replace about 36 inline client constructions and 19 local handler types; `utils/scheduledGame.ts` holds the away=side / home=top rule for browser and server; `scenarioModel.currentSquareIndex` is the current-square rule and the tests now exercise it; a test checks every quoted GridOne price against `PAID_TIERS`.
- **Structure:** OrganizerWorkspace rules moved to `workspaceBoardModel.ts`, `lifecycle/workspaceGates.ts`, `useGameDayScoring.ts` and `usePayoutDraft.ts` (1,340 → 1,144 lines, 13 new unit tests).
- **Removed dead code:** `constants.ts`, unused types, `organizerIsland.css`, the `qrcode.react` type shim and its three `@ts-ignore`s, the never-true preview mode and never-run local draft persistence in `BoardView`, the unused `calculateCurrentWinner` and server `milestoneScores`, and the dead CORS/OPTIONS code.
- **Left for a decision (not changed):** `viewerIdentityModel` (tested, not wired; wiring changes saved-selection storage); `instrumentation/` (tested, emits nothing); `scrollcraft/` (design-build record, not shipped); email unsubscribe/verify act on GET (mail scanners can trigger them); publish does not require the revision the organizer saw; the AuthProvider still waits for Supabase before any route renders (removing that would briefly show the signed-out header); fonts load from Google (self-hosting would save a connection).
- **Gates:** `npx tsc --noEmit` pass; unit 1073 pass; integration 116 pass, 1 skipped (pre-existing); `npm run build` pass; `npm run design:lint` 0 errors, 5 pre-existing warnings; Playwright chromium 151/151.
