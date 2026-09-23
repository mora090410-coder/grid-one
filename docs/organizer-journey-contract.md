# GridOne Organizer Journey Contract

**Status:** Product, design, and release authority for the organizer workspace
**Implementation:** `src/features/organizer/`
**Phase authority:** `src/features/organizer/lifecycle/organizerLifecycle.ts`
**Browser evidence:** `playwright-tests/organizer.spec.ts`, `playwright-tests/accessibility-contract.spec.ts`

Control names document the current accessible interface and should agree with implementation and tests. They are not immutable prose: intentionally adopted alternatives require approved scope and coordinated contract/test updates, preserving clear consequences and accessible naming.

## Product stance

The organizer is a volunteer, not an administrator. The current workspace is one page rather than a wizard, with the board visible and the current phase and next action in a status island. This is a production mechanism, not a ban on alternative journeys. Explore improvements by organizer success, clarity, recovery, and trust; keep unchanged production controls until an approved, reversible implementation coordinates contracts, tests, and rendered accessibility/integrity evidence. Privacy, payment independence, publication, and score-authority boundaries remain binding.

Building, editing, previewing, and redrawing are free and reversible. **Publication is the trust boundary.** Before it, nothing is public and almost everything is editable. After it, the viewer record is stable and change happens only through an audited, viewer-visible correction.

## Composition

`src/features/organizer/workspace/OrganizerWorkspace.tsx` renders, on a `<Base kind="cream">` ground:

| Element | Component | Accessible name |
|---|---|---|
| Header | `WorkspaceHeader` | `Board name` field, `Change game`, save state, `Log out` |
| Status island | `OrganizerIsland` | region `Organizer status` |
| Board | `BoardEditor` | `main` named `{board title} workspace` |
| Block assignment | `RangeAssignBar` | group `Assign selected squares` |
| One square | `SquareSheet` | dialog `Square {n}` |
| Draw | `DrawControl` | inline group; open-square confirmation |
| Reconcile | `ReconcileCard` | regions `Before you can publish` and `Private follow-up` |
| Payouts | `PayoutRulesCard` | `Payout rules`, `Board rules` |
| Tools | `BoardToolsCard` | `Board tools` |
| Seller links | `sellers/SellerLinksCard` | region `Send seller links`; `Get seller links`, list `Seller links`, `Share {label}’s link`, `New link for {label}`, `Copy all links`, `Update for new sellers` |
| Preview → publish | `PreviewSheet` → `PublishSheet` → `PublishedSheet` | dialogs `Private preview — sharing is off`, `Publish viewer link`, `Published` |
| Upgrade | `UpgradeSheet` | dialog `Choose a plan` |
| Game day | `gameday/SharePanel`, `ScoreAuthorityCard`, `CorrectionsCard`, `DeliveryIssuesCard`, `FinalRecordCard` | `Public board`, `Score authority`, `Correct a published result`, `Review delivery issue`, `Final record` |

Board state lives in `useWorkspaceDraft`. Selection lives in `selection.ts`. The draw lives in `secureDraw.ts`. Publication lives in `publishBoard.ts`.

## Canonical language

Board, Organizer, Viewer, Purchaser, Participant, Square, Axis digits, Publish are current terms. Use audience-familiar words consistently and literally, not a universal blacklist. Technical terms may clarify authority or state; no wording may imply betting, funds custody, payout processing, or unimplemented capabilities.

Assignment state is `assigned` or `OPEN`. Payment state is `Not asked yet`, `Unpaid`, or `Paid` — and it is always private.

## State model

`evaluateOrganizerLifecycle({ board, save, publishIntent })` returns the phase, the one primary action, `hardBlockers`, `advisories`, `canEnterDraw`, and `canPublish`. The island renders the primary action; the reconcile card renders the blockers and advisories. Nothing else decides the phase.

### 0. Create Draft

Name the board and attach the scheduled NFL game. The header's `Board name` field commits on `Enter` or blur; `Change game` opens the scheduled-game picker and warns that **Changing the game clears any score state on this board.**

Hard blockers: `missing_owner`, `missing_board_identity`, `missing_scheduled_game`, `invalid_board_shape`.

### 1. Fill

Primary action while nothing is assigned: **Fill the board** — it scrolls to the board, it does not open a step.

