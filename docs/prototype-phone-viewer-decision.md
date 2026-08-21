# Phone Viewer Prototype Decision

**Status:** Accepted composition direction
**Date:** 2026-08-20
**Track:** C — Phone viewer
**Winner:** C1 Personal Summary Stack
**Discarded:** C2 Personal Summary + Board Peek

## Evidence reviewed

- C1 and C2 rendered at iPhone 13-class and desktop Chrome viewports
- Unpersonalized and personalized state screenshots
- Stale and Final fixture transitions
- Find My Squares modal behavior
- Exact-grid pan/zoom/control structure
- Automated assertions for state isolation, Escape, focus return, and Final scenario removal
- Design-system and accessibility contracts

The first render exposed and corrected:

- CSS overriding the HTML `hidden` attribute and leaking every state simultaneously
- Arbitrary prototype shadow outside GridOne’s elevation contract
- Raw neutral values bypassing shared tokens
- Find-dialog Escape/focus-return failure

The corrected prototypes pass state/dialog/focus assertions.

## Head-to-head score

Scale: 0–4. Passing target is 34/40, no category below 3, and no hard failure.

| Dimension | C1 Summary stack | C2 Board peek |
|---|---:|---:|
| Product specificity | 4 | 4 |
| Primary-task clarity | 4 | 3 |
| Information architecture | 4 | 3 |
| Hierarchy/noise floor | 3 | 3 |
| Typography/resilience | 3 | 3 |
| Semantic restraint | 4 | 3 |
| Interaction continuity/recovery | 4 | 3 |
| Cognitive load | 4 | 2 |
| Phone/desktop adaptation | 3 | 3 |
| Accessibility | 4 | 3 |
| **Total** | **37/40** | **30/40** |

C2 fails the passing bar because cognitive load scores below 3 and the duplicated board introduces a trust/orientation defect.

## Why C1 wins

C1 answers the viewer’s primary question directly in text:

- selected identity;
- square count;
- every matching coordinate/digit pair;
- current result;
- matching next-score outcomes;
- one explicit `View on board` action.

The full board remains the single inspectable public artifact. Personal coordinates make it confirmatory rather than forcing discovery through pan/zoom.

This structure is easier to understand, easier to make accessible, and less likely to diverge from the actual grid.

## Why C2 is discarded

The cropped board peek duplicates the public grid and creates two spatial representations of one record.

Observed risks:

- The crop can center a current winner or arbitrary area rather than the selected viewer’s square.
- The user must understand that the first grid is non-interactive and incomplete while the second is authoritative.
- It consumes substantial phone height before scenarios and the exact grid.
- Desktop becomes a dense split layout with board content repeated in both columns.
- Accessibility requires suppressing duplicate semantics while still explaining the crop, adding complexity without proportional benefit.

The board peek does not improve comprehension enough to justify these risks.

## Borrowed behavior

Borrow from C2 only:

- `View on board` / `Center selected` moves to the single exact grid and centers the first matching square.

Do not borrow:

- cropped grid;
- second board surface;
- duplicated axis labels;
- duplicated winner highlighting.

## Production composition contract

### Phone unpersonalized

1. Compact board identity/matchup
2. Compact score/current result
3. Authority/freshness
4. Find My Squares in the first viewport
5. Unpersonalized scenario invitation/disclosure
6. Exact grid
7. Completed winners and details

The prototype’s state-toggle toolbar and explanatory prototype copy are not product UI and do not count toward the production first viewport.

### Phone personalized

1. Compact board identity and score authority
2. Your Squares summary with coordinate/digit rows
3. Personal current status
4. Matching next-score outcomes
5. Compact winner-email disclosure
6. Single exact grid with center-selected
7. Completed winners and details

### Desktop

Preserve the same reading order, but allow the single exact grid and personal summary/scenarios to form a deliberate split composition when width permits. Do not stretch the phone stack into full-width horizontal slabs.

## Required production refinements

C1 is a composition winner, not production styling.

Before implementation:

- Remove prototype toolbar and design-explanation copy.
- Compress title/matchup so Find My Squares fits in the real first viewport.
- Refine scenario rows so team/event, resulting digits, and winner have distinct columns/lines rather than running together.
- Avoid repeating the selected name on every coordinate row.
- Keep body text and controls within the governed type scale.
- Use durable participant identity, not display-name string matching.
- Implement one-tab-stop board-grid navigation and sticky top/side axes.
- Verify 320px, 390×844, 200% text, 400% zoom, reduced motion, forced colors, VoiceOver, and keyboard behavior.

## Decision effect

- `docs/phone-viewer-hierarchy.md` remains authoritative.
- C1 supplies the selected composition stance.
- C2 remains disposable evidence and is not promoted.
- Production implementation planning may use C1 hierarchy decisions but must not copy prototype HTML/JS wholesale.

## Next prototype track

Track B — Organizer workspace:

- B1 Phase Rail + Artifact Workspace
- B2 Task Header + Contextual Progress Disclosure
