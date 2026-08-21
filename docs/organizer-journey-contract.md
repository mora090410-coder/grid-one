# GridOne Organizer Journey Contract

**Status:** Product and UX planning authority
**Date:** 2026-08-20
**Primary user:** Youth-sports fundraiser organizer running 1–5 boards
**Related:** root `PRODUCT.md`, `wayfinder-gridone-production-quality.md`, `product-metrics-and-evidence.md`

## Product stance

Board setup is a finite trust-building workflow, not a dashboard of equal controls.

The organizer moves through:

`Create Draft → Fill → Reconcile → Draw → Preview → Go Live`

After publication, setup navigation is replaced by:

`Game Day → Final Record`

**Go Live is a one-time publication transition. Game Day is the ongoing operating mode.** They are not the same phase.

The interface presents one dominant artifact and one primary next action at a time. It may expose earlier phases for deliberate correction, but it does not show every control on one page.

## Canonical language

- **Board:** the organizer-owned 10×10 football-squares object.
- **Draft:** an unpublished board. Private, editable, and free to preview.
- **Assignment:** one square’s public display label plus organizer-only metadata.
- **Open square:** a square without an assignment.
- **Reconcile:** an advisory private review checkpoint before the draw. It does not adjudicate or block off-platform money collection.
- **Committed draw:** one valid draft set of top/side axis digits. It may be replaced before publication.
- **Published board:** the public trust record created by Go Live.
- **Correction:** an audited post-publication change to a public fact. It is not ordinary editing.
- **Game Day:** published-board scoring, winner resolution, viewer operation, and recovery.
- **Final record:** the durable published board after Final resolution.

Do not use `pool`, `contest`, or `publish` as synonyms for draft save/create in product-facing code or documentation.

## State model

### 0. Create Draft

**Organizer job:** establish the minimum truthful board identity.

**Required input:**

- Authenticated organizer account
- Board name
- Scheduled NFL game with canonical event id and kickoff
- Blank native 10×10 board by default

**Optional:** import a paper-board image as a recovery path. OCR never replaces organizer review.

**Success:** the server returns a board id and revision, and the organizer enters Fill at the assignment surface.

**Hard failures:** missing auth, name, game, kickoff, board id, valid board shape, or failed server creation.

**Primary action:** `Start assigning`

### 1. Fill

**Organizer job:** assign sold squares quickly and accurately.

**Dominant artifact:** the 10×10 assignment grid.

**Capabilities:**

- Select one, multiple, or dragged ranges of squares
- Apply a purchaser/display label
- Optionally record seller/parent attribution
- Optionally track paid, unpaid, or unknown privately
- Edit one assignment’s details
- Import and correct a paper-board image when needed

**Entry:** unpublished board with no valid committed axes, or organizer deliberately returns before publication.

**Exit to Reconcile:** at least one assigned square exists and the latest required writes are acknowledged by the server.

**Hard blockers:**

- Invalid board shape
- Missing owner/auth
- Draft or assignment save failure
- Unresolved revision conflict

**Advisory issues:** open squares, unpaid/unknown status, missing seller attribution, incomplete payout/rules descriptions.

**Identity readiness issue:** duplicate or ambiguous display labels must be resolved into distinguishable durable participant identities before Draw. They are not grouped with private payment/seller advisories because ambiguity can break Find My Squares.

**Primary action:** `Review board`

Do not force 100 assigned squares. Fundraisers may legitimately publish with open squares.

### 2. Reconcile

**Organizer job:** inspect readiness and make an informed choice before drawing numbers.

**Nature:** required visible checkpoint. Off-platform payment and seller follow-up are advisory rather than hard business gates; data-integrity, save/conflict, scheduled-game, and participant-identity requirements remain hard blockers.

**Dominant artifact:** grouped readiness checklist, not the full editor.

**Checklist:**

- Assigned/open square count
- Unpaid/unknown private follow-up grouped by purchaser label
- Duplicate or ambiguous display labels affecting Find My Squares
- Seller attribution gaps, when used
- Scheduled game and kickoff
- Payout/rules descriptions
- Open-square rule acknowledgement
- Save/conflict status

**Hard exit requirements:**

- Valid 100-cell board shape
- At least one assigned square
- Scheduled game and kickoff present
- Latest required writes saved
- Any open squares explicitly acknowledged
- Every viewer-selectable participant identity is unambiguous; duplicate display text is allowed only when durable identities can be explicitly distinguished in Find My Squares

**Not required:**

- All assigned squares marked paid
- Every seller label present
- Private payment and seller follow-up complete
- All 100 squares assigned

**Primary action:**

- `Continue to draw` when no advisory items remain
- `Continue anyway` when advisory items remain, with the unresolved list visible

Neither action is available while a hard blocker remains.

GridOne does not decide whether off-platform money has been collected and does not block the organizer for forgetting to mark a private payment status.

### 3. Draw

