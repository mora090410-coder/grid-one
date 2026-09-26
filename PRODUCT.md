# GridOne Product

<!-- impeccable:product-schema 1 -->

## Platform

Responsive web application. React 19 + Vite on Cloudflare Pages, Cloudflare Pages Functions for the API, two one-minute Cloudflare cron Workers, Supabase Postgres with Row Level Security, Stripe Checkout, server-side ESPN scoring, server-side Gemini OCR for paper-board import, and transactional email through Resend.

## Product

GridOne replaces the full paper football-squares workflow: building the 10×10 board, allocating numbered squares to families, sharing one trustworthy viewer link during sales, recording buyers, drawing and locking axis numbers, following the live NFL score, exploring next-score scenarios, and notifying quarter winners.

**Promise:** Build it once. Share one link. Let the board run game day.

GridOne is a tracking and communication tool. It may record purchaser names, seller attribution, payout descriptions, and paid/unpaid status, but it never collects square money, holds the pot, or pays winners.

## People

### Organizer

Anyone running an NFL football-squares board for friends, a watch party, an office pool, or a fundraiser. They coordinate a group, often work from a phone or laptop between other responsibilities, and want easy setup, less follow-up, and clear game-day results.

One signed-in organizer owns each board. Before finalization, the organizer may grant a revocable, seven-day private family link that edits only the names and explicit availability of its assigned squares. Public viewer links never grant editing.

### Purchaser/viewer

A parent, supporter, friend, or community member who receives a shared link. They do not need an account and cannot edit the board. During sales they see permanent square numbers 1–100, public family allocations, display names, explicit availability, and blank squares. Families can report names to the organizer or use a separately issued private family link. A name does not prove a sale or payment; a blank square does not promise availability. On game day they want three answers immediately:

1. Where are my squares?
2. Who wins now?
3. What next score would make me win this quarter?

## Core journey

The organizer workspace at `/boards/:boardId` moves through eight phases, evaluated by `src/features/organizer/lifecycle/organizerLifecycle.ts`.

1. **Create Draft:** Preview a named board before signup, then sign in and link the scheduled NFL game to save. The local preview lasts 24 hours and is never shared automatically. Native blank-board creation is primary; photo import is a recovery path.
2. **Fill and share:** Allocate selected squares to a person or family with one name and payment status. The first assigned person remains responsible when the public displayed name changes. Explicitly share before drawing game numbers; every team member sees allocations and available squares. Payment and existing private seller metadata stay private. Optional family links preserve responsibility and cannot change payment notes, axes, game, or finalization. Explicit availability is independent of names.
3. **Reconcile:** Review what blocks publishing and what is only private follow-up. Advisories never block progression.
4. **Draw:** Securely randomize and commit the game numbers. Organizers choose **One set for the whole game** or **New numbers each quarter** (four independent top/side sets: 1st, 2nd, 3rd, Final, where Final includes overtime). Draft redraws are allowed before publication. Boards read from a paper photo keep the photo's numbers and can be corrected digit by digit.
5. **Preview:** Inspect the exact viewer experience and the public/private boundary before numbers are locked. If already shared, participants continue seeing the selling board without draft axis numbers.
6. **Finalize:** Publish the locked viewer record through the existing atomic publication operation. The existing shared link switches from sales to game-day viewing. A draft draw is never exposed to participants.
7. **Game Day:** Automatic ESPN scoring with explicit authority and freshness, plus a manual override the organizer controls.
8. **Final Record:** Durably resolve Q1, Q2, Q3, and Final winners and deliver verified notifications exactly once.

Boards require at least one assigned square before publication. Remaining open squares require explicit acknowledgement. An open-square milestone resolves as an OPEN result with no winner email and no automatic rollover. Published sold-square labels may change only through a viewer-visible audited correction carrying before/after value, timestamp, and reason.

Use `docs/organizer-journey-contract.md` for the exact control names, phase criteria, persistence and recovery, and correction boundaries.

## Viewer hierarchy

