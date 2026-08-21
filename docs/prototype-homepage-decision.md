# Product-First Homepage Prototype Decision

**Status:** Accepted final homepage composition
**Date:** 2026-08-20
**Track:** A — Product-first homepage
**Winner:** A1 Artifact-First Split
**Discarded:** A2 Board-as-Page Field

## Evidence reviewed

- A1/A2 rendered at Playwright iPhone 13-class 390×664 and desktop Chrome 1280×720 viewports
- Durable `evidence-phone.png`, `evidence-desktop.png`, and `evidence.json` files for each variant
- Measured first-viewport bounding boxes and document-width checks
- Organizer/viewer proof switching
- Optional brand-story disclosure
- Local CTA feedback and no-write behavior
- Accepted C1 viewer and B2 organizer artifacts
- Product, accessibility, landing-boundary, and design-governance contracts

Both prototypes passed:

- product definition in first viewport;
- Create your free board;
- See a live board;
- first published board free;
- no-money-handling boundary;
- visible accepted product proof;
- proof switching;
- optional story disclosure;
- CTA local feedback;
- no page-level phone overflow.

## Head-to-head score

Scale: 0–4. Passing target: 34/40, no category below 3, no hard failure.

| Dimension | A1 Artifact split | A2 Board field |
|---|---:|---:|
| Product specificity | 4 | 4 |
| Primary-task clarity | 4 | 3 |
| Information architecture | 4 | 3 |
| Hierarchy/noise floor | 4 | 3 |
| Typography/resilience | 3 | 3 |
| Semantic restraint | 4 | 2 |
| Interaction continuity/recovery | 4 | 4 |
| Cognitive load | 4 | 2 |
| Phone/desktop adaptation | 4 | 4 |
| Accessibility | 3 | 3 |
| **Total** | **38/40** | **31/40** |

A1 passes. A2 fails because semantic restraint and cognitive load score below 3.

## Why A1 wins

A1 leads with the organizer’s decision:

- what GridOne replaces;
- what it does through game day;
- that the first published board is free;
- that square money and payouts remain off-platform;
- the direct create and live-proof actions.

The accepted B2 organizer or C1 viewer artifact sits adjacent as evidence, not as a floating generic mockup. The composition remains calm and legible on phone and desktop, and the page can inherit the light working field associated with organizer trust.

A1 is conventional only where convention helps comprehension. Product specificity comes from the real board/workflow artifact and the GridOne phase language rather than from decorative effects.

## Why A2 is discarded

A2 makes the board/grid the page-scale scaffold. It is distinctive, but the structure becomes ornamental:

- the dark field dominates fundraiser trust and drifts toward sports/betting visual language;
- long copy competes with grid bands and cell lines;
- the board is repeated as background grammar and product artifact;
- mobile becomes materially longer and denser;
- future content expansion would make the composition brittle;
- accessibility and reading order require more exceptions for little task benefit.

The board should be the product artifact, not wallpaper.

## Production composition contract

### First viewport

At 390×844 and desktop, show without mandatory scrolling:

- GridOne identity
- `Football-squares fundraiser boards`
- Product promise/outcome
- `Create your free board`
- `See a live board`
- `First published board free`
- `GridOne tracks the board. It does not collect square money or pay winners.`
- Visible product proof using the accepted organizer or viewer artifact

No loader, film gate, scroll instruction, or cinematic runtime.

### Artifact proof

- Default proof should be the accepted B2 organizer task-header/artifact because the organizer is the buyer.
- Viewer proof switches in place using the accepted C1 personal-summary hierarchy.
- Proof is clearly synthetic until real customer evidence exists.
- The artifact is integrated into page composition, not tilted, floating, glowing, or surrounded by fake browser chrome.

### Remaining page order

1. Fundraiser workflow
2. Viewer proof/personalization
3. Trust, score authority, and recovery
4. Canonical pricing
5. Optional brand-story invitation
6. Final create action

### Optional story

- Native disclosure or separate optional route
- Never required for product comprehension or access
- Reduced-motion/static version complete
- No duplicate pricing/product truth

## Required production refinements

- Remove prototype labels, fixture controls, and design-explanation copy.
- Use production C1/B2 components only after their feature slices exist; do not copy sketch HTML/JS.
- Keep the header focused on product navigation rather than marketing-section clutter.
- Ensure the proof artifact begins inside the phone first viewport without crowding actions or boundary copy.
- Preserve body type at governed sizes and avoid extreme display tracking.
- Replace raw prototype white values with semantic tokens during production implementation.
- Verify SEO/static rendering, no-JS content, performance budgets, 320px, 390×844, desktop, 400% zoom, reduced motion, keyboard, and VoiceOver.

## Decision effect

- `docs/landing-product-boundary.md` remains product authority.
- A1 supplies the final homepage composition.
- A2 remains discarded evidence.
- All three prototype tracks now have winners:
  - C1 viewer personal-summary stack
  - B2 organizer task-header/contextual progress
  - A1 homepage artifact-first split
- The project is ready for a production implementation plan.