One square: activate `Square {n}, unassigned` (or `Square {n}, assigned to {name}`) to open the `Square {n}` dialog. Initial focus lands on `Name on the board`. Existing responsibility is shown as read-only text; a `Payment` radiogroup of `Not asked yet` / `Unpaid` / `Paid`, defaulting to `Not asked yet`. `Save` closes; `Save and next` commits and moves to the next square. Arrow keys move between squares from the dialog.

A block of squares: **`Select squares`** toggles selection mode and becomes **`Done selecting`**, with `aria-pressed` reflecting the state. Only in selection mode do the squares expose `aria-pressed`. Click, `Space`, or a drag across a block selects; `Shift` extends a rectangle from the last anchor. The `Assign selected squares` group announces `{n} selected` politely and carries `Name for these squares`, the `Payment` radiogroup, `Apply to {n}`, and `Clear selection`. `Escape` on a square or in the bar leaves selection mode and returns focus to the toggle. On a published board only OPEN squares accept selection.

The editor does not offer sequential paste-to-fill. Selecting a square keeps focus and scroll on the grid. The allocation editor sits beside the grid on desktop and follows it on phone; `Name {n} selected squares` explicitly moves to the editor. `Board tools` holds `Clear all names` behind a `Confirm clear`.

### 2. Reconcile

`ReconcileCard` splits what stops publication from what is merely worth a look. It never merges them.

**`Before you can publish`** — hard blockers, each with its own sentence: `Add a board title before publishing.`, `Choose the scheduled game before publishing.`, `Draw one complete set of numbers before publishing.`, `Confirm that the remaining OPEN squares should stay OPEN.`, `Save the latest changes before publishing.`, `Wait for the board to finish saving.`, `The latest changes did not save. Reload or try again.`, `Review and save the recovered draft before publishing.`, `The board owner could not be verified. Reload and try again.` When ready and there are none: `Ready for preview.`

**`Private follow-up`** — advisories, never blockers: `OPEN squares remain. You can publish if you are okay leaving them OPEN.`, `Some private payment notes still need follow-up.`. When there are none: `No private follow-up.`

Off-platform payment status never gates progression.

### 3. Draw

Primary action: **`Prepare to publish`**, enabled only when `canEnterDraw`. If squares are still OPEN, a confirmation group named `{n} squares are open. Draw anyway?` appears, states that **Open squares stay open**, and offers `Keep assigning` (which takes focus) and `Draw with {n} OPEN`.

The draw itself is `crypto.getRandomValues` in `secureDraw.ts`: one permutation of 0–9 per axis, each digit exactly once (`isExactAxis`). The result appears over the axes as a `Draft draw` with `Draw again` and `Use numbers and continue`; `Cancel` discards it. Accepting the draw saves its numbers and opens the private preview directly. The island shows `Numbers drawn`; `Preview and publish` reopens the preview when allowed. `Replace draft draw` remains secondary while the board is unpublished.

`Game numbers` (`NumberSetsEditor`) offers `One set for the whole game` or `New numbers each quarter`. Switching when numbers exist asks first (`Keep it` / `Switch`) and never copies or redraws. With new numbers each quarter, the draw produces four independent sets. The `Quarter numbers` tabs (`1st`, `2nd`, `3rd`, `Final`) switch which set the board and the draft draw show. Digit inputs appear only for boards read from a photo. Publication requires ten unique digits in every set.

### 4. Preview

Primary action once the axes are committed: **`Preview and publish`** (or **`Review game numbers`** for a shared board). It opens the dialog `Private preview — sharing is off`, which renders the real `ViewerShell` — not a mock — so the organizer sees exactly what a viewer will see and exactly what stays private. Its forward action is **`Review and publish`**, kept in a fixed footer outside the preview scroll area and disabled whenever a hard blocker stands (a save conflict included).

### 5. Go Live

`Review and publish` opens the modal `Publish viewer link` (`aria-modal="true"`). Initial focus is on `Cancel` — the least destructive action. The dialog summarizes, in this order: `Board name`, `Matchup`, `Kickoff`, `Squares` as `{n} assigned · {n} OPEN`, `Top axis`, `Side axis`, `What becomes public`, `What remains private`, and the entitlement line `{n} of {n} published this season · {tier}`. `Open squares stay OPEN on the shared board.` when any remain.

The confirming button is **`Publish viewer link`**. Publication is atomic (`010_atomic_board_publish.sql`) and mints the share code. If the tier allowance is spent, `UpgradeSheet` (`Choose a plan`) offers `Game Day · up to 5 boards` and `Organization · up to 50 boards`, with `Organization name` where it applies, and `Not now`.

