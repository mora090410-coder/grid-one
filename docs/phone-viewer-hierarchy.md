# GridOne Phone-First Viewer Hierarchy

**Status:** Product and UX planning authority
**Date:** 2026-08-20
**Primary viewer:** Parent, supporter, friend, or community member opening a shared board on a phone
**Related:** root `PRODUCT.md`, root `DESIGN.md`, `organizer-journey-contract.md`, `product-metrics-and-evidence.md`

## Product job

A viewer should not need to understand football-squares software. On opening one link, they need three answers:

1. **Where are my squares?**
2. **Who wins now?**
3. **What next standard score makes me win this quarter?**

The viewer hierarchy changes after a name is selected. Personalization is a structural mode, not a color highlight applied to the same generic page.

## Governing principles

- Phone is the primary viewer surface.
- Score trust and Find My Squares appear without scrolling at a representative 390×844 viewport.
- The product never says “me” before the viewer has selected a board identity.
- The exact grid remains the public artifact, but users are not forced to pan a 10×10 board to discover their own coordinates.
- Payouts, rules, completed history, and organization details do not displace the primary game-day job.
- Scenarios are arithmetic outcomes, never odds or predictions.
- Final removes future-score scenarios and becomes a stable record.
- Open-square outcomes remain explicit and never invent winners.

## Viewer modes

### 1. Unpersonalized

No board identity is selected.

The page answers:

- Which board/game is this?
- What is the score state and authority?
- Who wins now?
- How do I find my squares?

It does **not** pretend to know what makes “me” win.

### 2. Personalized

A specific participant identity is selected.

The page answers:

- Which squares are mine?
- Am I winning now?
- Which standard next-score outcomes make me win?
- Where are those squares on the exact grid?
- Do I want verified winner email for this identity?

### 3. Final Record

The canonical game state is Final.

The page answers:

- What was the final score?
- Who won each milestone?
- Were any results OPEN or corrected?
- Where is the exact published board?

Future-score scenarios are absent.

## Phone hierarchy — unpersonalized

### First viewport

1. **Board identity**
   - Board title
   - Organization name when present
   - Matchup and kickoff/game state

2. **Score instrument**
   - Team abbreviations and score
   - Period/state
   - Current winner or honest no-current-winner state

3. **Score authority**
   - Live, Pregame, Manual, Refreshing, Stale, Offline, Rejected, or Final
   - Source and freshness
   - `Score updates about every minute`
   - Last-known language when appropriate

4. **Primary action**
   - `Find my squares`
   - Supporting line: `Use the name the organizer wrote on the board.`

These elements must fit without scrolling at 390×844 with normal text sizing. Payouts and board rules never appear above the primary action.

### After the first viewport

5. **Current result summary**
   - `Winning now: [display name / Open square / Unassigned]`
   - Current top/side digits
   - Pregame: `No current winner until scoring starts.`

6. **Scenario invitation**
   - `Pick your name to see which next scores make you win.`
   - Secondary disclosure: `See all next-score outcomes`

7. **Exact grid**

8. **Completed winners**

9. **Payouts, rules, and board details**

## Phone hierarchy — personalized

### First viewport

1. Compact board identity and score authority/freshness
2. **Your squares** summary
3. Personalized current-result status
4. Personalized next-score result or explicit none state

The selected summary includes:

- Selected display name
- Number of matching squares
- Every matching square’s top/side digits and board coordinate
- Current winning status
- `View on board` action
- `Choose another name` and `Clear` actions

Example information shape—not fixed copy:

```text
Your squares · Taylor M. · 3
PHI 4 / KC 7 · Square 18
PHI 1 / KC 2 · Square 43
PHI 9 / KC 6 · Square 77
View on board
```

Selecting `View on board` scrolls to the grid, preserves all highlights, and centers the first selected square without stealing focus unexpectedly.

### Personalized scenario section

Heading: `What makes [selected display name] win next?`

- Matching scenarios appear first.
- If none match: `No standard next score makes you win this quarter.`
- Non-matching outcomes remain behind `Show all next-score outcomes`.
- Expanded all-outcomes heading uses `Who would win next?`, not personalized language.

### Notification placement

After the viewer understands their squares and current/scenario status, show a compact affordance:

`Get winner email for this name`

Expanding it reveals the email-verification form.

Requirements:

