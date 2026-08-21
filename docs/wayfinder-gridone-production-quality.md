# Wayfinder: GridOne Production-Quality Product and UX

**Status:** Active planning map
**Created:** 2026-08-20
**Repository:** `/Users/amm13/00-Projects/parkside/gridone-app`

## Destination

GridOne becomes a launch-worthy customer product for running football-squares boards—not a portfolio-only redesign.

The finished product must let the selected primary organizer create, fill, reconcile, draw, publish, and operate a board without paper or spreadsheet fallback, while a phone-first viewer can open one link, identify the game state and score authority, find their squares, understand who wins now and what score makes them win next, and inspect the exact board.

The handoff artifact will be an implementation-ready product/UX specification plus a sequenced engineering plan. Readiness requires:

- one reconciled product and pricing truth;
- explicit primary user and launch workflow;
- complete organizer and viewer information architecture;
- a governed design-system foundation and GridOne overlay;
- designed loading, empty, error, stale, offline, permission, destructive, success, and recovery states;
- WCAG AA, keyboard, touch, reduced-motion, 200% zoom, and narrow-phone requirements;
- measurable product outcomes and an instrumentation plan;
- bounded vertical implementation slices with tests, rendered QA, rollout, and rollback;
- no unresolved decision that forces implementers to invent product behavior.

## Governing constraints

- Customer success outranks portfolio appearance. Any case study is derived from verified product work.
- Preserve product truth: GridOne tracks and communicates boards; it never collects square money, holds funds, or pays winners.
- Organizer and viewer are separate authority surfaces.
- Preserve the strongest product differentiators: one viewer link, Find My Squares, score provenance/freshness, current-quarter scenarios, winner resolution, and manual scoring recovery.
- Preserve core security boundaries across browser, Cloudflare Functions, Supabase, Stripe, scoring provider, and email provider.
- Do not redesign data schemas, permissions, pricing, or business behavior implicitly through UI work.
- Do not deploy, spend, publish, contact users, or mutate production without Anthony approval.
- Existing untracked repository files are protected until separately reconciled.

## Evidence inspected

- Live landing page at desktop and phone widths.
- Live `/demo` viewer and Find My Squares dialog at phone width.
- Live `/login` surface.
- `DESIGN.md`, `docs/DESIGN_TOKENS.md`, `docs/greenfield-product-spec.md`, `docs/vision-code-gap.md`, `docs/ARCHITECTURE.md`, `docs/TEST_STRATEGY.md`, source routes/components, and Playwright accessibility coverage.
- Baseline `npm run test:unit && npm run build`: passed on 2026-08-20.

## Decisions so far

- **Product-first objective** — GridOne is optimized as a real customer product. Hiring/portfolio value is secondary evidence.
- **Quality definition** — production quality includes product judgment, accessibility, reliability, maintainability, verification, measurable outcomes, and documented tradeoffs—not visual polish alone.
- **Existing direction** — Game-Day Horizon remains a candidate product overlay, not an untouchable answer. Rendered usability evidence can override it.
- **Implementation posture** — work will proceed in behavior-preserving vertical slices, not a repo-wide folder shuffle or visual big bang.
- **Primary launch organizer** — optimize first for a youth-sports fundraiser organizer running 1–5 boards for a team or booster club. Casual pools remain supported, but they do not override the fundraiser workflow.
- **Operating scene** — assume volunteer labor, fragmented participant information, optional seller/parent attribution, private paid/unpaid tracking, laptop setup, phone-based correction/checking, and repeated game-day questions from viewers.
- **Canonical 2026 commercial model** — keep the live offer exactly as implemented: Free is one published board per account per season; Game Day is $9.99 one-time for five total published boards in the 2026 season; Organization is $79 for the season for 50 total published boards plus organization naming, shared-dashboard, and receipt behavior.
- **Commercial authority** — `PRODUCT.md`, `README.md`, active server pricing definitions, production Terms, and tested checkout behavior are authoritative. `$4.99 / 20-board` and `$14.99 per-board` statements are retired historical context.
- **Feature gating rule** — payment gates seasonal publishing volume, not the quality of live scoring, scenarios, winner resolution, sharing, or other core viewer capabilities on an activated board.
- **North-star outcome** — Successful Game-Day Board Runs through Final. Qualification requires a published and publicly available board, committed axes, authoritative scoring, durable Q1/Q2/Q3/Final resolution, and no unresolved integrity/publication/score-authority failure.
- **Evidence policy** — establish a baseline with five target-organizer sessions, five phone-viewer sessions, and the first ten real eligible fundraiser boards before setting numerical improvement targets. See `product-metrics-and-evidence.md`.
- **Landing boundary** — the homepage is product-first. It must show the product, outcome, actual artifact, Create your free board action, See a live board proof action, free-first-board truth, and no-money-handling boundary without a loader or mandatory scroll choreography. The existing film may survive only as an optional, skippable brand story outside the critical path. See `landing-product-boundary.md`.
- **Organizer journey** — setup is `Create Draft → Fill → Reconcile → Draw → Preview → Go Live`; publication then replaces setup with `Game Day → Final Record`. Reconcile is an advisory private checkpoint, Go Live is a one-time transition, open outcomes remain OPEN, draft redraws are allowed before publication, and public corrections require viewer-visible audit. See `organizer-journey-contract.md`.
- **Phone-first viewer** — the first viewport shows board identity, score/current result, authority/freshness, and Find My Squares. Selecting a durable participant identity structurally replaces the generic hierarchy with Your Squares coordinates, personal current status, matching next-score outcomes, compact email opt-in, then the exact grid. Full outcomes, completed winners, and rules use progressive disclosure/order appropriate to live vs Final. See `phone-viewer-hierarchy.md`.
- **Design-system governance** — `docs/universal-interface-foundation.md` defines product-agnostic quality; root `DESIGN.md` is the formal GridOne overlay; `docs/DESIGN_TOKENS.md` maps it to CSS; `docs/design-system-governance.md` defines enforcement. The overlay validates with zero errors/warnings. Product components cannot invent raw colors, blur, glow, arbitrary shadows/radii, or legacy glass semantics.
- **Prototype strategy** — prototype only three unresolved compositions in disposable HTML: phone viewer first, organizer workspace second, product-first homepage third. Each receives two meaningfully different stances, rendered phone/desktop evidence, a 40-point quality rubric, and a keep/discard decision. See `prototype-strategy.md`.
- **Accessibility contract** — target WCAG 2.2 AA across complete processes, with 44×44 product controls, governed dialogs, reflow/zoom/motion/state requirements, and combined automated/manual assistive-technology evidence. The 10×10 boards use one-tab-stop roving-focus data-grid navigation instead of 100 page tab stops. See `accessibility-contract.md`.
- **Instrumentation and rollout** — prefer server-owned outcome facts plus minimal first-party client events, prohibit personal board/contact data in analytics, and ship independently reversible `viewer_v2`, `organizer_v2`, and `homepage_v2` cohorts. Rollback preserves routes and domain state. See `instrumentation-rollout-feedback.md`.
- **Phone prototype winner** — C1 Personal Summary Stack scored 37/40 and is accepted. C2 Board Peek scored 30/40 and is discarded because it duplicates the public artifact and can misorient users. Borrow only center-selected navigation to the single exact grid. See `prototype-phone-viewer-decision.md`.