Before finalization, `/b/:shareCode` renders `SalesBoardViewer`: board identity, counts of named and blank squares, a family filter when allocations exist, name/number search, blank highlighting, explicit available-only filtering, numbered board and accessible full square details. Saved changes refresh every 30 seconds while visible and on manual refresh; errors retain an explicitly last-known board. Finalization switches the same link to the game viewer.

The finalized viewer at `/b/:shareCode` is composed by `src/features/viewer/shell/ViewerShell.tsx`. Phone viewers first see board identity, the score and current result, score authority and freshness, and **Find my squares**. Selecting a durable participant identity changes the structure to show:

1. **Completed results or Final record:** confirmed milestones follow Find my squares, distinct from the current matching score.
2. **Your squares and current result:** count, matching coordinate/digit pairs, `View on board`, and whether the selected viewer wins now.
3. **Pending confirmation:** unresolved milestones when applicable.
4. **What makes this viewer win next:** matching standard scenarios first; all outcomes behind disclosure.
5. **Winner email:** compact verified opt-in, after identity and status are understood.
6. **Exact grid and board details:** pan/zoom board with sticky top/side axes, orientation, selected-cell centering, accessible cell detail, and subsequent rules/payout disclosure.

Before selection, the product never uses "me" language. Payouts and rules cannot displace Find my squares. Pregame shows no inert scenario list; stale and offline states identify last-known data; Final suppresses next-score scenarios entirely.

Use `docs/phone-viewer-hierarchy.md` for the component composition, state order, progressive disclosure, and acceptance checks.

## Product-specific mechanism

The **current-quarter scenario engine** (`src/features/viewer/scenarios/scenarioModel.ts`) shows the standard immediate NFL scoring outcomes for either team — +2, +3, +6, +7, and +8 — the resulting last digits, and who would win the current quarter. When a viewer selects their name, the scenarios that make them win are explicit.

These are arithmetic outcomes, never probabilities, betting advice, or predictions.

## Scoring authority

- ESPN is the automatic provider. It is reached only from the server, in `functions/_lib/espnNfl.ts`.
- A one-minute cron Worker calls `POST /api/scores/refresh`, which fetches the live scoreboard **once every three minutes for the entire slate** and promotes a canonical snapshot per board. Viewers read the projection through `GET /api/pools/:id/score`; they never amplify onto the provider.
- Responses are validated for matchup, state, score, quarter detail, and freshness before persistence.
- The interface always names whether the score is automatic, manual, refreshing, stale, rejected, offline, or Final.
- Manual override becomes canonical until the organizer deliberately returns to automatic mode.
- Late or stale automatic results can never overwrite manual or newer data.

## Viewer notifications

- No viewer account is required.
- A viewer selects their board identity, enters an email, and verifies ownership.
- Contact and delivery state remain private to the organizer and the system.
- The verified viewer receives one idempotent email when their assignment wins Q1, Q2, Q3, or Final.
- Failed deliveries are retried by a one-minute cron Worker calling `POST /api/notifications/retry`.
- SMS is deferred.

## Commercial model

The ladder is written once, in `src/features/homepage/pricing.ts`. Change it there, in Stripe, and nowhere else.

- Building, editing, and previewing unlimited draft boards are free.
- The Free tier includes **1 published board per account per season**.
- The **Game Day** tier is **$9.99 once** for up to 5 published boards in the 2026 season.
- The **Organization** tier is **$79 per season** for up to 50 published boards, an organization name on each board, one dashboard for all organization boards, and one receipt with the organization name.
- First sharing reserves one board from the same seasonal allowance; finalizing that board never counts twice. Shared boards cannot be deleted to reclaim their allowance or break team links.
- Payment gates published-board count only. Every published board includes live scores, scenarios, Find my squares, winner emails, and QR sharing.
- "100 viewers" is a tested capacity target, not a hard gate or marketing guarantee.

## Public and private boundaries

### Public through the board link

- Explicitly shared title, matchup, square IDs, display names, public family allocations and availability
- Optional organizer-written purpose, amount per square, and joining instructions; these are explicitly public text, never extracted from private contact fields
- Axis digits only after finalization; draft draws remain private
- Organizer-published payout descriptions
- Canonical score, winner history, and current-quarter scenarios

### Organizer-only