**Organizer job:** securely randomize and commit one set of axis digits after reviewing the board.

**Dominant artifact:** the two axis sequences and their relationship to the board.

**Requirements to enter:**

- Unpublished board
- At least one assigned square
- Open-square acknowledgement when applicable
- No unresolved save/conflict failure

**Behavior:**

1. Generate top and side permutations of 0–9 using cryptographically secure randomness.
2. Show a draft preview.
3. Allow regeneration before commitment.
4. Commit the selected draft draw to the unpublished board.
5. Permit a clearly labeled replacement draw before publication.

**Exit to Preview:**

- Both axes are exact unique permutations of 0–9
- Fixed-axis launch model is active (`isDynamic = false`)
- Per-quarter axes are absent
- Committed axes are acknowledged by the server

**Immutability boundary:** axes become permanently immutable when Go Live succeeds—not at the first draft draw.

**Primary actions:** `Preview draw`, then `Commit draw`

**Pre-publication replacement language:** `Replace draft draw`. Never imply a replacement was public when it was not.

### 4. Preview

**Organizer job:** inspect the exact public experience before creating a public record.

**Dominant artifact:** the real viewer surface at representative phone and desktop sizes.

**Entry:** unpublished board with valid committed axes and scheduled game.

**Always show:**

- `Private preview — sharing is off`
- Board title, matchup, kickoff
- Axis digits and all public labels
- Open squares as OPEN
- Payout/rules descriptions
- Find My Squares behavior when labels exist
- Honest pregame score-authority state
- Core mobile board navigation

**Do not show as operable before publication:** winner notification enrollment, live-score promises, or other activated services that cannot yet function.

**Pre-publish checklist:**

- Latest writes saved
- At least one assignment
- Valid scheduled game/kickoff
- Valid committed axes
- Public names display correctly
- Open-square acknowledgement when applicable
- Public/private data boundary reviewed

**Primary action:** `Review and publish`

### 5. Go Live

**Organizer job:** deliberately create the public viewer record and share link.

**Nature:** one-time state transition, not a persistent editor tab.

**Confirmation must summarize:**

- Board name and matchup
- Kickoff
- Assigned/open count
- Committed axis digits
- Open-square rule
- What becomes public
- What remains private
- Current tier, allowance usage, and upgrade requirement if applicable

**Minimum readiness:** at least one assigned square plus explicit acknowledgement of every remaining open square.

**Server must revalidate atomically:**

- Authenticated owner
- Latest expected revision
- Valid board shape
- At least one assigned square
- Scheduled event and kickoff
- Exact fixed 0–9 axis permutations
- Open-square acknowledgement when needed
- Tier allowance/payment state
- No dynamic/per-quarter axis model

**Success creates:**

- `published_at`
- Immutable public snapshot
- Short share code/viewer URL
- Board activation/allowance consumption
- Published services eligibility

**Success response:** show a stable confirmation surface with copy link, QR code, open viewer, and `Enter game-day controls`. Do not reload blindly before the organizer can understand the result.

**Primary action:** `Publish viewer link`

### 6. Game Day

**Organizer job:** monitor trust, recover scoring, and resolve exceptional conditions.

**Navigation:** setup rail is replaced by a game-day control surface. Fill/Reconcile/Draw/Preview are no longer ordinary editable phases.

**Dominant facts:**

- Matchup, kickoff, game state
- Score authority and freshness
- Current score and period
- Viewer-link health
- Current/resolved milestone state
- Notification delivery issues

**Capabilities:**

- Copy/open viewer link
- Observe automatic score authority
- Switch deliberately to manual authority
- Publish organizer-entered quarter scoring
- Return deliberately to automatic authority
- Assign squares that were OPEN at publication before kickoff
- Correct public labels through audited correction
- Correct resolved milestones through audited correction

**Hard integrity conditions:**

- Older automatic data never overwrites newer/manual authority
- Milestones resolve idempotently
- Viewer remains available
- Public corrections are auditable
- Axes and scheduled game are immutable

**Primary action depends on state:** resolve score-authority failure, review delivery issue, or open viewer. There is no generic `Save` or `Edit board` action.

### 7. Final Record

**Organizer job:** confirm the completed public record and understand any unresolved operational issue.

**Entry:** canonical game state is Final and Q1/Q2/Q3/Final have durable resolutions.

**Show:**

- Final score and authority
- Resolved winners, including OPEN outcomes
- Notification delivery state
- Public correction history
- Viewer link
- Archive/share actions

**North-star qualification:** this board counts as a Successful Game-Day Board Run only when it satisfies `docs/product-metrics-and-evidence.md`.

## Open-square contract

When a milestone lands on an open square:

- Resolve it as **`Open square — see board rules`**.
- Do not invent a purchaser.
- Do not roll the result to another score or square.
- Do not send a winner email.
- Preserve the score digits, square coordinate, milestone, and timestamp as the durable result.
- GridOne does not adjudicate what the organizer does with any off-platform money.

