# Final motion contract

Source: [Claude's superseding seven-effect spec, PAR-32](https://linear.app/parksideag/issue/PAR-32#comment-eb79715c-d204-4014-b435-4ca6466bbe43). Anthony authorized implementation, commit, push and production deployment in this session. This supersedes the earlier five-effect implementation, not the product, score-authority, confirmation or accessibility boundaries.

## Seven earned effects

1. **Pointer sheen:** one rAF-throttled, scale-corrected warm radial on score/winner cards, the buyer sheet and Island dialogs. 220px / 16% alpha, 500ms fade. Never board cells.
2. **Liquid fill:** curved gold fill on buyer picks and organizer selection, 700ms; labels 300ms with 250ms delay. Pick/unpick remains reversible and never claims a square by itself.
3. **Number roll:** organizer/public axes and buyer coordinates, 1200ms with 90ms stagger. Only finalized/public or deliberately confirmed organizer numbers reach these views. The existing draw confirmation and quarter-specific axes remain authoritative. Strips are decorative; assistive technology receives final values only.
4. **One winner light:** an on-screen current-winning card owns the single breathing glow; otherwise the live cell owns it. Hidden phone cards do not own the light. Sweep nodes are keyed to winning coordinates, not scrolling: transferring the glow does not replay the sweep. Sweep 1400ms, breathe 4500ms. Historical results keep a static rim. Stale/rejected/offline/refreshing and unsynced data do not receive a new live-win glow. Freshness timestamps remain readable outside the polite winner/authority announcement.
5. **Liquid press:** primary gold controls only; scale .975, 120ms press, 450ms release, three staggered rings plus a faint dimple. Transform-only ring growth avoids the sample CSS's animated width/height. Effects are bounded to four nodes and removed at 1400ms. Optional Android-only 8ms vibration is feature checked and nonessential.
6. **Island open/close:** native modal, desktop pill-origin scale .96 and fade / phone bottom-sheet slide. Entrance 420ms, explicit exit 280ms, backdrop 250ms. Rapid reversal starts from rendered geometry. A task-to-task handoff closes immediately before opening its destination: retaining a closing native modal would make the destination trigger inert and break focus restoration. Children remain mounted to preserve drafts. Shared scroll locks and focus guards prevent an outgoing sheet from unlocking the page or stealing focus from a new modal.
7. **Next-step advancement:** 200ms fade out, swap, 200ms fade in. The accessible name always identifies the new action. The bar is disabled during the outgoing label so a stale visible instruction cannot activate a different task. Labels wrap; no fixed-height truncation.

## Reduced motion and access

Reduced motion means the final state immediately: no rings, dimple, sweep, breathe, roll, dialog morph/slide, scrim fade, fill-height transition, delayed label color or next-step fade. A static current-winning glow may remain. Runtime media changes cancel active modal motion and clean pointer effects.

Native modality keeps background content inert and focus contained. Escape/Close return focus to the labelled Board actions trigger; task handoffs preserve the next task's focus. At 320 CSS px and 200% text, controls wrap/grow and content stays inside its scrollable modal.

## Regression evidence

`playwright-tests/final-motion.spec.ts` exercises explicit exit/reversal states, one-light transfer, 50-press cleanup, buyer fill reversal, and reduced motion. `quiet-glass-polish.spec.ts` covers 320/390/1280 reflow at 100%/200% text, keyboard focus containment, task handoffs and payout-draft retention. Existing draw/quarter/accessibility suites protect confirmations and final values. Existing material tests now enforce viewport ownership instead of obsolete breakpoint-specific glow radii; dialog timing checks use the approved 420ms ceiling while retaining transform/opacity-only and layout-stability assertions.

Production release must embed the real public Supabase URL and anonymous key (never service-role keys), exclude the placeholder endpoint, and verify browser-to-auth connectivity after deployment. Browser mocks and a landing-page 200 response do not establish authenticated sign-in success.