- No account required
- Tied to durable participant identity, not display-name string alone
- One verified email workflow for Q1, Halftime, Q3, and Final wins
- Success/error adjacent to the form
- Hidden in private organizer preview and unpublished state
- Never shown for OPEN outcomes
- Preserve the no-payout-handling boundary

### Remaining order

5. Exact grid
6. Completed winners
7. Payouts, rules, and board details

## Scenario progressive disclosure

### Pregame or no score

Do not render ten inert rows.

Show:

- `Scenarios appear when a score is available.`
- `Find your squares now. GridOne will show next-score paths during the game.`

### Live without selected identity

- Primary action remains Find My Squares.
- All outcomes are collapsed by default.
- Expanded section is `Who would win next?`

### Live with selected identity

- Show only scenarios that make the selected participant win.
- Preserve team, scoring event, point change, resulting digits, and resulting winner.
- Provide secondary expansion for all outcomes.
- Keep `These are arithmetic score outcomes, not odds or predictions.` adjacent to the section.

### Stale/offline with last-known score

Scenarios may remain available only when a last-known score exists.

The scenario section itself states:

`Using the last known score checked [time].`

Do not rely on the distant score-authority label alone.

### No usable score

Hide scenario rows and show the unavailable state. Never generate outcomes from placeholder or contradictory scores.

### Final

Remove all next-score scenarios. Replace the section with the Final record.

## Exact grid contract

### Purpose

The grid confirms the published board and lets viewers inspect every square. It is not the sole answer to “where are my squares?”

### Viewport

- One explicit pan/zoom viewport
- Native touch scrolling/panning
- No page-level scroll hijacking
- No shrunken poster as the primary mobile solution
- Selected-square highlights persist during pan and zoom

### Orientation

Always provide an external or sticky orientation cue:

- `Top: [team]`
- `Side: [team]`

Inside the grid:

- Top team and axis remain sticky during vertical movement
- Side team and axis remain sticky during horizontal movement
- Axis digits use tabular typography

### Controls

Minimum 44×44 CSS pixels:

- Zoom out
- Current zoom
- Zoom in
- Reset/Fit
- Find
- Center selected, when personalized

Reset/Fit returns to the documented default view. Zoom cannot strand the viewer without visible orientation or reset controls.

### Cell behavior

Default cell text may remain privacy-reduced initials.

Tap or keyboard focus reveals:

- Full organizer-entered display label
- Top-team digit
- Side-team digit
- Board coordinate
- Current/resolved milestone status when applicable

Accessible name includes the same facts. Meaning never depends on color, hover, or motion alone.

### Selected cells

- All matching cells receive a cardinal selection treatment plus accessible selected state.
- Current/resolved winning state remains distinguishable from personal selection.
- `Center selected` moves to the first selected square; subsequent selected squares are reachable through the summary list.

### Winner states

- Current result: gold plus explicit `Winning now` semantics
- Resolved result: gold plus milestone label
- OPEN: explicit OPEN label and durable rules language
- Corrected result: correction marker and accessible explanation

## Completed winners and public corrections

### During live play

Completed winners appear after the grid by default. A compact `Past winners` disclosure may summarize resolved milestones above the grid, but cannot push Find My Squares or the grid out of the primary journey.

### Final

Final Record order:

1. Final score and authority
2. Q1, Halftime, Q3, and Final resolutions
3. OPEN result language and rules link/status
4. Viewer-visible public correction history
5. Exact grid
6. Payouts/rules/details

Viewer-visible sold-square or milestone correction history includes:

- What changed
- Before and after values
- Timestamp
- Organizer-provided reason

Private seller/payment/contact metadata never appears.

## Payouts, rules, and board details

These are important but secondary.

- Move below the exact grid in ordinary live/pregame hierarchy.
- Provide a compact `Board rules and payouts` disclosure/link near OPEN outcomes when relevant.
- Keep `GridOne tracks the board. It does not collect square money or pay winners.` visible within this section and in the first-view product boundary where needed.
- Do not show invented amounts or rules.

## Find My Squares contract

Current search behavior—exact normalized matching, suggestions, browse list, empty state, focus trap, Escape, and focus return—is preserved.

Required evolution:

- Selection resolves to durable participant identity when available, not display-name string alone.
- Duplicate/ambiguous labels require explicit user choice.
- Result returns participant id, display label, matching square indices, coordinates, and digits.
- Previously selected identity may be restored by share code when still valid.
- Invalid/stale saved selection is cleared with an explanation rather than silently matching another person.

