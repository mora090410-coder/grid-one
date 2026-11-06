# Reference-led interactions — bounded local pass

Implemented November 5, 2026 in `rebuild/organizer-first-2026-11-05`.
This report describes this worker's changes on top of the existing dirty rebuild;
it does not attribute the parent's changes to this pass. No commit or deployment.

## Reference relationship

The supplied references are curated inspiration, not GridOne screenshots or proof
of efficacy. The ledger in `../DESIGN-REFERENCES.md` governs attribution and limits.

- Dribbble PULSE: retain a dominant sports object and editorial rhythm. The real
  100-cell sheet carries the interaction; no borrowed photography, layout or copy.
- Sixes: retain sports personality and a plainly available next action. Existing
  warm stock, ink, cardinal and organizer-first hero stay intact; no marquee or
  media entrance delays the CTA.
- FieldRank: put numerical context close to the inspected value. Selected row,
  column and seeded score digits are adjacent to the supporter name. Illustrative
  matching remains separate from confirmed results.
- Mobbin's public progress directory: use explicit stages and acknowledgement.
  The rail is exploration, never fictitious setup completion or a loading state.

No further imagery, reference browsing, paid services or account calls were used.

## Implemented decisions

1. One continuous registration rail replaces changing solid stage blocks. Its
   cardinal rule slides beneath stationary ink/cardinal labels in 200ms using the
   existing state timing. Text and focus contrast do not depend on its arrival.
2. Stage explanations occupy overlapping grid tracks. Inactive panels use
   `visibility: hidden` and `aria-hidden`; their geometry reserves the longest
   explanation at the current width. Active essential copy never fades.
3. Selection immediately marks both axis headers and its row/column track.
   The selected square and illustrative NOW square retain their distinct fills,
   selection semantics and focus indicators. Press feedback is a one-pixel move.
   No hover changes selection or claims anything.
4. Entering Game day applies one 280ms translate/scale ink settle to the actual
   seeded digits. Values appear immediately; there is no shuffle, invented wait,
   score animation or supporter movement. Leaving the stage removes the animation;
   repeated activation of the same stage does not remount/restart it.
5. The persistent inspector reserves name and matching-status space and shows
   row/column before the score digits. Its small 180ms registration stroke
   acknowledges a selection/stage change without animating essential text.
   Grid focus already reads full cell names, so it disables duplicate live speech;
   the separate previous/next controls request polite inspector acknowledgement.
6. Every homepage Reveal now deliberately uses `keepVisible`, including organizer,
   score and both pricing wrappers. The existing FAQ already did. This prevents
   pending opacity and intermediate fade contrast loss without changing shared
   Reveal defaults or suppressing axe checks.

All optional new movement exists only under `prefers-reduced-motion:
no-preference`. No loops. The stage focus remains currentColor/inset -4px;
gridcell focus remains currentColor/inset -3px. Forced colors retain selection
outlines and add header borders/system-color registration marks. The 100 real
gridcells, single roving tab stop, arrow/Home/End boundaries and 44px previous/next
controls remain. Existing disclosures, pricing, data, hero actions and permissions
are unchanged.

## Files changed by this pass

- `src/features/homepage/sections/SampleBoard.tsx`
- `src/features/homepage/sections/hero-studio.css`
- `src/features/homepage/sections/OrganizerSection.tsx` — Reveal prop only
- `src/features/homepage/sections/ScoreSection.tsx` — Reveal prop only
- `src/features/homepage/sections/PriceAndClose.tsx` — Reveal props only
- `tests/homepage/homepage.test.tsx`
- `playwright-tests/homepage.spec.ts`
- `playwright-tests/rebuild-evidence.spec.ts`
- `docs/reference-led-interactions.md`

`Hero.tsx` and `studio.css` were inspected but not edited by this pass. Other
pre-existing changes and untracked files were preserved.

## Verification

Behavioral RED, before implementation:

```sh
npm run test:unit -- --configLoader runner tests/homepage/homepage.test.tsx
```

17 tests: 15 passed, 2 failed. The new navigation test failed because row/column
context was absent. The controlled IntersectionObserver regression failed because
four text-bearing Reveals used `pending` instead of `shift`. It also checks the
immediate post-entry `in` state. After implementation the focused 17 tests passed.
There was no invented RED for decorative CSS.

Final local gates:

```sh
npx tsc --noEmit
npm run test:unit -- --configLoader runner
VITE_SUPABASE_URL=https://gridone-test.supabase.invalid VITE_SUPABASE_ANON_KEY=playwright-test-anon-key npm run build -- --configLoader runner
npm run design:lint
```

TypeScript and build passed. Unit suite: **163 files / 1,289 tests passed**.
Design lint: **0 errors / 5 unused-token warnings** in the existing design spec.
Unit/build logs: `/tmp/gridone-reference-unit.log` and
`/tmp/gridone-reference-build.log`. Dummy local-only Supabase values were used;
real environment credentials were not inspected or copied.

The optional Impeccable detector was run once:

```sh
node /Users/amm13/.agents/skills/impeccable/scripts/detect.mjs --json src/features/homepage/sections/SampleBoard.tsx src/features/homepage/sections/hero-studio.css src/features/homepage/sections/OrganizerSection.tsx src/features/homepage/sections/ScoreSection.tsx src/features/homepage/sections/PriceAndClose.tsx
```

Exit 2, with 13 advisory type-ramp findings on inherited font sizes/fluid
endpoints. This pass introduces no new font-size values. No protected design spec
or unrelated type system was changed to silence them.

Static token arithmetic for the new pairings: cardinal on axis stock **4.66:1**;
ink on axis stock **11.92:1**; raised paper on ink **16.82:1**; cardinal on paper
**5.89:1**. These calculations do not replace rendered contrast checks.

## Browser blocker and remaining acceptance

Attempted before implementation:

```sh
PLAYWRIGHT_PORT=5188 npx playwright test playwright-tests/rebuild-evidence.spec.ts --project=chromium --grep 'marketing text stays opaque'
```

The web server exited before tests ran:
`Error: listen EPERM: operation not permitted 127.0.0.1:5188`.
That networking path was stopped as instructed; no fallback port or repeated
server attempt was made. Browser regressions are authored, not claimed passing.

New browser coverage samples opacity and pending Reveal states on every animation
frame through 450ms of each scroll entry at 320/1440px, without settling first.
Additional tests check stage/inspector geometry, seeded axes, interruption,
same-stage activation and reduced motion. The existing axe evidence sweep and
focus tests remain intact. For the parent in an environment permitting localhost:

```sh
PLAYWRIGHT_PORT=5188 GRIDONE_EVIDENCE_DIR=/tmp/gridone-reference-led-evidence npx playwright test playwright-tests/homepage.spec.ts playwright-tests/rebuild-evidence.spec.ts --project=chromium
```

The DEV harness supports these tests. To use preview instead, first run the dummy
build above and add `PLAYWRIGHT_BUILT_UI=1`; this does not authorize running the
legacy DEV-only full suite against preview. The separate evidence destination
keeps old screenshots intact.

Rendered desktop/phone inspection, motion/forced-color browser acceptance and
axe during the evidence sweep remain for the parent because localhost could not
start. Screen-reader announcement behavior still needs manual evaluation. No
full Chromium, WebKit, production-live, conversion-lift or deployment claim is
made. This completes the bounded local code/test/report pass, with browser
acceptance explicitly pending.