Success opens the `Published` sheet: `Copy link`, `Open public board`, the QR code, and `Manage board`. The island's primary action becomes `Copy link`.

### 6. Game Day

- `Public board` (`SharePanel`) — the share URL, `Copy link`, `Open public board`.
- `Score authority` (`ScoreAuthorityCard`) — the heading reads `Automatic scoring authority` or `Manual scoring authority`, with the source, detail, and checked time beneath. `Live Scoring` offers `Auto` and `Manual`. In manual mode the organizer enters `Game Status`, `Current Period`, and per-quarter `Top score` / `Side score`, then **`Publish manual score`**. Manual becomes canonical until the organizer chooses `Auto` again; a late or stale automatic result can never overwrite it.
- `Correct a published result` (`CorrectionsCard`) — `Result to correct` (`Select a result`), the corrected `Top score` and `Side score`, and `Why this changed (shown publicly)`. The action is **`Publish correction and email both people`**. Corrections are audited and viewer-visible.
- `Review delivery issue` (`DeliveryIssuesCard`) — surfaces failed `Winner email`, `Correction email (current winner)`, and `Correction email (previous winner)` sends.

### 7. Final Record

`Final record` (`FinalRecordCard`) lists the resolved Q1/Q2/Q3/Final results, `Open square` where a milestone landed on an unassigned square, and states `This board is locked as the Final record.`

## Open-square contract

- A board needs at least one assignment before it can be published.
- Remaining OPEN squares require the explicit acknowledgement `Confirm that the remaining OPEN squares should stay OPEN.`
- An OPEN milestone resolves as an open-square result. It sends no winner email, and it never rolls over to another square.
- After publication, OPEN squares may still be filled (`022_open_squares.sql`); sold squares may not be reassigned.

## Post-publication correction boundary

**Always private and editable:** seller attribution, payment status, private notes, internal board metadata.

**Allowed before kickoff:** filling OPEN squares, payout descriptions and board rules.

**Allowed as an audited public correction:** a published square's public label (`renamePublishedSquare`, `024_published_square_rename.sql`) and a resolved milestone's score (`functions/api/pools/[id]/milestones/[milestone]/correct.ts`). Each records the before value, the after value, the timestamp, and the organizer's stated reason, shows the change to viewers, and emails both the previous and the current winner.

**Never allowed after publication:** redrawing or editing the axis digits, changing the scheduled game, reassigning a sold square to a different person without a correction, deleting the audit history, or silently editing a resolved result.

## Draft persistence and recovery

Save states, from `draft/draftSaveModel.ts`: `clean` (`Saved`), `dirty` (`Unsaved changes`), `saving` (`Saving…`), `save_failed` (`Save failed`, with `Retry`), `conflicted`.

- Current autosave commits on field blur and explicit commit, not per keystroke. An approved alternative must preserve revisions, recoverable input, conflict handling, and publication blockers.
- A revision mismatch produces the alert **`This board changed in another session.`** with **`Reload latest board`**. The conflict is a hard blocker: `Review and publish` is disabled until it is resolved, and the organizer's in-progress input is preserved through the reload prompt.
- A recovered local draft announces `Recovered draft · review before publishing` and blocks publication until reviewed and saved.

## Interaction contract

- The board is one composite grid, not 100 tab stops. `Tab` enters once; arrow keys move; `Space` toggles selection in selection mode.
- Every square has a durable accessible name: `Square {n}, unassigned`, `Square {n}, assigned to {name}`.
- Primary controls are at least 44×44 CSS pixels.
- Sheets are real dialogs: labelled, focus-contained, `Escape`-closable, and they return focus to their trigger.
- Advisories never look like blockers, and blockers never hide inside a paragraph.
- Every irreversible action names its result in the button, and its dialog opens on the safe choice.

## Architecture seams

- Phase, blockers, and advisories: `lifecycle/organizerLifecycle.ts` — pure, no React.
- Save semantics: `draft/draftSaveModel.ts` and `workspace/useWorkspaceDraft.ts`.
- Selection algebra: `workspace/selection.ts`.
- Randomness: `workspace/secureDraw.ts`.
- Publication: `workspace/publishBoard.ts` → `POST /api/pools/:id/publish`.
- Private metadata: `workspace/entryMetaService.ts`.
- Manual scoring: `game-day/manualScoringModel.ts` → `POST /api/pools/:id/score/manual`.
- Corrections: `services/corrections/milestoneCorrectionService.ts`.