## Current rendered findings

### Strengths to preserve

- The paper-board hero is specific to the product rather than generic SaaS imagery.
- Cardinal, gold, ink, and broadcast-white create recognizable identity.
- The viewer exposes score, game state, freshness/source language, Find My Squares, scenarios, and the exact grid.
- The Find My Squares flow has semantic dialog and button structure.
- Core controls generally provide generous touch geometry.

### Highest-impact gaps

- **P1 — Landing task delay:** cinematic loading and a very long scroll-driven film delay product proof and create large dead regions in static/full-page rendering. The landing prioritizes atmosphere before confidence.
- **P1 — Viewer hierarchy:** mobile shows the full ten-scenario list before the exact board. The differentiator becomes a long wall of equal-weight rows and delays the artifact users came to inspect.
- **P1 — Product truth drift:** README/live pricing, the older greenfield specification, and AMM-OS have carried conflicting pricing and product states.
- **P1 — Organizer complexity:** `AdminPanel.tsx` concentrates many workflows and makes coherent phase-specific UX risky to evolve.
- **P2 — Auth identity:** login is usable but visually generic and disconnected from the phase-based product world.
- **P2 — Design-system drift:** `DESIGN.md`, token documentation, legacy aliases, and rendered surfaces do not yet form one enforceable contract.
- **P2 — Scenario comprehension:** scenario rows are mechanically clear but do not lead with the selected viewer or progressively disclose lower-value outcomes.
- **P2 — Demo realism:** synthetic state labels are honest but the demo does not yet teach the product in a compact, confidence-building narrative.

## Frontier — open, unblocked decisions

No unresolved planning decision is currently unblocked. The next work is evidence-producing prototype execution.

## Blocked decisions

- **Final visual overlay** — blocked by winning prototype evidence.
- **Feature migration order** — blocked by prototype outcomes and technical dependency mapping.
- **Portfolio case-study structure** — blocked by shipped product evidence and measured outcomes.

## Not yet specified

- Whether limited discovery interviews can be run with real organizers/viewers before implementation.
- Exact analytics/privacy tooling and event taxonomy.
- Whether the landing film is reduced, made skippable, deferred, or replaced.
- How much of the current demo fixture can serve as an onboarding/proof surface.
- Final typography choice and whether existing fonts meet loading/performance constraints.
- Dark/light behavior across lifecycle phases and system appearance preferences.
- Support and incident response expectations during live games.

## Out of scope for this planning pass

- Deployment or production configuration changes.
- Stripe purchases or price changes.
- Supabase schema or production-data mutation.
- Marketing distribution, social posting, or customer contact.
- A wholesale rewrite solely to obtain fashionable folders.
- Copying Google, Apple, or another company’s visual language.

## Handoff condition

Planning is complete only when every blocking decision above is resolved, representative organizer/viewer prototypes have been evaluated, acceptance criteria are explicit, and the implementation sequence can be executed without inventing product behavior mid-refactor.

## Recommended next action

**Execute Prototype Track B: Organizer workspace.** Build B1 Phase Rail + Artifact Workspace and B2 Task Header + Contextual Progress Disclosure as disposable interactive variants, then repeat the rendered evidence, accessibility checks, scoring, and keep/discard decision. Production components remain untouched during the track.
