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
