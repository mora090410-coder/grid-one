# Organizer Workspace Prototype Decision

**Status:** Accepted composition direction
**Date:** 2026-08-20
**Track:** B — Organizer workspace
**Winner:** B2 Task Header + Contextual Progress Disclosure
**Discarded:** B1 Phase Rail + Artifact Workspace

## Evidence reviewed

- B1/B2 rendered at iPhone 13-class and desktop Chrome viewports
- Fill, Reconcile, Draw, Preview, Go Live, and Conflict fixture states
- Bulk-assignment controls and board interaction
- Advisory Reconcile semantics
- Draw preview/commit/replace behavior
- Save status and conflict recovery
- Mobile page-overflow measurement

The first B1 render exposed a grid min-content defect that expanded the mobile layout viewport to 798 CSS pixels. Adding `min-width: 0` to the grid ancestry restored the intended 390px page and contained board scrolling.

Both variants subsequently passed the organizer-state interaction assertions.

## Head-to-head score

Scale: 0–4. Passing target: 34/40, no category below 3, no hard failure.

| Dimension | B1 Phase rail | B2 Task header |
|---|---:|---:|
| Product specificity | 4 | 4 |
| Primary-task clarity | 4 | 4 |
| Information architecture | 3 | 4 |
| Hierarchy/noise floor | 3 | 4 |
| Typography/resilience | 3 | 3 |
| Semantic restraint | 3 | 4 |
| Interaction continuity/recovery | 4 | 4 |
| Cognitive load | 3 | 4 |
| Phone/desktop adaptation | 3 | 4 |
| Accessibility | 3 | 4 |
| **Total** | **33/40** | **39/40** |

B1 misses the passing threshold. B2 passes with no category below 3.

## Why B2 wins

B2 gives the current task and artifact the screen:

- sticky board identity, phase, save state, and primary action;
- full-width phase artifact;
- journey progress and prior phases available through disclosure;
- no permanent side rail competing with the grid;
- clean adaptation from desktop to phone;
- easier focus order and less repeated navigation.

This matches the organizer contract: one dominant artifact and one primary action at a time.

## Why B1 is discarded

The permanent phase rail and context strip provide orientation but create continuous tax:

- desktop grid is compressed between two side columns;
- phone receives another horizontal phase surface before the artifact;
- Reconcile appears more like a mandatory gate despite being advisory;
- the artifact becomes one panel among three rather than the owning surface;
- grid min-content behavior required extra containment and remains easier to regress.

The rail solves orientation by permanently occupying space that the organizer needs for work.

## Production composition contract

### Sticky task header

Always show:

- Board name
- Current lifecycle phase
- Save state and last acknowledged revision/time
- One primary action describing the result
- Conflict/error state when applicable

Do not show prototype fixture toggles in production.

### Progress disclosure

A compact `Show setup progress` control reveals:

- Create Draft
- Fill
- Reconcile
- Draw
- Preview
- Go Live
- Completed/current/upcoming state
- Advisory counts and hard blockers

Prior-phase navigation lives inside this disclosure or an equivalent deliberate context surface. It is not a second permanent tab bar.

Reconcile must be labeled as advisory/private when unresolved payment or seller metadata remains.

### Artifact workspace

The phase artifact uses full available width:

- Fill: assignment grid and bulk controls
- Reconcile: readiness checklist and grouped private follow-up
- Draw: axis preview/commit
- Preview: exact viewer preview
- Go Live: publish review
- Conflict: blocking recovery choice

Secondary settings, import, scoring, and destructive actions do not appear before the phase artifact.

### Phone

- Native page scrolling
- Sticky header remains compact enough not to obscure the artifact
- Progress disclosure closed by default
- Board owns its horizontal scroll viewport
- No page-level horizontal overflow
- Primary action remains at least 44px and reachable without crossing unrelated controls

### Desktop

- Artifact may use full-width or an artifact-plus-context split only when the secondary context is phase-specific and clearly subordinate.
- Do not reintroduce generic Overview/Edit/Preview tabs.
- Do not place permanent left and right rails around the board.

## Required production refinements

B2 is a composition decision, not production code.

- Remove prototype fixture-state controls and explanatory demo copy.
- Put actual phase navigation inside progress disclosure.
- Keep sticky header height bounded at phone widths.
- Use the canonical save states: clean, dirty, saving, failed, conflicted, recovered.
- Make conflict state block phase progression and expose safe reload/recovery.
- Preserve board keyboard grid behavior and touch scrolling.
- Distinguish advisory Reconcile items from hard readiness blockers.
- Duplicate display labels that make participant identity ambiguous are hard readiness blockers; off-platform payment and seller follow-up remain advisory.
- Keep all phase navigation inert during a save conflict until explicit reload/recovery.
- The task-header Draw action contract is exact: before a preview exists, `Preview draw` is the sole primary and `Back to Reconcile` is secondary; after preview exists, `Commit draw` is primary and `Regenerate preview` is secondary.
- Render long board names, organization names, errors, and revision state at 200% text.
- Validate 320px, 390×844, desktop, 400% zoom, reduced motion, and forced colors.

## Decision effect

- `docs/organizer-journey-contract.md` remains product authority.
- B2 supplies the selected organizer-shell composition.
- B1 remains disposable evidence.
- Production implementation must translate the decision into feature seams rather than copy prototype HTML/JS.

## Next prototype track

Track A — Product-first homepage:

- A1 Artifact-first split
- A2 Board-as-page field

The homepage prototypes must use the selected phone-viewer and organizer artifacts rather than inventing fictional UI.
