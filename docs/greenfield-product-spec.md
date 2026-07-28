# GridOne Greenfield Product Specification

**Status:** Draft for product confirmation
**Launch target:** Friday, July 31, 2026 public soft launch
**Launch market:** NFL football squares for youth-sports and community fundraisers

## 1. Product definition

GridOne replaces the full paper football-squares workflow: building the 10×10 board, assigning sold squares, drawing axis numbers, sharing one trustworthy viewer link, following the live score, exploring the next scoring possibilities, and notifying quarter winners.

GridOne is a tracking and communication tool. Organizers may record purchaser names, seller attribution, and paid/unpaid status, but GridOne never collects square money, holds a pot, determines whether a fundraiser is lawful, or pays winners.

### Product-specific promise

**Build it once. Share one link. Let the board run game day.**

The organizer should no longer recreate boards in Excel, circulate screenshots, manually cross-reference score digits, answer repeated “who wins?” questions, or notify every winner by hand.

### Memorable mechanism

The live current-quarter scenario engine answers the question participants naturally ask:

> “I am not winning now—what needs to happen next for me to win?”

It shows the likely next NFL scoring events for either team, the resulting score digits, and the square or participant that would become the current-quarter winner.

## 2. People and permissions

### Organizer

- Creates a Supabase-authenticated account.
- Owns and administers the board.
- Enters purchaser/display names and privately tracks paid/unpaid status.
- May record which team parent/player was responsible for selling a square.
- Randomizes and locks the top and side digits after sales are complete.
- Publishes one read-only board link.
- Uses automatic scoring by default and can switch to an authoritative manual override.
- May correct board data and participant details with an auditable update history.

There is one organizer authority per board at launch. Delegated sellers and co-admins are later capabilities.

### Purchaser/viewer

- Opens the shared board without creating an account.
- Sees a privacy-reduced board appropriate for anyone possessing the link.
- Finds their own squares by selecting/searching their display name.
- Sees the live score, current winner, completed quarter winners, and current-quarter next-score scenarios.
- May enter and verify an email address to opt into winner notifications.
- Has no ability to claim, sell, rename, edit, randomize, score, or administer squares.

### System

- Keeps private organizer, payment, paid-status, and contact data out of public queries.
- Retrieves at most one external score refresh per active board freshness window.
- Validates and persists a canonical score snapshot.
- Broadcasts board and score changes to open viewers.
- Resolves each quarter exactly once and sends idempotent winner notifications.
- Shows its source, update time, freshness, and whether the score is automatic or manually overridden.

## 3. Core organizer journey

### A. Create the board

1. Sign in or create an organizer account.
2. Name the board and choose the NFL matchup/date.
3. Confirm the traditional launch format: one fixed set of top digits and one fixed set of side digits for all four quarters and Final.
4. Optionally record payout descriptions or amounts for reference. These are display-only facts; GridOne never handles the money.
5. Arrive at a usable blank 10×10 board immediately.

Photo/PDF import remains a useful recovery path for an existing paper board, but creating the board natively inside GridOne is the primary experience.

### B. Fill and reconcile the board

The organizer can:

- Enter one purchaser/display name across one or many squares.
- Batch-assign a name to selected squares.
- Optionally record a private seller/parent label behind each assignment.
- Mark assignments paid, unpaid, or unknown.
- Filter by purchaser, seller, payment state, or unassigned square.
- See sold, assigned, paid, and remaining counts.
- Correct mistakes without losing unrelated board work.

Board cells use a normalized participant/assignment model rather than storing contact and payment data inside a public board document.

### C. Draw and lock numbers

- GridOne blocks accidental number publication while the board is incomplete unless the organizer explicitly overrides.
- The organizer previews a cryptographically secure random draw of 0–9 for both axes.
- Committing the draw records when and by whom it occurred.
- Once published, axis digits are locked by default so participants can trust the board.
- Any post-publication reset requires an explicit destructive confirmation and produces a visible “numbers redrawn” audit event.

