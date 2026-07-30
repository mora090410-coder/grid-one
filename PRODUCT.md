# GridOne Product

<!-- impeccable:product-schema 1 -->

## Platform

Responsive web application. React 19 + Vite, Supabase, Cloudflare Pages Functions, Stripe Checkout, server-side Gemini Search grounding, and transactional email.

## Product

GridOne replaces the full paper football-squares workflow: building the 10×10 board, assigning sold squares, drawing and locking axis numbers, sharing one trustworthy viewer link, following the live NFL score, exploring next-score scenarios, and notifying quarter winners.

**Promise:** Build it once. Share one link. Let the board run game day.

GridOne is a tracking and communication tool. It may record purchaser names, seller attribution, payout descriptions, and paid/unpaid status, but it never collects square money, holds the pot, or pays winners.

## People

### Organizer

A youth-sports or community volunteer running an NFL football-squares fundraiser. They are accountable to a group, usually work from a phone or laptop between other responsibilities, and care more about trust and reduced follow-up than software configurability.

One signed-in organizer owns and edits each board at launch.

### Purchaser/viewer

A parent, supporter, friend, or community member who receives a shared link. They do not need an account and cannot edit the board. On game day they want three answers immediately:

1. Where are my squares?
2. Who wins now?
3. What next score would make me win this quarter?

## Core journey

1. **Fill:** Create a native 10×10 board and assign purchaser/display names. Optionally record private seller attribution and payment status.
2. **Reconcile:** Resolve unassigned, unpaid, duplicate, or unclear entries.
3. **Draw:** Securely randomize one fixed set of 0–9 digits for the top and side axes after sales are complete.
4. **Preview:** Inspect the exact read-only viewer experience.
5. **Go Live:** Unlock and publish a short share link and QR code.
6. **Game Day:** Show a canonical automatic-beta score with explicit freshness and manual override.
7. **Resolve:** Store Q1, Q2, Q3, and Final winners once and email verified opted-in purchasers.

Photo/PDF OCR remains a secondary recovery path. Creating the board inside GridOne is primary.

## Product-specific mechanism

The **current-quarter scenario engine** shows the standard immediate NFL scoring outcomes for either team—+2, +3, +6, +7, and +8—the resulting last digits, and who would win the current quarter. When a viewer selects their name, scenarios that make them win are explicit.

These are arithmetic outcomes, never probabilities, betting advice, or predictions.

## Scoring authority

- Gemini with Google Search grounding is an automatic beta provider.
- Gemini runs server-side and many viewers collapse into one cached refresh per board.
- Responses are validated for matchup, state, score, quarter detail, provenance, and freshness before persistence.
- The interface always names whether the score is automatic, manual, refreshing, stale, rejected, offline, or Final.
- Manual override becomes canonical until the organizer deliberately returns to automatic mode.
- Late or stale automatic results can never overwrite manual or newer data.

## Viewer notifications

- No viewer account is required.
- A viewer selects their board identity, enters an email, and verifies ownership.
- Contact and delivery state remain private.
- The verified viewer receives one idempotent email when their assignment wins Q1, Q2, Q3, or Final.
- SMS is deferred.

## Commercial model

- Building, editing, and previewing unlimited draft boards are free.
- The Free tier includes **1 published board per account per season**.
- The **Game Day** tier is **$9.99 once** for up to 5 published boards in the 2026 season.
- The **Organization** tier is **$79 per season** for up to 50 published boards, an organization name on each board, one dashboard for all organization boards, and one receipt with the organization name.
- Payment gates published-board count only. Every published board includes live scores, scenarios, Find My Squares, winner emails, and QR sharing.
- “100 viewers” is a tested capacity target, not a hard gate or marketing guarantee.

## Public and private boundaries

### Public through the board link

- Published title, matchup, axis digits, privacy-reduced display names
- Organizer-published payout descriptions
- Canonical score, winner history, and current-quarter scenarios

### Organizer-only

- Owner identity, full participant records, purchaser emails
- Notification verification/delivery state
- Seller attribution and paid/unpaid status
- Draft data, Stripe identifiers, and audit history

### System-only

- Service-role, Gemini, Stripe-secret, webhook, and email-provider credentials
- Provider raw responses and rate-limit/delivery internals

## Terminology

Use **Board**, **Organizer**, **Viewer**, **Purchaser**, **Square**, **Axis digits**, and **Publish**.

Marketing speaks like a game-day organizer, not a system specification. Do not
use `beta`, `synthetic`, `fallback`, `read-only`, `grounded`, `native`,
`canonical`, `provenance`, `freshness`, or `entitlement` on sales surfaces.
Those terms may still appear where the product must explain actual score
authority, safety state, legal boundaries, or internal architecture.

Do not use pool, contest, player, guest, bet, wager, or payout-processing language when those meanings are not literally intended.

## Launch scope

### Required

- Organizer account and native board creation
- Fast direct/batch square assignment
- Private paid status and seller attribution
- Secure axis draw, lock, preview, unlock, and publish
- Read-only short link and QR code
- Mobile My Squares, current winner, scenario engine, and full board
- Server-cached automatic beta plus manual override
- Viewer score updates about every minute through visibility-aware polling
- Verified email opt-in and winner delivery
- Explicit errors, stale/offline states, secure schema/RLS, and accessibility

### Later

- Seller accounts or delegated entry
- Viewer claiming
- In-app money handling or payouts
- SMS, co-organizers, non-NFL sports
- Optional realtime transport after the 2026 season
- Multiple digit sets by quarter
- Native apps and hard viewer caps

## Success

GridOne succeeds when an organizer can replace Excel and paper, a phone viewer can understand their live position without contacting the organizer, winner email happens exactly once, automatic-score failure remains honest and recoverable, and private organizer/contact/payment data is inaccessible to viewers and non-owners.

## Brand commitments

- Name: **GridOne**
- Preserve the existing cardinal, gold, cool-neutral, ink, and live-green palette.
- Live green means only that a game is actively in progress.
- Gold means a result has been settled or a high-stakes action is being committed.
- The product is pre-launch. Never invent customers, testimonials, revenue, usage, or fundraising totals.
- Demonstration data must be labeled when it could be mistaken for real activity.
