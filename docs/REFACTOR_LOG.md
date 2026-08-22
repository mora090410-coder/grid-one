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
