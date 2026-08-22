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
