# GridOne integrated rebuild — local completion

Status: implementation complete and locally accepted; **unreleased**. This is not production, payment/email-delivery, physical OS-share, or market-readiness certification.

## Implemented

- Adopted Anthony's palette A: matte midnight `#101B2A`, muted gold `#B7A477`, warm foreground and opaque raised navy surfaces through the existing semantic token system. Preserved Corner Square logo geometry with readable white variants.
- Integrated the organizer-first homepage/sample experience, create entrance and coordinated operational surfaces. Samples identify themselves as illustrations, not customers, transactions or live game evidence.
- Added purposeful board selection, allocation/handoff and sample-journey interactions. Reduced motion, keyboard access, forced-colors and print behavior remain supported.
- Fixed Search/Family controls at a consistent 48px height with an accessible native select and decorative chevron. Matching-square details are keyboard-scrollable.
- Positioned seller handoffs beside the board on desktop and after it in reading order. Drafts include current assigned square numbers and issued buyer claim links, with explicit preview/copy-only wording. Nothing was emailed.
- Preserved the released seller-claim repair unchanged relative to local main. Did not change prices, permissions, locks, number modes, score authority, OPEN outcomes or private/public boundaries.

## Final verification

Acceptance used a private install of the repository's existing lockfile, not the incompatible dependency folder shared with the main checkout. No manifest/lockfile upgrades. Application, test and configuration hashes matched between the rebuilt checkout and tested copy: 485 files, checked again after execution.

- TypeScript: passed.
- Unit tests: **165 files / 1,302 passed**.
- Disposable local Postgres integration: **20 files / 158 passed / 1 skipped**. The existing optional hosted Stripe Sandbox checkout/refund proof was intentionally not run; its credentials were excluded.
- Production build: passed with deliberately non-production, invalid Supabase client configuration.
- Design lint: **0 errors / 5 existing orphan-token warnings**.
- Full Chromium suite: **184 passed / 0 failed / 0 skipped / 0 flaky**, serial, frozen source.
- Built-app WebKit acceptance: **19 passed / 0 failed / 0 skipped / 0 flaky**.
- Built-app Chromium acceptance: **5 passed / 0 failed**.
- Original range-selection regression repeated three times in each browser: **6 passed** without force-clicks, retries or weaker viewport assertions.
- Git whitespace check: passed.
- Runtime dependency audit: **0 vulnerabilities**.

The full development audit is **not clean**: it reports two existing high-severity package findings, `@google/design.md` and its `zod` dependency, associated with GHSA-mrhx-c7xc-m3w5. Both are marked development-only in the unchanged lockfile; npm reports no automatic fix. These findings were retained explicitly, not silently fixed or waived for deployment. The release owner must disposition them before production release.

## Failures investigated, not discarded

Earlier browser runs remain in the evidence directory and must not be confused with final results. Old palette expectations and early route/style-readiness assertions were corrected without removing the underlying checks. Previously intermittent image-export and companion-navigation cases passed unchanged in the final frozen serial run; that does not establish physical OS-share delivery or prove all concurrency-related flakiness absent.

One genuine regression survived the earlier full serial run: selecting a square could move the viewport as companion controls appeared. Instrumentation recorded native scroll movement with changing side-panel height and no application scroll calls. Excluding both editing columns from document scroll anchoring eliminated the movement; excluding only the side panel was insufficient. The original no-scroll/focus/range/apply/Escape test remains intact.

## Rendered evidence

Evidence root: `../evidence/integrated-rebuild-A/` relative to this app checkout.

- `locked-final-matrix.json`: commands, actual exit codes, browser counts and the explicit development-audit exception.
- `locked-source-manifest.json`: application/test/configuration hashes.
- `final-rendered/gridone-rebuild-final.mp4`: actual built UI, not an image-generation concept or separate prototype.
- `final-rendered/`: desktop/phone home, organizer, seller handoff and phone sales screenshots.
- `final-rendered/recording-verification.json`: sample cells 11/12 saved in an isolated stateful fixture and included in the draft; zero real messages sent. Final recording observed no uncaught page errors, console errors or failed requests. An initial recording fixture omitted the fake contests-list read; that fixture was corrected, not production code.

Rendered desktop/phone review found no visible broken layout, overlapping controls or clipped filter text. Fine grid labels remain visually subdued; this is not a claim that every possible device or assistive technology was manually tested.

## Working artifacts and boundaries

- Rebuild: `/Users/amm13/00-Projects/parkside/gridone-rebuild-2026-11-05/app`.
- Exact-lockfile verification copy: sibling `verify-locked-2026-11-06`.
- The rebuild's dependency link now points to that private installation; the shared main dependency directory was not modified. Keep the verification directory while the link references it. The change is recorded in `dependency-link-change.json`.
- The rebuild's local `dist` contains the latest test-configured build. It is not a production-configured deployment artifact.
- `AGENTS.md` remains unchanged. Its historical design-baseline language did not override Anthony's approved palette.
- No source files were staged, committed, pushed or deployed. No production data/configuration, secrets, real payments or real outreach were changed.
- Tests generated changes to tracked screenshot evidence. Those files are not automatically approved release content; future staging must be selective.
- The previously rejected Resend attempt remains separate from this work. No fresh email-delivery proof was obtained or claimed.

Next authorization boundary: review the local rebuild and outstanding development-tool findings, then explicitly authorize any commit/push/deployment and live smoke-test scope. Do not infer that authorization from this completion report.
