# Viewer clarity patch

Scope: local-only public viewer improvements. Preserve score authority, board data, privacy, quarter axes, and existing theme. No live interactions or remote publication.

1. Put the existing Find squares control immediately after board identity inside the score region; show selected count and square numbers there. Keep modal behavior intact.
2. Call current-score matches matches, not winners. Keep pending confirmation adjacent to published/confirmed results; never derive confirmation from a live score. Surface current pending milestone beside score context.
3. Suppress the floating score while it would overlap the board grid region.
4. Verify targeted unit behavior, phone/desktop geometry and keyboard flow with mocked local fixtures, then typecheck, unit suite, build. Record limitations.

## Evidence
- Initial RED: three intended new assertions failed (score identity nesting, halftime winner language, pending grouping).
- Focused viewer suite: 54 tests passed across six files.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; existing >500kB bundle-size advisory remains.
- `npm run design:lint`: zero errors, five warnings.
- Local Chromium checks use mocked public-board endpoints, no live board writes. Existing `/tmp/chromium` works; standard browser installation is absent and system Chromium cannot create sandbox sockets.
- Screenshots: `/tmp/gridone-viewer-polish-393.png`, `-1280.png`, `-grid.png`; inspected. Find appears around y130 and grid axes are not covered by floating score.
- Observation outside this patch: default phone board rendering in the fixture horizontally clips later columns inside the board viewport; this patch does not change grid fit/zoom geometry. No assertion of full phone grid acceptance.
- No remote writes, deployments, or live fixture interactions.
- Full unit suite: 178 files / 1,368 tests passed with `npm run test:unit -- --maxWorkers=2` (233 seconds). Latest personal-summary sync-state follow-up also passed 32 targeted tests.
- Final browser pass: 3/3 passed, including selected halftime pending state; screenshot `/tmp/gridone-viewer-polish-halftime.png` inspected.
- Earlier unbounded full run was interrupted after stale copy assertions and a grid keyboard timing failure; bounded full rerun passed all tests. No hidden failures omitted.