## Post-publication correction boundary

Publication creates a public trust record.

### Always private/editable

- Paid/unpaid/unknown status
- Seller/parent attribution
- Contact and notification-delivery administration

Private metadata changes never appear in public correction history.

### Allowed before kickoff

- Assign a square that was OPEN at publication

Server enforcement:

- Cell was empty in the published record
- Kickoff has not occurred
- Expected revision matches
- No axis or scheduled-game changes
- Existing sold assignments remain untouched

### Allowed as audited public correction

A sold-square label may be corrected after publication only through a correction flow requiring:

- Square coordinate/index
- Before value
- After value
- Required reason
- Organizer identity
- Timestamp
- Expected version/revision

Viewers can see the before/after value, timestamp, and reason. The interface labels this a correction, never an edit.

Milestone corrections use the same public-trust principles and notify affected verified recipients appropriately.

### Never allowed after publication

- Axis digit changes
- Scheduled-game changes through ordinary organizer UI
- Silent sold-square overwrite
- Silent milestone recomputation
- Reordering the grid
- Stale automatic score overwriting manual/newer authority

Legacy incident recovery is an internal/admin process, not an organizer feature.

## Draft persistence and recovery contract

### Save states

- `clean`: local state matches the acknowledged server revision
- `dirty`: local changes await sending
- `saving`: a write is in flight
- `save_failed`: the write failed and can be retried
- `conflicted`: the server revision changed elsewhere; organizer decision required
- `recovered`: a newer local recovery draft is being reviewed

The product must not display `Saved` while any structural, assignment, or metadata write is failed.

### Autosave

- Debounce unpublished draft edits
- Serialize revisioned writes
- Keep one authoritative expected revision
- Flush before phase progression, navigation, logout, preview confirmation, and publication
- Never publish while dirty, saving, failed, or conflicted

### Conflict behavior

GridOne is one-organizer-per-board at launch. A conflict therefore means another tab/session or stale state—not collaborative editing.

On conflict:

1. Stop autosave.
2. Show `This board changed in another session.`
3. Offer `Reload latest board`.
4. Offer a local-change recovery path only when consequences can be shown safely.
5. Never silently update the revision and overwrite the newer server state.

### Local recovery

Retain an expiring local recovery snapshot for dirty/failed authenticated drafts:

- Keyed by board id
- Includes last known server revision and local timestamp
- Excludes emails, notification tokens, and unnecessary private contact data
- Offered after reload when newer than the last acknowledged server state
- Removed after successful save/publication or expiration

Retention duration is set during implementation; seven days is the initial recommendation.

## Interaction contract

- One vertical scroll owner per surface
- Native scrolling on organizer routes
- Sticky organizer context and save status
- Typed phase destinations with deterministic focus and announcement
- Tab/phase changes intentionally reset or preserve scroll
- At least 44×44 CSS-pixel targets
- Keyboard/touch/pointer parity for assignment, draw, preview, dialogs, and corrections
- No hidden phase controls above the primary artifact
- Destructive and public-trust actions use semantic dialogs with focus return

## Architecture seams

The eventual `src/features/organizer/` structure should follow the state machine rather than visual sections:

```text
src/features/organizer/
  lifecycle/       phase model, readiness checks, navigation
  draft/           create/load/save, revision, autosave, recovery
  assignment/      grid selection, bulk assignment, square details
  reconcile/       readiness checklist and private follow-up
  draw/            secure draw, draft commitment, validation
  preview/         exact viewer preview and publish checklist
  publish/         atomic Go Live transition, allowance/checkout
  game-day/        score authority, delivery health, open-square fill
  corrections/     public label and milestone correction flows
```

Shared UI primitives remain global only when they are genuinely reused outside the organizer feature. External clients remain separated into browser and server adapters.

### Vocabulary repairs required during implementation

- `publishPool` → `createDraft`
- `handlePublish` when saving → `saveDraft`
- `handleBoardLifecycleAction` → explicit `publishBoard` or `copyViewerLink`
- Keep `publishManualScore` and `publishCorrection` only where they create public score/correction records

## Verification matrix

Each phase requires:

- Domain-state unit tests for entry, exit, blockers, and advisory issues
- Component tests for primary action and recovery
- Browser tests at desktop and phone widths
- Keyboard, focus, scroll, reduced-motion, and 200% zoom checks
- Save ordering and revision-conflict tests
- Server contract tests for publish readiness and immutability
- Rendered inspection of empty, partial, complete, failed-save, conflict, open-square, published, stale-score, manual-score, correction, and Final states

Whole-journey acceptance path:

`Create draft → assign at least one square → reconcile/acknowledge open squares → secure draw → preview → publish → open viewer → operate score authority → resolve Q1/Q2/Q3/Final → verify final record`

No implementation slice is complete if it makes its own phase look good while breaking this path.
