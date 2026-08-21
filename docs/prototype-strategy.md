# GridOne Prototype Strategy

**Status:** Planning authority
**Date:** 2026-08-20
**Prototype location:** repository `sketches/`
**Production code changes:** prohibited during prototype rounds

## Purpose

Use the cheapest interactive evidence to resolve composition before production refactoring. Prototypes test hierarchy, task flow, density, responsive behavior, and interaction contracts. They are disposable HTML—not component starter code.

Do not prototype settled product rules, back-end behavior, or every route. Prototype only where two credible compositions remain.

## Shared prototype rules

- Use the canonical GridOne palette, typography roles, radii, and anti-slop rules from root `DESIGN.md`.
- Keep a minimal shared `sketches/theme.css`; do not create a parallel token system.
- Use realistic synthetic fundraiser data clearly labeled as demonstration.
- No invented customers, metrics, fundraising totals, or testimonials.
- Every variant is interactive enough to demonstrate its primary action and one meaningful state transition.
- Test at 390×844 and representative desktop width.
- Use native scrolling; no global animation runtime.
- Prototypes cannot import production components, call production APIs, write data, or become deployment artifacts.
- A winning composition is translated deliberately into production architecture. Prototype markup is never copied wholesale.

## Prototype Track A — Product-first homepage

### Decision being tested

How should the homepage prove GridOne immediately while retaining a distinct product identity?

### Core action

`Create your free board`

### Required first-viewport content

- Football-squares product definition
- Build/share/game-day outcome
- Actual board/viewer artifact
- Create your free board
- See a live board
- First published board is free
- GridOne does not collect square money or pay winners

### Two variants

#### A1 — Artifact-first split

- Copy/action column paired with a real viewer/board instrument
- Strongest for immediate comprehension and proof
- Risk: can resemble polished SaaS marketing if the artifact becomes a floating mockup

#### A2 — Board-as-page field

- The board itself structures the viewport; product promise/actions occupy deliberate open cells/bands
- Strongest for product specificity
- Risk: can compromise legibility or become decorative if the board is not clearly usable evidence

### Reject

- Cinematic loader/mandatory scroll
- Generic centered hero
- Feature-card grid in the first two sections
- Full pricing table above product proof

### Evidence

- Five-second comprehension test
- Primary-action identification
- Mobile first-viewport screenshot
- No-motion/no-JavaScript-content inspection

## Prototype Track B — Organizer workspace

### Decision being tested

How should one phase own the screen while preserving context, save state, and deliberate navigation to prior work?

### Representative states

- Fill with partial assignments
- Reconcile with open/unpaid/duplicate advisory issues
- Draw with previewed digits
- Preview with open-square acknowledgment
- Save conflict banner

### Core action

Complete the current phase’s next meaningful step.

### Two variants

#### B1 — Phase rail + artifact workspace

- Compact horizontal/vertical phase rail
- Sticky board identity/save state
- Dominant phase artifact
- Secondary checklist in a narrow context region
- Strongest continuity with Game-Day Horizon
- Risk: phase rail may consume phone space or imply advisory Reconcile is a hard gate

#### B2 — Task header + contextual progress disclosure

- Current phase in a compact sticky task header
- Full-width artifact
- Progress and prior phases behind an explicit disclosure
- Strongest focus and phone adaptation
- Risk: weaker sense of the complete journey

### Prototype interactions

- Bulk assignment mode
- Continue to Reconcile/Continue anyway
- Preview and commit draw
- Conflict banner choice
- Phone phase/context disclosure

### Reject

- Overview/Edit/Preview generic tabs as the primary mental model
- All controls mounted on one long page
- Grid appearing below schedule/settings/scoring
- Payment review represented as a hard gate

### Evidence

- Moderator-free identification of current phase and next action
- Keyboard focus path
- Save/conflict comprehension
- 320px/390px overflow inspection

## Prototype Track C — Phone viewer

### Decision being tested

How should selection transform the first viewport and connect personal summaries to the exact board?

### Representative states

- Live, unpersonalized
- Live, selected participant with matching scenarios
- Live, selected participant with no matching standard next score
- Stale last-known score
- Final record with correction/open outcome

### Core action

`Find my squares`

### Two variants

#### C1 — Personal summary stack

- Score/authority
- Find or Your Squares
- Personal current status
- Matching scenarios
- Compact email opt-in
- Exact grid
- Strongest linear phone comprehension
- Risk: selected users may still scroll before reaching the board

#### C2 — Personal summary + board peek

- Score/authority
- Your Squares summary with a cropped/anchored selected-cell board peek
- Matching scenarios and full board below
- Strongest spatial connection to the grid
- Risk: a decorative board peek can duplicate controls or create two sources of orientation

### Prototype interactions

- Open/close Find My Squares
- Select participant
- Expand all scenarios
- View/center selected square
- Expand email verification
- Switch live/stale/Final fixture state

### Reject

- Ten equal scenarios before the board by default
- “Me” language without selection
- Payouts above Find My Squares
- Notification form before personal identity/status
- Future-score scenarios in Final

### Evidence

- Selected viewer identifies coordinates without panning
- View-on-board preserves highlights and orientation
- Final state removes future-looking content
- Reading order equals visual order

## No-prototype surfaces

Do not spend a variant round on:

- Login/signup: derive from the selected foundation and homepage/workspace language.
- Pricing: commercial model and hierarchy are already settled.
- Terms/Privacy/articles: derive editorial templates after foundation validation.
- Basic dialogs, buttons, inputs, loading, and errors: use governed primitives and state contracts.
- Dashboard board list: derive after organizer shell winner is known.

Prototype these only if rendered implementation exposes a real unresolved decision.

## Evaluation rubric

Score every variant 0–4 on:

1. Product specificity
2. Primary-task clarity
3. Information architecture
4. Hierarchy/noise floor
5. Typography and long-content resilience
6. Semantic color/material restraint
7. Interaction continuity and recovery
8. Cognitive load
9. Phone/desktop adaptation
10. Accessibility

Passing bar:

- At least 34/40
- No category below 3
- No hard-fail anti-slop or accessibility violation

Anton selects the strongest stance using rendered evidence. Anthony is asked only if variants imply a different product promise, trust boundary, or business tradeoff.

## Prototype order

1. Phone viewer — highest game-day volume and current hierarchy defect
2. Organizer workspace — determines feature-shell and phase composition
3. Homepage — must use the actual selected product artifacts rather than inventing them first

This order intentionally prototypes the product before its marketing wrapper.

## Deliverables per track

```text
sketches/<track>-<stance>/
  index.html
  README.md
```

Each README records:

- design stance
- key choices
- strongest use case
- tradeoffs
- rubric score
- rendered viewport evidence
- keep/discard decision

A head-to-head decision record identifies the winner and any explicitly borrowed element from the losing variant.

## Stop condition

Prototype work stops when:

- one composition per track passes the rubric;
- phone and desktop render without structural defects;
- hierarchy matches product contracts;
- no remaining question would change feature architecture;
- the winning decisions are captured in the implementation plan.

Do not polish disposable variants after the decision is clear.