Presentation components hold no business rules. Every rule above is testable without a browser, and is.

## Verification

| Behavior | Test |
|---|---|
| Phase, blockers, advisories | `tests/organizerLifecycle.test.ts` |
| Save, conflict, recovery | `tests/draftSaveModel.test.ts`, `tests/organizerPersistence.test.tsx` |
| Square and block assignment | `tests/organizer/` |
| Draw exactness | `tests/numberDraw.test.ts` |
| Publication and entitlement | `tests/publishEntitlementEndpoint.test.ts`, `tests/postgresPricingTiers.integration.test.ts` |
| Open squares | `tests/openSquaresOrganizerContract.test.ts`, `tests/openSquaresEndpoint.test.ts` |
| Manual scoring | `tests/manualScoringMode.test.ts`, `tests/manualScoringPanel.test.tsx`, `tests/manualScoringUiState.test.ts` |
| Corrections | `tests/milestoneConfirmation.test.ts`, `tests/publishedSquareRename.integration.test.ts` |
| Control names, focus, target size | `playwright-tests/accessibility-contract.spec.ts` |
| Whole journey | `playwright-tests/organizer.spec.ts` |


## Pre-game selling and public family allocation (September 4)

Sharing and finalization are separate. The permanent IDs 1–100 identify positions before and after the 0–9 game axes are drawn. `Select squares` permits arbitrary selections including diagonals. One `Allocate squares` editor supplies `Name for these squares`, payment status, and `Apply to {n}`. Initial allocation sets the public displayed name and responsible person or family. Later name edits preserve existing responsibility, including pre-existing allocation-only squares. The single-square editor shows responsibility without another buyer/family mode. Historical private seller metadata is retained and never copied into public allocation. Clearing displayed names preserves responsibility. Allocated names count as filled; payment status remains independent and never blocks publication.

The visible selling summary contains secondary `Share while selling` before sharing, or `Copy link` and `Open shared board` afterward. The next draw/preview action is visible without expanding Organizer status. `My boards` returns to `/dashboard` throughout. Dirty, failed, or conflicted saves block first sharing. `Share while selling` confirms public names and allocations, private payment/contact notes, and use of one seasonal allowance. `Enable shared board` calls the revision-checked owner endpoint. All 100 squares may be unsold when sharing; finalization still requires a buyer and explicit OPEN acknowledgment.

For already shared boards, `Preview final board` leads to `Review and lock numbers` then `Lock game numbers`. Participants do not see draft axes; the same URL transitions only after final publication. `Manage board` closes success into the organizer workspace. Existing finalized-board edit/correction boundaries remain intact.

## Approved optional family workflow