The browse list remains secondary to search and must not present an unbounded wall before the search task.

## State-specific hierarchy

### Loading

- Do not flash a previously viewed board.
- Show board identity skeleton only when identity is known.
- Do not announce Live or display stale values before authority loads.

### Invalid, unavailable, deleted, or unpublished

- Never render a plausible empty board.
- Use the same public-not-found boundary for board, score, and subscription endpoints.
- Explain that the link does not open a published GridOne board.

### Defensive empty published board

New publication rules should make this impossible. Preserve a defensive state:

- `This board has no assignments.`
- Do not show scoring scenarios, notification enrollment, or a plausible active board.

### Pregame

- Matchup/kickoff and Find My Squares lead.
- Current winner is unavailable by definition.
- Scenarios wait for a usable score.

### Refreshing, stale, offline, rejected

- Last-known score remains visible only when valid.
- State and timestamp are explicit.
- Scenario section repeats whether it uses last-known data.
- No false “live” signal.

### Manual

- Label `Manual score · entered by organizer`.
- Do not visually downgrade it as less authoritative while manual mode owns the canonical state.

### Pending milestone

- Label provisional result as not settled.
- Do not mix it into completed winners.

### Final

- Final score and durable milestones replace future-looking content.
- No scenario heading or rows.
- Corrections remain visible.

## Fixed-axis launch guard

New published boards must use one fixed top/side axis set.

Implementation preflight must count existing published dynamic-axis boards before changing viewer behavior:

- If zero exist, reject dynamic public snapshots and remove the quarter selector from launch viewer code.
- If any exist, stop and create an explicit legacy-preservation plan. Do not flatten or reinterpret their axes silently.

## Architecture seams

The eventual viewer feature should separate hierarchy from domain computation:

```text
src/features/viewer/
  shell/            route/loading/unavailable boundaries
  score/            score instrument, authority, freshness
  identity/         Find My Squares and durable selection
  personal/         Your Squares summary and current status
  scenarios/        personalized and all-outcome disclosures
  board/            pan/zoom/orientation/cell detail
  notifications/    verified winner-email enrollment
  milestones/       pending, resolved, Final record, corrections
  details/          payouts, rules, organization and boundaries
```

`GameDayHorizon.tsx` should become composition, not a 400-line owner of every viewer behavior.

## Acceptance checks

### Unpersonalized 390×844 first viewport

Without scrolling:

- Board title/matchup visible
- Score state/authority/freshness visible
- `Score updates about every minute` visible
- `Find my squares` visible
- No payout/rules block above Find My Squares
- No heading says `me` before identity selection

### Personalized 390×844 first viewport

After selecting a participant:

- Selected display name and count visible
- At least one coordinate/digit summary visible
- `View on board` visible
- Current personal status visible
- Matching next-score result or explicit none state visible
- Notification form does not precede the personal summary

### Scenario behavior

- Pregame/no score: no ten-row list
- Live/unselected: all outcomes collapsed; no personalized heading
- Live/selected: matching outcomes first; all outcomes secondary
- Stale/offline: local last-known disclosure
- Final: no next-score scenarios

### Board behavior

At 390×844:

- Horizontal pan works
- Top axis remains visible during vertical movement
- Side axis remains visible during horizontal movement
- Top/side orientation cue remains visible
- Controls meet 44×44 geometry
- Reset/Fit restores default
- Center selected works
- Full name/detail available by tap and keyboard focus
- Cell accessible names contain identity/open state, digits, coordinate, and milestone state

### Notification behavior

- No identity selected: no email form
- Selected durable participant + published services: compact opt-in after personal status
- Private preview/unpublished: no opt-in
- OPEN: no winner enrollment
- Success/error announced beside the form

### Final and correction behavior

- Final suppresses scenarios
- Q1/Halftime/Q3/Final resolutions visible
- OPEN outcomes use durable policy language
- Viewer-visible corrections show before/after, time, and reason
- Pending results remain distinct from settled facts

### Accessibility and resilience

- Logical reading order matches visual order
- Keyboard focus follows structural mode changes
- 200% zoom has no horizontal page overflow outside the board viewport
- Reduced motion removes nonessential movement without changing information
- Long names, localization expansion, and unavailable states remain legible
- No analytics, score, or notification failure blocks board inspection