### D. Publish and share

- Building and editing are free.
- The 2026 introductory season pass costs **$4.99 once** and activates up to 20 boards for that organizer.
- Repeat purchases do not stack additional 2026 allowances.
- Unlocking creates a short, human-friendly share URL backed by an internal UUID.
- The organizer previews exactly what viewers will see before publishing.
- Sharing provides copy-link and QR-code actions.

“100 viewers” is treated as a tested capacity target, not a hard gate or a promise that ejects the 101st viewer.

## 4. Viewer game-day journey

### A. Arrive and orient

Within the first screen, a viewer should understand:

- Which board and matchup this is.
- Whether the game is upcoming, live, stale, manually scored, offline, or Final.
- The current score and period.
- Who is winning now.
- How to find their squares.

Invalid, unavailable, locked, or unpublished links never render a plausible empty board.

### B. Find my squares

- Search/select a privacy-safe display name.
- Highlight every matching square.
- Show a compact personal summary: number of squares, current result, completed wins, and notification status.
- On mobile, use initials/shortened display names in cells and disclose the full organizer-entered display name through a deliberate tap/search interaction.

### C. Explore current-quarter scenarios

- Focus exclusively on the current quarter because the useful answer changes with every score.
- Show the standard immediate NFL scoring outcomes for either team: safety (+2), field goal (+3), touchdown without conversion (+6), touchdown plus kick (+7), and touchdown plus two-point conversion (+8).
- For every scenario, show the resulting last digits and resulting current-quarter winner.
- When a viewer selected their name, clearly mark which scenarios make them the winner.
- Highlight the corresponding board cell on tap, keyboard focus, or pointer hover.
- Never imply a scenario is a probability, betting recommendation, or prediction.

### D. Opt into winner email

- No viewer account is required.
- The viewer selects their board identity, enters an email address, and confirms ownership through a verification email.
- Email and subscription state remain private.
- The verified subscriber receives one email when their assignment wins Q1, Q2, Q3, or Final.
- A purchaser with multiple winning squares receives one clear notification per resolved milestone, not duplicate messages.
- Every email identifies the board, matchup, resolved score, winning square, and viewer link, and includes unsubscribe.
- SMS is explicitly deferred.

## 5. Scoring and winner authority

### Automatic beta

- Gemini with Google Search grounding remains the launch provider because it has worked in the real Super Bowl workflow and does not require a paid sports feed.
- Gemini runs only on the server. No reusable provider key appears in browser JavaScript.
- Multiple viewers collapse into at most one provider request per board freshness window.
- The normalized response must include matchup identity, score, quarter-by-quarter scoring, period/state, source time, retrieval time, and provenance.
- Invalid, contradictory, wrong-matchup, or implausibly old responses are rejected instead of rendered.
- Polling stops after Final and slows or stops when the board is not in its active game window.

### Manual override

- The organizer may switch to manual scoring at any time.
- Manual mode is the canonical source until the organizer deliberately returns to automatic mode.
- A late automatic response can never overwrite a manual score or a newer snapshot.
- Manual quarter entry records scoring by quarter and explicit game state.

### Quarter resolution

- Q1, Q2, and Q3 resolve when the game advances beyond that quarter.
- Final resolves only when game state is Final, including overtime.
- Resolution stores the score digits, winning square, assignment, and timestamp.
- A resolution and its notification delivery are idempotent.
- Corrections are auditable and never silently send duplicate notifications.

## 6. States the product must design

- First board / no boards
- Blank, partially assigned, fully assigned
- Numbers undrawn, previewed, locked, or explicitly redrawn
- Draft, unlocked, published, archived
- Upcoming game with no score
- Automatic beta refreshing, fresh, stale, rejected, rate-limited, or offline
- Manual override active
- Live Q1, halftime, Q2, Q3, Q4, overtime, Final
- Viewer name found, multiple matches, or not found
- Notification unverified, verified, unsubscribed, bounced, or delivery failed
- Payment required, checkout processing, activated, allowance exhausted, or entitlement recovery needed
- Invalid, unavailable, unpublished, or deleted share link
- Narrow phone, large text, keyboard-only, reduced-motion, and unreliable network