`Send seller links` sits under the share panel on unpublished boards with sellers. Before sharing it says **Share your board first. Then every seller gets their own link.** After sharing, one tap creates a public link per seller; each row shows `{n} squares · {n} not sold yet` (unsold = still showing the seller's name). Claiming through those links ends when the numbers lock.

The setup page includes collapsed **Help people join** and **Send families their squares** sections. Public purpose/price/instructions are explicitly labelled; private contacts are never prefilled. **Availability** remains independent of names and payment. Name entry contains no availability picker and preserves existing availability. The board toolbar’s **Offer squares as available** enters selection mode; **Review {n} selected squares** moves focus to the separate availability controls. Organizers can offer selected squares, mark them unavailable, or remove their explicit availability label. These actions only change availability and do not enable sharing. Published boards expose no availability editing.

**Create private family link** rotates a seven-day scoped link. **Revoke family links** ends that family's access. Only a clean saved draft can perform these actions. **Change responsible family** shows selected squares and previous/new families and requires payment-note acknowledgement; names remain unchanged, old payment notes are archived/reset and previous affected links stop working. Finalized boards never show these controls.

**Send families their squares** explains the handoff before the organizer creates a link: choose the responsible family, review its assigned square numbers, then copy the private link and send it directly by text or email. The private workspace's **Share your squares** action creates or retrieves a separate public claim link where guest sharing is enabled. The family never needs to re-enter its assignment. Copying and native sharing are explicit actions; neither sends a message automatically. Public link creation preserves saved names and availability, and unsaved family edits disable creation until saved. The participant cannot reactivate a disabled or expired organizer link. Buyer square collections contain only the invite's scope, including scattered original square numbers; ordinary viewer boards retain their full-board presentation.

The family editor exposes only its assigned names and availability. Save failures preserve input. Revision conflict disables resubmission until a deliberate reload, with unsaved-change confirmation.


## Organizer island and private Payments (September 10)

The current centered organizer island reserves its compact height above the workspace; deliberate expansion is bounded and dismissible. Compact text prioritizes save failures/conflicts, then the organizer's open payment task, then lifecycle/game state. Closing Payments restores lifecycle/game status. An explicit touch hold may expand it without interfering with scrolling; click/tap and keyboard remain equivalent. Meaningful changes are politely announced. Paid/Unpaid/Not asked yet counts are square counts, never people or balances. The viewer island is unchanged.

`Payments` remains a visible workspace action before and after publication. Its private full-height sheet groups by exact responsible allocation, falling back to exact joint displayed names only for legacy unallocated squares. Allocation-only squares count; entirely unallocated unnamed squares do not. Search matches responsibility, displayed names, and permanent square numbers. Collapsed person rows show full-group paid, unpaid and not-asked counts and an explicit **Mark all {n} paid** or **Mark remaining {n} paid** action. This updates all of the person’s not-yet-paid squares, with an explicit scope explanation if search/filter hides some of them. It never rewrites names, responsibility or other private metadata. Group-action retries require unchanged group scope and status. **Show squares** expands individual records. Filters never imply selection. `Select {n} shown squares for {name}` selects only the matching group rows; individual checkboxes and explicit status actions update selected squares. Mixed groups show separate counts. Unknown payment status is `Not asked yet`, never unpaid.

Payment-only writes preserve all other private metadata and public board fields. Pending writes serialize against family changes; UI success requires returned receipts for every requested square. Failure preserves the intended selection/status and offers retry; a changed selection invalidates a pending retry. Public/family projections never receive payment statuses. `View on board` closes the sheet, scrolls to and focuses the chosen square without opening its editor. Name entry and assignment shortcuts retain their existing behavior.

## Replacement organizer notch — September 16

OrganizerIsland now uses shared ContextNotch in the reserved top strip. Board / Payments / Share select one attached detail before publication; Game / Results / Share replace those modules after publication. Assignment ring means assigned squares out of 100, never payment completion. Payments details retain paid/unpaid/not-asked square counts and the private-note disclosure, opening the existing sheet via Open payments. After publication Payments remains a workspace action, not a game-day module.

Existing organizerIslandModel issue priority and lifecycle labels/disabled callbacks remain authoritative. Before publication the lifecycle primary action remains below the selected detail. After publication only actionable score or delivery issues retain a global review action; Copy link and Open public board belong inside Share. Share never publishes, enables sharing, or copies automatically. Game shows the score, period and authority inline with an explicit score-authority action. Results shows all four milestone summaries inline; published records expose an explicitly labeled Correct a published result action targeting the existing correction surface. Empty and pending results never imply a winner. Hover preview is now supported only on fine hover pointers, with explicit pin/unpin/close; optional cancellable touch hold remains. Existing confirmations, entitlement gates and private metadata boundaries are unchanged.


## Guest claim links (local implementation; default off, legacy)

> **Superseded 2026-09-23 by Seller links.** Organizers and families no longer create these links in the app. Links already posted still open at `/p/...` and keep working until the numbers lock; the tables, endpoints and occupancy guards below stay in place so nothing already claimed is lost.

On an already shared, unfinalized board, **Guest claim links (optional)** precedes **Send families their squares**. The organizer explicitly reviews available square IDs, existing public names, public seller label, per-credential limit, expiry, and optional claimant-facing payment instructions. Creating a link acknowledges that claims replace the reviewed placeholder names while retaining responsibility and private payment records. Copy is stable; regeneration is a distinct confirmed revocation of the old invitation. Native sharing opens a share sheet for the user to complete.

The list shows each link's available, held and claimed counts, anonymous hold countdowns, and source-labelled guest claims. Manage updates settings, Disable releases pending holds, and Regenerate reactivates/rotates the same invitation. Release claim and Re-issue claim code require explicit confirmation. Code re-issue revokes earlier private access. Payment fields are never prefilled from private records; following a link never changes payment status.

Every mutation uses the exact revision returned by the existing save/flush flow. Background summary refresh cannot overwrite unsaved organizer board edits or silently advance their approval revision. Conflicts keep those edits and offer an explicit reload. Publication with active holds fails with an explanation and directs the organizer to wait or explicitly cancel holds. Reassignment of active guest claims requires their explicit release first. Private draft draws remain compatible; final publication ends guest edits.