- Owner identity, full participant records, purchaser emails
- Notification verification and delivery state
- Private seller attribution and paid/unpaid status (public family allocation is a separate, explicitly labelled field)
- Private family token hashes and reassignment history; only a newly issued private editing link exposes its capability to the organizer
- Unshared draft data, draft axis numbers, Stripe identifiers, and internal audit history

### System-only

- Service-role, Gemini, Stripe-secret, webhook, cron, and email-provider credentials
- Provider raw responses and rate-limit/delivery internals

## Terminology

Use audience-familiar terms consistently and literally. **Board**, **Organizer**, **Viewer**, **Purchaser**, **Participant**, **Square**, **Axis digits**, and **Publish** are current product language, not a universal vocabulary restriction.

Marketing should sound like a game-day organizer, not an internal system specification. Prefer plain language; use technical terms when they clarify actual capability, score authority, state, privacy, or legal boundaries. Words are not banned for appearing in generic AI copy. Use Beta when Anthony requests it and the designation is factually accurate; explain relevant limitations. The approved photo-import Beta and review sentences remain exact regression contracts, not exemptions from a blacklist. Copy tests protect truthful disclosures and the approved commercial ladder, not every inherited marketing phrase.

Do not use pool, contest, player, guest, bet, wager, or payout-processing language when those meanings are not literally intended.

## Scope

### Implemented surfaces

- Organizer account and native board creation
- Direct and block square assignment with private paid status and seller attribution
- Secure axis draw, commit, preview, publish, and audited published-label correction
- Read-only short link and QR code
- Phone viewer: Find my squares, current result, scenario engine, exact grid, Final record
- Server-cached automatic ESPN scoring plus manual override
- Viewer score updates about every three minutes through visibility-aware polling
- Verified email opt-in, winner delivery, and delivery retry
- Explicit error, stale, and offline states; RLS-backed schema; the accessibility contract

### Later

- Seller accounts
- Viewer claiming
- In-app money handling or payouts
- SMS, co-organizers, non-NFL sports
- Realtime transport in place of polling
- Multiple digit sets by quarter
- Native apps and hard viewer caps

## Success

GridOne's north-star outcome is **Successful Game-Day Board Runs through Final**. A qualifying board is published and publicly available, has committed axis digits, receives authoritative automatic or manual scoring, durably resolves Q1/Q2/Q3/Final, and finishes without an unresolved integrity, publication, or score-authority failure.

Supporting evidence must show that an organizer can replace Excel and paper, a phone viewer can understand their live position without contacting the organizer, winner email happens exactly once, automatic-score failure remains honest and recoverable, and private organizer/contact/payment data is inaccessible to viewers and non-owners.

Use `docs/product-metrics-and-evidence.md` for qualification, leading metrics, guardrails, privacy constraints, and the baseline-first target-setting policy.

## Brand commitments

- Name: **GridOne**
- The current production palette in `src/design/tokens.css` is cardinal, gold, live green, ink, chyron, broadcast white, newsprint.
- Root `DESIGN.md` is the normative overlay for the current implementation, not an immutable aesthetic. `docs/DESIGN_TOKENS.md` records the CSS-variable and Tailwind mapping. `npm run design:lint` is the maintained-spec gate.
- `docs/accessibility-contract.md` targets WCAG 2.2 AA across complete organizer and viewer processes and defines the board-grid keyboard, dialog, touch, zoom, motion, state, and automation gates.
- In current semantic UI, live green means a game is actively in progress; decorative light carries no state meaning.
- In current semantic UI, gold marks settled results or high-stakes commitment, and actions on dark surfaces as specified in `DESIGN.md`.
- The product is pre-launch. Never invent customers, testimonials, revenue, usage, or fundraising totals.
- Demonstration data must be labeled when it could be mistaken for real activity.

Existing copy, hierarchy, materials, tokens, and interaction mechanisms are production baselines. Exploration may challenge them to improve organizer success, viewer comprehension, trust, or maintainability. Label assumptions and recommend the strongest outcome, without manufacturing a redesign. Exploration does not authorize implementation or release: intentional adoption requires an approved scope, coordinated design/journey/test updates, reversible implementation, and relevant rendered, accessibility, and integrity checks. Unchanged surfaces retain current normative tokens. Pricing, money, privacy, permissions, score authority, and evidence truth remain binding.

