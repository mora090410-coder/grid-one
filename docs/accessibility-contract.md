# GridOne Accessibility and Inclusive-Use Contract

**Status:** Product, design, and release authority
**Date:** 2026-08-20
**Standard baseline:** WCAG 2.2 Level AA
**Primary references:** W3C WCAG 2.2 Recommendation; WAI-ARIA Authoring Practices grid and modal-dialog patterns

## Conformance posture

GridOne targets WCAG 2.2 Level AA across complete user processes—not isolated components.

The product adopts stricter internal requirements where game-day conditions justify them, including 44×44 CSS-pixel controls even though WCAG’s minimum target-size criterion can be smaller.

Automated tooling cannot prove conformance. Release evidence combines deterministic checks, browser automation, assistive-technology review, and human task testing.

Do not claim formal conformance until the complete public and organizer processes have been evaluated and known exceptions documented.

## Complete processes in scope

### Organizer

- Sign up/sign in
- Create draft
- Fill and edit assignments
- Reconcile and acknowledge open squares
- Draw and commit axes
- Preview
- Go Live/checkout when applicable
- Recover save conflict/failure
- Operate manual scoring
- Correct published labels/milestones
- Review Final record

### Viewer

- Open published link
- Understand score authority/freshness
- Find My Squares
- Read personal coordinates/current status/scenarios
- Inspect exact grid
- Verify winner email
- Understand pending/resolved/corrected/OPEN results
- Use Final record

### Supporting

- Homepage and demo
- Dashboard
- Terms/Privacy/articles
- Invalid/unpublished/deleted/offline/error states

## Semantic structure

- One descriptive page title and one `h1` per primary route state.
- Landmarks represent header/navigation/main/footer and complementary regions intentionally.
- Heading order reflects hierarchy and never exists only for styling.
- Lists, tables, definitions, forms, and status messages use native semantics before ARIA.
- Visual order and DOM/reading order match.
- Icon-only controls have durable accessible names.
- Demonstration/synthetic data is identified in visible and accessible text.

## Keyboard and focus

- Every function available to pointer/touch is available to keyboard.
- No positive `tabindex`.
- Focus order follows task order.
- Focus is visible, meets rendered contrast, and is not obscured by sticky/floating elements.
- Route and major state transitions place focus intentionally at the new task heading or result.
- Programmatic scroll never moves focus to a hidden or offscreen element.
- Skip/bypass links are available where repeated navigation would burden the process.
- Focus does not become trapped outside a true modal dialog.

## Board interaction pattern

The 10×10 viewer and organizer boards are composite interactive data grids, not 100 independent page tab stops.

### Common grid behavior

- `Tab` enters the grid once at the current/selected/first meaningful cell.
- Only one cell is in the page tab sequence at a time.
- Arrow keys move one cell in the corresponding direction.
- `Home` / `End` move to first/last cell in the row.
- `Control+Home` / `Control+End` move to first/last board cell.
- Moving focus scrolls the cell into view without losing top/side orientation.
- Row/column headers name top and side digits/teams.
- Cell accessible name includes assignment/open state, coordinate, top/side digits, and winner/correction state when applicable.
- Selected cells expose `aria-selected=true` or equivalent selected semantics.
- Focus, personal selection, current result, and resolved winner remain visually and semantically distinguishable.

### Viewer grid

- `Enter` or `Space` opens/reveals full cell details when needed.
- Escape closes detail and returns focus to the originating cell.
- `Center selected` moves viewport and focus only after explicit activation.
- Read-only status is conveyed; viewer grid never implies editability.

### Organizer assignment grid

- `Space` toggles the focused square’s selection.
- Shift-modified directional selection may extend a range only when implemented consistently and documented onscreen.
- Bulk assignment controls operate on the explicit selected set.
- Edit/details opens a semantic dialog and returns focus to the originating cell.
- Published/correction mode communicates which cells are immutable, OPEN-fillable, or correction-eligible.

The implementation may use a semantic HTML table with managed roving focus or a valid ARIA grid. It must not duplicate conflicting table/grid roles.

## Touch and pointer

- Primary controls and board controls are at least 44×44 CSS pixels.
- Dense grid cells may be smaller visually because the board is a precision instrument, but the selected-detail and pan/zoom controls provide accessible touch interaction.
- No essential action depends on hover.
- Tap, drag/pan, and scroll gestures do not conflict with page scrolling.
- Gesture-only behavior has visible controls or equivalent alternatives.
- Pointer cancellation prevents destructive/action commitment on pointer-down.

## Dialogs, sheets, and menus

Modal dialogs follow WAI-ARIA APG behavior:

- `role=dialog` or appropriate native equivalent
- `aria-modal=true` only when outside content is actually inert
- Visible title connected by `aria-labelledby`
- Description only when concise; structured content remains navigable
- Initial focus selected by task and risk
- Tab/Shift+Tab contained
- Escape closes unless closure would violate an explicitly explained critical process
- Visible close/cancel action
- Focus returns to trigger or logical next workflow element

For irreversible, payment, publication, deletion, and public-correction dialogs, initial focus lands on the least destructive safe action unless a different choice is demonstrably safer.

Menus use actual menu behavior only when they need menu semantics. Ordinary lists of actions may remain buttons/links without fake menu roles.

