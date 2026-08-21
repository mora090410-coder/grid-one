# GridOne Landing-to-Product Boundary

**Status:** Resolved product decision
**Date:** 2026-08-20
**Related:** `../PRODUCT.md`, `wayfinder-gridone-production-quality.md`, root `DESIGN.md`

## Decision

GridOne uses a **product-first homepage**. The cinematic scroll film is no longer the mandatory entrance or the primary homepage structure.

The existing film may survive as an optional, explicitly entered brand story. It must never block product access, own the critical rendering path, or be required to understand what GridOne does.

## Why

The primary visitor is a volunteer youth-sports fundraiser organizer with limited time and incomplete trust. Their first questions are practical:

1. What does this replace?
2. Can I see a real board?
3. Can I start without paying?
4. Will it work on game day?
5. Does GridOne touch the money?

The current scroll-driven film provides distinctive atmosphere but delays those answers, creates excessive page length, and can render as large dead regions when animation or scroll assumptions differ. Product proof must outrank performance art.

## Homepage first-viewport contract

Without scrolling, a representative desktop and phone visitor must see:

- **Product:** football-squares boards for team and booster-club fundraisers.
- **Outcome:** build the board, share one link, and let GridOne track game day.
- **Primary action:** Create your free board.
- **Secondary proof action:** See a live board.
- **Commercial truth:** first published board is free.
- **Boundary:** GridOne tracks the board; it does not collect square money or pay winners.
- **Product evidence:** the actual board/viewer artifact or a clearly labeled realistic demonstration—not a generic feature illustration.

No splash screen, film loader, autoplay gate, or scroll instruction may delay these elements.

## Recommended homepage sequence

1. **Product entrance** — promise, artifact, actions, free-first-board truth, money boundary.
2. **Fundraiser workflow** — Fill → Reconcile → Draw → Preview → Go Live, expressed through the actual organizer artifact rather than equal feature cards.
3. **Viewer proof** — score authority, Find My Squares, personalized next-score scenarios, exact grid.
4. **Trust and recovery** — score freshness/manual recovery, privacy boundary, winner resolution.
5. **Pricing** — Free, Game Day, Organization using the canonical 2026 contract.
6. **Optional story invitation** — a quiet “Watch how game day changes” entry to the cinematic film if retained.
7. **Final action** — Create your free board, with guides as a lower-priority path.

## Cinematic story contract

If retained, the film:

- lives on an optional route or explicitly opened overlay/surface;
- loads only after user intent or during idle time after the product entrance is usable;
- is fully skippable and has visible navigation back to the product;
- supports reduced motion with a concise static narrative;
- does not own global scrolling or leave Lenis/GSAP runtime effects on product routes;
- does not duplicate pricing or product truth that can drift from canonical content;
- is performance-budgeted and excluded from the viewer/organizer critical path.

The film can demonstrate brand craft. It cannot be the tollbooth to the product.

## Interaction and performance requirements

- Primary actions usable as soon as the initial HTML/React surface is interactive.
- No scroll hijacking on the homepage or product routes.
- Native scrolling remains the default.
- Motion is interruptible, task-supporting, and optional.
- `prefers-reduced-motion` receives complete information without spatial choreography.
- Product content remains coherent when JavaScript animation fails.
- Hero imagery must not delay text/action rendering or cause layout shift.
- Mobile first viewport must not hide the product promise or actions behind decorative media.

Exact numerical performance budgets will be set during the implementation plan using measured current baselines and the selected deployment environment.

## Content posture

- Speak to the organizer’s job, not GridOne’s technical architecture.
- Lead with reduced coordination and game-day trust.
- Avoid invented fundraising totals, customer counts, testimonials, or time-savings claims.
- “Ten minutes, start to finish” remains unproven and must not be treated as fact until moderated testing supports it.
- Keep the free-first-board and no-money-handling boundaries visible.

## Acceptance evidence

Before implementation is accepted:

- Desktop and phone screenshots show the complete first-viewport contract.
- A keyboard user can reach both primary actions immediately.
- Reduced-motion mode presents no loader or blank cinematic region.
- Disabling animation does not remove content or navigation.
- Landing tests verify canonical pricing and product-boundary claims.
- The optional film, if retained, cannot affect organizer/viewer scrolling or bundle-critical behavior.
- Five target-organizer sessions test whether visitors can explain GridOne and choose the correct next action without help.

## Non-goals

- Removing all personality from the brand.
- Replacing the homepage with a generic SaaS hero and card grid.
- Copying Google, Apple, Stripe, or another company’s composition.
- Deleting the film before its best assets and ideas are evaluated for reuse.
- Implementing the redesign during this decision phase.