## Seller links

Most fundraisers sell through sellers: the organizer assigns each player or family a block, and they sell it. After sharing the board, the organizer taps **Get seller links** and gets one public link per seller, then shares each one or copies all of them for the team chat. A seller's unsold squares are the ones still showing the seller's own name.

A buyer opens the link, sees only that seller's squares, taps the open ones (up to 10), types a name, and taps **Claim**. The claim is one atomic database write under the board lock: if someone got there first, the buyer is told to pick another and nothing is claimed. The buyer is remembered on that phone, so on game day the board opens on their squares. The buyer pays the seller directly; GridOne never handles money and a claim is not proof of payment. Unsold squares keep the seller's name. Claiming closes when the numbers are locked; the link then points to the board. **New link** replaces a seller's link and stops the old one. Links are stored plainly (like share codes) because they are meant to be posted publicly.

v1 limits: no hold timers, no claim codes, and no rate limiting beyond the 10-square cap. The organizer's open workspace sees new claims after a reload; a stale autosave reports a conflict rather than overwriting a claim.

## Optional family editing and repeat setup

A private family link is a bearer capability, distinct from the public board link. Anyone possessing it can update the specified family's names and explicit availability until expiry, revocation, responsibility change, or finalization. The database locks the board and verifies revision, cell scope, and credential on every read/write. No family can access payment notes, alter responsibility, or publish. Creating a new link for a family revokes its previous links.

An organizer's deliberate pre-finalization reassignment preserves holder names, archives previous private entries, resets payment status to unknown and clears old seller attribution. It requires an explicit payment-note review acknowledgement and invalidates all affected family links. Existing generic payment notes are never reinterpreted as proof of payment.

Use this setup again copies only title and prize descriptions. It creates no board until the organizer selects a new scheduled game and saves. Names, responsibility, availability, payments, axes, identifiers, credentials, scores and subscriptions never carry over.


## Guest claim links (controlled rollout, legacy)

> **Superseded 2026-09-23 by Seller links.** Organizers and families no longer create these links in the app. Links already posted still open at `/p/...` and keep working until the numbers lock; the tables, endpoints and occupancy guards below stay in place so nothing already claimed is lost.

The organizer can issue a separate public guest claim link for reviewed, explicitly available square IDs on an already shared board. A named seller distributes the link without gaining an organizer account or editing permissions. A link may cover noncontiguous blocks. Ordinary public viewer links retain their existing authority.

The family-sharing handoff adds a **Share your squares** action to the existing private family workspace. It derives the public link's scope from that capability's current assignment, without re-entering names or square numbers. Creating a link does not change names or availability: only explicitly available, unclaimed squares can be claimed. Participants cannot alter organizer link settings or bypass disabled, expired, or mismatched links. The organizer sends the private management link directly to the family; the family sends the separate public claim link to prospective claimants. Buyers see only the invite's square collection, with permanent square numbers preserved. The ordinary public board remains a full-board view.

Guests choose squares, receive a 90-second server hold, and enter a public display name without an account. The default maximum is one square per anonymous credential and invite; this cannot guarantee one real person across devices. A private four-word code opens that guest's receipt and permits an atomic square swap or release while the invite is active and the board remains unfinalized. Draft number draws do not end claiming; final publication does. Active holds prevent publication until they finish or the organizer explicitly cancels them. Existing guest claims must be explicitly released before reassignment.

The receipt may display organizer-entered seller payment instructions and a validated external HTTPS link. These details are deliberately shared with claimants and never copied from private payment/contact metadata. Opening instructions does not initiate or verify a payment or change paid status. GridOne does not process square money. Ordinary public snapshots and broadcasts omit these details and all claim credentials.

Guest claiming is disabled unless server configuration explicitly allows a board. The original guest-claim feature has been released for a controlled test-board walkthrough. The participant sharing handoff uses migration030 and the same exact-board rollout gate; release was approved separately after local workflow verification. See `docs/guest-invites-operations.md` for the release boundary.