## Forms and validation

- Every input has a persistent visible label.
- Required/optional state is stated in text.
- Instructions precede the field or are programmatically associated.
- Errors identify the field, explain the problem, and suggest recovery.
- `aria-invalid` and `aria-describedby` connect field errors.
- Submit failure preserves entered values when safe.
- Password managers and `autocomplete` are supported.
- Authentication does not require memory puzzles or transcription-only challenges.
- Checkout, publication, correction, and deletion provide review/confirmation appropriate to consequence.
- Error summaries move focus only after failed submission and link to affected fields where several errors exist.

## Status, live regions, and score updates

Use live regions sparingly.

Announce:

- save failed/recovered/conflicted;
- publication succeeded/failed;
- score authority changed;
- material score/period change when user is on the viewer;
- milestone pending/resolved/corrected;
- notification verification/delivery result.

Do not announce:

- every background poll;
- unchanged freshness timestamps;
- every autosave start/success keystroke cycle;
- decorative animation.

Announcements use concise text and do not interrupt typing unless the event is urgent and destructive.

## Color and contrast

- Normal text meets at least 4.5:1.
- Large text meets at least 3:1.
- Essential UI boundaries, focus, and meaningful graphics meet at least 3:1 against adjacent colors.
- Disabled-state meaning is not expressed by low opacity alone.
- Live, selected, current winner, resolved winner, OPEN, stale, error, and corrected states include text/icon/state semantics.
- Forced-colors mode preserves boundaries, focus, and state.
- Formal `DESIGN.md` lint supplements but does not replace rendered contrast testing.

## Reflow, zoom, and text

- At 320 CSS pixels, the page has no horizontal overflow except inside the intentional board viewport.
- At 400% browser zoom, content reflows without loss of information or function; the board remains in its controlled viewport.
- At 200% text scaling, controls, errors, dialogs, and sticky regions remain usable.
- Long participant, organization, board, team, and correction text wraps or truncates with an accessible full-value path.
- Sticky headers/controls do not obscure focused content.
- Orientation works in portrait and landscape where supported.

## Motion and sensory safety

- `prefers-reduced-motion` removes nonessential transforms, wipes, parallax, ticker movement, score rolls, and cinematic choreography.
- Reduced motion preserves content and state.
- No content flashes above safe thresholds.
- Motion is interruptible and never required to progress.
- Optional brand film is skippable and outside critical product paths.
- Autoplaying sound is prohibited.

## Loading, stale, offline, and recovery

- Loading state does not expose stale data as current.
- Valid last-known score remains visible with stale/offline label and timestamp.
- Errors are specific to the affected object and retain recoverable work.
- Offline/failure states do not remove the exact published board when it remains locally/server available.
- Save conflicts block progression until resolved.
- Public invalid/unpublished/deleted states never render a plausible empty board.

## Content and cognition

- Use canonical Board/Organizer/Viewer/Purchaser/Square/Axis digits/Publish language.
- One concept has one name.
- Phase and status labels use plain language before technical explanation.
- Primary action describes its result.
- Advisories do not masquerade as blockers.
- Error and recovery copy avoids blame.
- Time, price, allowance, score authority, and irreversible consequences are explicit.

## Automated gate

Implementation plan must add accessibility automation without treating it as complete coverage.

Required:

- semantic queries in component tests;
- automated accessibility scan on representative rendered routes/states;
- zero critical/serious violations unless an explicit time-bounded exception is approved;
- focus order/dialog/grid keyboard browser tests;
- rendered target-size and overflow assertions;
- reduced-motion and forced-colors checks where automation is reliable;
- Chromium and WebKit browser projects; add Firefox before whole-app release unless a documented environment blocker remains.

Representative automated states:

- signed-out login/signup errors;
- empty/partial organizer Fill;
- Reconcile advisory items;
- Draw confirmation;
- Preview and Go Live dialogs;
- save conflict/error;
- viewer unpersonalized/personalized;
- stale/offline/manual;
- Find My Squares dialog;
- board keyboard navigation;
- pending/corrected/OPEN/Final record.

## Manual and assistive-technology gate

Before whole-app release:

- VoiceOver + Safari on macOS/iOS-class behavior
- NVDA + Chrome or Firefox on Windows when available
- Keyboard-only complete organizer and viewer processes
- Touch phone process at representative narrow viewport
- 200% text and 400% zoom
- Reduced motion
- Forced colors/high contrast where available

If a platform cannot be tested, disclose the gap. Do not imply coverage.

## Usability evidence

Moderated baseline includes disabled/inclusive-use scenarios where practical:

- keyboard-only organizer assignment;
- low-vision zoom/reflow;
- screen-reader viewer identity and board navigation;
- motor-control touch targets;
- cognitive clarity for score authority and recovery.

Do not recruit token participants solely to claim inclusion. Record actual tasks, barriers, and fixes.

## Per-slice definition of done

A UI slice is not complete until:

- semantics and names are correct;
- keyboard/touch/pointer paths work;
- focus and dialogs recover correctly;
- phone, zoom, long content, loading, error, stale/offline, and success states are checked as applicable;
- automated scans and focused tests pass;
- rendered evidence is inspected;
- new exceptions are documented with owner and removal condition;
- the complete journey remains intact.