## 7. Information and privacy boundaries

### Public through the board link

- Board title and matchup
- Published axis digits and privacy-reduced display names
- Payout descriptions the organizer chose to publish
- Canonical score snapshot, winner history, and current-quarter scenarios

### Organizer-only

- Owner identity
- Purchaser email
- Notification verification/delivery state
- Seller/parent attribution
- Paid/unpaid status
- Draft/unpublished board data
- Stripe customer/session/payment identifiers
- Audit history and administrative controls

### System-only

- Supabase service credentials
- Gemini and email-provider credentials
- Provider raw responses
- Webhook secrets
- Rate-limit and delivery internals

## 8. Durable visual and interaction direction

The approved **Game-Day Horizon** world is the visual authority:

- Named lifecycle/game phases change the page-scale light field while the product artifact remains spatially stable.
- Composition C, **Split Stage**, binds calm score/personal context to the exact board across one continuous horizon.
- Organizer and viewer remain separate authority surfaces: organizers see Fill → Reconcile → Draw → Preview → Go Live; viewers see score authority → My Squares → current winner/scenarios → board → resolved winners.
- The board and score behavior—not marketing prose—provide the proof.
- Cardinal carries identity and tension; live green means only that an NFL game is actively in progress; gold means committed or settled.
- Phase cueing, score rolls, and one decisive winner wipe provide motion without delaying tasks.
- The mobile viewer uses clear panning/zooming, sticky axes, reset/orientation controls, and deliberate participant detail.
- Reduced motion uses discrete named state cuts and always retains complete information.
- The generated Composition C image is structural reference only. Its sample teams, score, percentages, payout values, trademarks, and “Go Live” viewer action are not product truth.

## 9. Launch scope

### Must work for the public soft launch

- Organizer authentication
- Native board creation and direct square assignment
- Paid-status and optional seller attribution
- Secure random axis draw and lock
- $4.99 2026 unlock for up to 20 boards
- Read-only short share link and QR code
- Mobile viewer, Find My Squares, and current-quarter scenarios
- Server-cached automatic beta scoring plus manual override
- Realtime board/score updates
- Verified email opt-in and idempotent quarter-winner email
- Explicit error/stale/offline states
- Secure, reproducible database and RLS
- Accessible dialogs, controls, and game-day interactions

### Deliberately later

- Seller accounts or delegated seller-entry links
- Viewer square claiming
- In-app money collection or payouts
- SMS notifications
- Co-organizers
- College, high-school, or other sports
- Multiple digit sets by quarter
- Native mobile apps
- Hard concurrent-viewer enforcement

## 10. Success criteria

The launch succeeds when:

1. An organizer can create, fill, randomize, publish, and share a trustworthy board without Excel or paper.
2. A viewer can open one link on a phone, find their squares, understand the current winner, and explore what next score would make them win.
3. Open viewers receive board and score changes without refreshing.
4. A verified purchaser receives exactly one correct email when their square wins a resolved milestone.
5. An automatic-score failure creates a clear stale/offline state and leaves the organizer a reliable manual path.
6. No public or non-owner request can read or modify private organizer, payment, or contact data.

## 11. Research-informed commercial position

The market spans free and $0.99 host tools through approximately $25 per grid. GridOne has no installed trust or social proof yet, while its differentiators—paper replacement, live scenarios, automatic scoring, and winner email—still need real-world validation. The $4.99 2026 introductory season pass is therefore a deliberate trust-building price, not a permanent valuation.

The price should be revisited after measuring board completion, unlock conversion, game-day score reliability, notification delivery, and organizer reuse.
