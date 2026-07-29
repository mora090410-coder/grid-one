# GridOne — Launch Hardening & Design Refresh: Agent Execution Spec

**Version:** 1.0
**Date:** 2026-07-29
**Baseline commit:** `2f357d9` (clean tree, pushed to `origin/main`)
**Owner:** Anthony (product owner, sole approver)
**Executing agent:** coding agent with repo write access at `/Users/amm13/00-Projects/parkside/gridone-app`

---

## 0. How to use this document

This is an execution spec, not a discussion document. It is written to be handed to a coding agent and worked top to bottom.

- Phases run **in order**. Do not start Phase N+1 until Phase N's exit gate passes.
- Each task has **Requirements** (what must be true), **Implementation notes** (how, where), **Acceptance criteria** (the observable proof), and **Tests** (what must be added).
- Anything marked **STOP** requires explicit approval from the product owner before proceeding.
- If a requirement conflicts with `PRODUCT.md` or `DESIGN.md`, **stop and ask**. Those two files are the product truth. This spec defers to them except where it explicitly amends `DESIGN.md` (Phase 5 only).
- Record every completed task in `tasks/todo.md` under a dated heading, following the existing convention in that file.

---

## 1. Global guardrails

These apply to every task in every phase. Violating any of them is a failed task regardless of whether the code works.

### 1.1 Production boundary

**STOP for fresh approval before any of the following:**

- Applying a migration to the production Supabase project `illqymckwqiawdwxhwcy`
- Changing, archiving, or creating any live Stripe price or product
- Enabling, disabling, or reconfiguring a live Stripe webhook endpoint
- Deploying to Cloudflare Pages production
- Sending any email to an address that is not owned by the product owner
- Submitting any real Stripe charge

Local development, test-mode Stripe, disposable Postgres, and unit/browser tests are pre-authorized.

### 1.2 Secrets

- Never print, log, echo, or write a secret value — including into test output, commit messages, `tasks/todo.md`, or an accessibility label.
- Validate secrets only with internal equality/length checks that return a sanitized boolean. (This rule already exists in `tasks/lessons.md`; it is repeated here because it was learned the hard way.)
- No new secret may be read from `import.meta.env` on the client. Server secrets live in Cloudflare env only.

### 1.3 Data integrity

- No task may delete or rewrite production rows. Corrections are additive (new rows, new revisions, audit events).
- Any change to an existing migration file is **forbidden** once that migration has been applied to production. Migrations `000`–`011` are applied. New work goes in `012` and up.
- Every new migration must be idempotent-safe on a fresh database and must apply cleanly in the full `000`→`N` chain against a disposable PostgreSQL 17 instance before it is proposed for production.

### 1.4 Scope discipline

- Do not refactor code that is not named in a task.
- Do not upgrade dependencies unless a task says to.
- Do not change visual design outside Phase 5.
- Do not add a feature that is not in this spec. If you believe one is required, stop and say so.

### 1.5 Verification gate (run before closing any task)

```
npm test -- --run
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build
git diff --check
```

All four must pass. Browser coverage (`PLAYWRIGHT_PORT=5199 npx playwright test`) must pass at each **phase** exit, not necessarily each task.

### 1.6 Evidence standard

A task is not done because the code looks right. It is done when a test fails without the fix and passes with it. For every defect task below, **write the failing test first**, confirm it fails against current `main`, then fix.

---

## 2. Phase 0 — Verify the unknowns (blocking, ~2 hours)

The review that produced this spec read the Cloudflare Functions and React hooks. It could not read the Postgres function bodies. Three assumptions must be confirmed or refuted before Phase 1 is planned in detail, because the answers change the fixes.

### T0.1 — Audit `gridone_activate_board` for allowance concurrency

**Requirement:** The 20-board allowance must be impossible to exceed under concurrent requests.

**Implementation notes:** Read the function body in `supabase/migrations/`. Determine whether the used-board count is read and written in a way that is safe under concurrency — specifically whether it uses `SELECT ... FOR UPDATE` on the entitlement row, an atomic `UPDATE ... WHERE used < limit RETURNING`, or a unique/partial index backstop. A plain read-then-insert is unsafe.

**Acceptance criteria:** A written finding in `tasks/todo.md` stating which mechanism is in use, with the SQL quoted. If unsafe, a `012` migration makes it safe, and T1.6 below becomes required.

**Tests:** A concurrency test that fires 25 parallel `POST /api/pools/activate` for distinct boards against a disposable Postgres with a 20-board entitlement. Exactly 20 must succeed; 5 must be rejected with a clear allowance error. No test may leave the entitlement in an inconsistent state.

### T0.2 — Audit `gridone_promote_score_snapshot` for stale-write ordering

**Requirement:** A slow automatic score response must never overwrite a newer snapshot or a manual-mode snapshot.

**Implementation notes:** Read the function body. Confirm it re-checks `scoring_mode` and compares snapshot recency/sequence inside the transaction, rather than trusting the caller. The handler-level guard is holed (see T2.1); the database is the last line of defense.

**Acceptance criteria:** Written finding with the SQL quoted, plus a statement of whether the database independently rejects a stale or manual-conflicting promotion.

**Tests:** Direct SQL tests against disposable Postgres: promote snapshot A, then attempt to promote an older-timestamped snapshot B; B must be rejected. Repeat with `scoring_mode = 'manual'`; the automatic promotion must be rejected.

**Phase 0 audit amendment — July 29, 2026:** The RPC passes both direct SQL cases above, but that does not fully prove the stronger slow-response requirement. The handler stamps `retrieved_at` only after the provider request completes, so an older request that outlives its lease can finish last and appear newest; equal timestamps also have no deterministic tiebreaker. The handler also projects the promoted score into `public_board_snapshots` after the promotion transaction, leaving a race in which a later manual promotion can be followed by the older automatic handler rewriting the viewer score. T2.1 is amended below to close both ordering gaps.

### T0.3 — Audit `functions/api/notifications/unsubscribe.ts` token validation

**Requirement:** The unsubscribe link that is actually emailed must work.

**Implementation notes:** `functions/_lib/winnerNotifications.ts:125-126` builds an HMAC-SHA256 unsubscribe token and puts it in the email. Separately, `functions/api/boards/[shareCode]/subscribe.ts:46-48` generates and stores an `unsubscribe_token_hash` column that is never sent to anyone. Determine which one the unsubscribe handler validates against.

**Acceptance criteria:** Written finding. If the handler validates the stored hash rather than the HMAC, every unsubscribe link in every winner email is broken — that is a **launch blocker** and a CAN-SPAM exposure, and it is added to Phase 1 as T1.7.

**Tests:** End-to-end test: generate a winner email, extract the unsubscribe URL from the rendered body, call it, assert the subscription moves to `unsubscribed` and that a subsequent winner resolution does not send to that address.

### Phase 0 exit gate

All three findings written into `tasks/todo.md`. Any refuted assumption is reflected as an amendment to this spec before Phase 1 starts. **STOP and report to the product owner.**

---

## 3. Phase 1 — Money and abuse blockers

**Nothing in this phase is optional. Paid signup does not open until all of Phase 1 ships and its exit gate passes.**

### T1.1 — Prevent double payment for the non-stacking season pass

**Defect:** `functions/api/stripe/create-checkout-session.ts:61-75`. The open-session reuse guard is scoped to `contest_id`, and entitlement is checked only at session creation. A user can abandon checkout on board A, pay on board B, then return to the still-live board-A Stripe URL and pay a second time for a pass that does not stack.

Secondary defect at the same site: `.maybeSingle()` is used on a filter that can legitimately match multiple rows, and the resulting error is discarded. Once two pending orders exist for one contest, `existingOrder` is permanently `undefined` and every click mints a new order and session.

**Requirements:**

1. A user who already holds an active 2026 entitlement must not be able to reach a Stripe payment page at all, by any route, including a previously issued session URL.
2. Open checkout sessions must be scoped per **owner and season**, not per contest.
3. Creating a checkout session when a matching open session exists must reuse that session, deterministically, even if multiple stale order rows exist.
4. The webhook must independently refuse to grant a second entitlement for the same owner and season, even if a second payment somehow completes. If a duplicate payment does land, it must be recorded as refundable and surfaced to the owner, not silently kept.

**Implementation notes:**
- Replace the `contest_id`-scoped lookup with an `owner_id` + `season` scoped lookup, ordered deterministically (`created_at desc`), using `.limit(1)` and reading `data[0]` rather than `.maybeSingle()`. Do not discard the error.
- Add an entitlement re-check inside the webhook fulfillment path, not only at session creation.
- When a checkout session is created, expire any other open session for the same owner and season via the Stripe API so only one live payment URL exists at a time.
- Set `expires_at` on new Checkout Sessions to the minimum Stripe permits (30 minutes) rather than the 24-hour default, to shrink the stale-URL window.
- On successful fulfillment, expire all remaining open sessions for that owner and season.

**Acceptance criteria:**
- Given an owner with an active entitlement, `POST /api/stripe/create-checkout-session` returns a non-2xx with a clear "already have a season pass" payload, and no Stripe session is created.
- Given an owner with three stale pending orders on one contest, a new request reuses exactly one session and does not create a fourth order.
- Given a fulfilled entitlement and a replayed `checkout.session.completed` for a *different* session of the same owner and season, the fulfillment RPC grants nothing additional and the response records a duplicate-payment condition.

**Tests:** Extend `tests/commercialEndpoints.test.ts` with: entitled-user rejection; multi-stale-order reuse; cross-contest double-pay attempt; duplicate fulfillment for the same owner/season.

---

### T1.2 — Handle the full Stripe payment lifecycle

**Defect:** `functions/api/stripe/webhook.ts:23,25`. Only `checkout.session.completed` is handled, and a session with `payment_status !== 'paid'` returns 400. Any delayed-notification payment method — Cash App Pay, ACH debit, or deferred Link capture, all of which can be enabled from the Stripe Dashboard with no code change — fires `checkout.session.completed` with `payment_status: 'unpaid'` and then `checkout.session.async_payment_succeeded` when money lands. The current handler rejects the first and ignores the second: **the customer is charged and gets nothing.**

Separately, every 400 returned on lines 25/27/30/33 is a delivery failure to Stripe, which retries with backoff for roughly three days and then emails about disabling the endpoint.

**Requirements:**

1. Handle `checkout.session.async_payment_succeeded` with the same fulfillment path as `checkout.session.completed`.
2. Handle `checkout.session.async_payment_failed` and `checkout.session.expired` by marking the order terminal, so it stops blocking new checkout attempts.
3. A `completed` event with `payment_status: 'unpaid'` is a **valid, expected** event. Record the order as awaiting payment and return **200**. Do not fulfill. Do not 400.
4. Return 4xx **only** for a signature failure or an unparseable body. Every other recognized-but-unactionable event returns 200 with a logged reason. Genuine internal errors return 5xx so Stripe retries.
5. Fulfillment must remain idempotent on `event_id`.

**Implementation notes:** Keep the existing line-item re-verification (price ID, `amount_total === 499`, currency) on every fulfillment path — it is correct and it is what makes a forged session harmless. Route `async_payment_succeeded` through the identical verification, not a shortcut.

**Acceptance criteria:**
- A recorded `async_payment_succeeded` fixture grants exactly one entitlement.
- A recorded `completed` + `payment_status: unpaid` fixture returns 200, grants nothing, and leaves the order recoverable.
- A subsequent `async_payment_succeeded` for that same order fulfills it.
- `async_payment_failed` marks the order terminal and unblocks a fresh checkout.
- Replaying any fulfilled event grants nothing additional.

**Tests:** New `tests/stripeWebhookLifecycle.test.ts` with recorded fixtures for all five event types plus a replay of each. No network calls.

---

### T1.3 — Revoke entitlement on refund and dispute

**Defect:** `functions/api/stripe/webhook.ts:23`. `charge.refunded` and `charge.dispute.created` are short-circuited to a 200 "Ignored". A buyer can pay $4.99, activate 20 boards, then charge back and keep the season pass permanently.

**Requirements:**

1. Handle `charge.refunded` (including partial), `charge.dispute.created`, and `charge.dispute.closed`.
2. On a full refund or an opened dispute, the owner's 2026 entitlement moves to `revoked` with a reason and a timestamp. Revocation is a **new state, not a delete** — the row and its audit trail are preserved.
3. **Already-published boards stay published and stay viewable.** A viewer's link must never break because of an organizer's payment dispute. Revocation blocks *new* activations only.
4. A revoked owner attempting to activate a new board sees an explicit, non-accusatory state explaining that the season pass is inactive and offering to purchase again.
5. If `charge.dispute.closed` resolves in the merchant's favor, the entitlement is restored.
6. Every revocation and restoration writes an audit event.

**Implementation notes:** New migration `012_entitlement_revocation.sql` adding a status enum value and revocation columns, plus an RPC `gridone_revoke_entitlement(p_event_id, p_owner_id, p_season, p_reason)` that is idempotent on `p_event_id`. Do not implement revocation as a client-visible flag; enforce it in the same RPC that gates activation.

**Acceptance criteria:**
- Refund fixture → entitlement `revoked`, published boards still return 200 through their share codes, new activation rejected with the explicit state.
- Dispute-won fixture → entitlement `active` again, activation permitted.
- Replayed refund fixture → no additional state change, no duplicate audit row.

**Tests:** Added to `tests/stripeWebhookLifecycle.test.ts` plus an RLS/RPC test that a revoked owner cannot activate.

---

### T1.4 — Close the unauthenticated email relay

**Defect:** `functions/api/boards/[shareCode]/subscribe.ts:17-91`. `onRequestPost` has no authentication, no rate limit, no captcha, and no cap. The recipient address is fully attacker-controlled (line 23), and share codes are public by design. A loop against one published board sends unlimited real email from your verified sending domain to any address. Outcome: victim mailbox flooded, Resend account rate-limited or suspended, sending domain blacklisted mid-season.

**This is the single highest-risk item in the spec.** It requires no account, no payment, and no skill to exploit.

**Requirements:**

1. Per-board rate limit: no more than **10** verification emails per board per rolling hour.
2. Per-email-address limit: no more than **3** verification emails per address per rolling 24 hours, across all boards.
3. Per-IP limit: no more than **5** subscribe requests per rolling 10 minutes.
4. Per-participant limit: no more than **2** pending verifications for a single participant at a time; a third request returns the existing pending state rather than sending.
5. Exceeding any limit returns **429** with a human-readable retry window. It must **not** reveal whether the address was previously subscribed.
6. The response body must be identical whether or not the participant exists and whether or not the address was already subscribed. No enumeration oracle.
7. Limits are enforced **server-side and durably** (database counters or Cloudflare KV/Durable Object), never in the client and never in per-isolate memory — Cloudflare Workers isolates do not share state.
8. Every send and every throttle decision writes a row to a `notification_send_log` with board, participant, hashed address, IP, and outcome, for abuse forensics.

**Implementation notes:** Migration `013_notification_rate_limits.sql` with the log table and an RPC `gridone_claim_notification_send(...)` that atomically checks all four limits and either records the intent or refuses — one round trip, no read-then-write race. Call this **before** the Resend call, and record the result after.

**Acceptance criteria:**
- 11 requests to one board within an hour: 10 send, the 11th returns 429 with a retry window.
- 4 requests to one address across 4 different boards in 24 hours: 3 send, the 4th 429s.
- A request for a nonexistent `participantId` returns a response byte-identical to a valid one.
- No path sends email without a preceding successful claim.

**Tests:** New `tests/subscribeAbuse.test.ts` covering all four limits, the identical-response requirement, and the claim-before-send ordering. Include a test that asserts a Resend call **cannot** happen when the claim fails.

---

### T1.5 — Stop re-subscription from destroying a verified subscription

**Defect:** `functions/api/boards/[shareCode]/subscribe.ts:56-70`. The update branch overwrites the whole row including `status: 'pending'` and `verified_at: null`, with no check of the current status. A fan who verified in week 1 and then double-taps the form before kickoff silently drops to `pending`. If they do not find and click the new verification email, `winnerNotifications.ts:207` filters on `status = 'verified'` and they get no winner email — the one feature they cared about.

**Requirements:**

1. If a subscription is already `verified` **and the email address is unchanged**, resubmitting is a no-op. Status is not touched and no email is sent. The internal claim result records `already_verified`, while the public response stays byte-identical to every other accepted outcome.
2. If the address **changed**, the old verified state is retained until the new address is verified. Only on successful verification of the new address does it replace the old one. A failed or abandoned change must never leave the participant with no working notification.
3. If the subscription is `unsubscribed`, resubscribing is permitted and starts a fresh verification.
4. The user-facing response must plainly explain every safe possibility without identifying which stored state applies to the submitted address. This anti-enumeration rule controls the public contract; detailed outcomes remain service-only.

**Acceptance criteria:**
- Verified + same address + resubmit → status stays `verified`, zero emails sent, internal `already_verified` outcome, and the same public `202` body as a new or nonexistent identity.
- Verified + new address + resubmit → old address still receives winner mail until the new one verifies; then only the new one does.
- Abandoned address change → original address still receives winner mail.

**Tests:** Added to `tests/notificationEndpoints.test.ts`.

---

### T1.6 — Enforce the 20-board allowance atomically

**Conditional on T0.1.** If `gridone_activate_board` is already concurrency-safe, mark this task not-required with the SQL evidence and move on.

**Requirements:**

1. The allowance check and the activation write happen in one atomic operation. No read-then-write.
2. Under 25 concurrent activation requests against a 20-board entitlement, exactly 20 succeed.
3. The rejection is a clear, specific error the UI can render: allowance exhausted, with the current count and limit.
4. A database-level backstop exists independent of the RPC logic — a `CHECK`, a partial unique index, or a trigger — so that a future code path cannot overshoot.

**Implementation notes:** Prefer `UPDATE season_entitlements SET boards_used = boards_used + 1 WHERE owner_id = ... AND season = ... AND status = 'active' AND boards_used < board_limit RETURNING boards_used`. If that returns no row, the allowance is exhausted or the entitlement is revoked. This is atomic without an explicit lock.

**Acceptance criteria:** The T0.1 concurrency test passes deterministically across 10 consecutive runs.

---

### T1.7 — Repair the unsubscribe link

**Conditional on T0.3.** Required only if the handler validates the stored hash rather than the emailed HMAC.

**Requirements:**

1. The token in the email body is the token the handler validates.
2. Unsubscribe works from a plain GET with no login, in one click, per standard email practice.
3. Unsubscribed addresses are excluded from all future winner sends for that board.
4. Add the `List-Unsubscribe` and `List-Unsubscribe-Post` headers to winner emails.
5. Remove the unused column and its generation code, or wire it in — do not leave two competing token schemes.

**Acceptance criteria:** Extract the URL from a rendered winner email, GET it, assert `unsubscribed`, assert a subsequent milestone resolution skips that address.

---

### Phase 1 exit gate

- All Phase 1 tasks complete with their tests.
- Full verification gate (§1.5) passes.
- `PLAYWRIGHT_PORT=5199 npx playwright test` passes on Chromium and WebKit.
- Migration chain `000`→`013` applies cleanly to a fresh disposable PostgreSQL 17.
- Stripe **test mode** end-to-end: checkout → webhook → entitlement → activation → publish, plus a test-mode refund proving revocation.
- **STOP.** Report to the product owner. Production migration and deploy require fresh approval.

---

## 4. Phase 2 — Game-day correctness

These do not cost money today because no game is being played. They will cost trust on the first live Sunday. `PRODUCT.md` stakes the entire product on the board being trustworthy; these are the defects that break that claim.

### T2.1 — Manual scoring must win, always

**Defect:** `functions/api/pools/[id]/score.ts:203-208`. The manual-mode short-circuit reads `if (current && (... || state?.scoring_mode === 'manual'))`. It requires a non-null current snapshot. When `scoring_mode` is `'manual'` but `current_snapshot_id` is still null, the guard is false and control falls through to the lease, the ESPN fetch, and `gridone_promote_score_snapshot` at lines 222-268.

The failure is the *normal* order of operations: an organizer flips a fresh board to manual **before** typing the first score. Any viewer poll then inserts and promotes an automatic snapshot. This directly contradicts `PRODUCT.md`: "Manual override becomes canonical until the organizer deliberately returns to automatic mode" and "Late or stale automatic results can never overwrite manual or newer data."

**Requirements:**

1. `scoring_mode === 'manual'` short-circuits the automatic path **unconditionally**, independent of whether a snapshot exists.
2. A board in manual mode with no score yet returns an explicit "manual, awaiting organizer entry" state — not an automatic score, not an error, not an empty board.
3. The database independently refuses to promote an automatic snapshot onto a manual-mode board (see T0.2). Handler and database both enforce it.
4. Returning to automatic mode is an explicit organizer action, and only that action permits the next automatic promotion.
5. Automatic promotion order is based on refresh start/lease sequence or another monotonic value captured before the provider call, never on a completion timestamp assigned after the response arrives.
6. Canonical promotion and the `public_board_snapshots.score` viewer projection happen in one database transaction. A handler that loses automatic authority cannot write the public score afterward.

**Acceptance criteria:**
- Fresh board + manual mode + no snapshot + viewer poll → no ESPN call, no snapshot insert, explicit awaiting state returned.
- Same, but the promote RPC is called directly with an automatic snapshot → rejected at the database.
- Manual → automatic transition → exactly one provider refresh reclaims authority. (This path was fixed in `95f8678`; add a regression test so it stays fixed.)
- Request A starts, its lease expires, request B starts and promotes, then A completes → A is rejected even though it completed last.
- Automatic promotion racing a manual commit → canonical state and the public viewer projection both remain manual.

**Tests:** Extend `tests/manualScoringMode.test.ts`, retain the direct SQL rejection tests, and add deterministic request-order plus automatic/manual projection-race coverage.

**Implementation notes:** Add `014_score_promotion_ordering.sql` rather than changing applied migration `005`. Move the milestone-confirmation migration below from `014` to `015`.

---

### T2.2 — Milestone winners need a confirmation window and a correction path

**Defect:** `functions/_lib/winnerNotifications.ts:39-51,182-194`. Q1 resolves the instant `snapshot.period > 1`. The upsert uses `ignoreDuplicates: true` on `(contest_id, milestone)`, and there is no correction or re-resolution path anywhere in the codebase.

The realistic failure: ESPN advances `period` to 2 before posting the extra point on a touchdown scored as Q1 expired — a routine few-second lag in their summary feed. GridOne reads 7-13, resolves Q1 on digits (7,3), writes it permanently, and emails that person "you won Q1." Thirty seconds later the real score is 7-14 and the actual Q1 winner is a different square. **The wrong square is now the board's permanent record and the wrong person has an email saying they are owed money.**

This is the defect most likely to destroy the product's credibility at a real fundraiser.

**Requirements:**

1. **Confirmation window.** A milestone does not resolve on the period flip alone. It resolves when the quarter-end score has been stable across **two consecutive successful provider reads at least 45 seconds apart**, or when the provider reports the game as `post` for the FINAL milestone.
2. During the window the UI shows an explicit **"Q1 result pending confirmation"** state with the provisional digits. It must be visibly provisional — not styled as a settled gold result. `DESIGN.md` reserves gold for settled outcomes; a pending milestone must not use it.
3. **No email is sent during the confirmation window.** Email fires only on confirmed resolution.
4. **Correction path.** The organizer can correct a resolved milestone. A correction:
   - writes a new resolution row rather than mutating the old one (append-only history),
   - records who corrected it and when,
   - sends a clearly-worded correction email to both the incorrectly-notified person and the actual winner,
   - is visible on the public board as a correction, not silently swapped.
5. `ignoreDuplicates: true` is replaced by explicit version-aware resolution logic.
6. If the provider score *regresses* (a correction on ESPN's side) before confirmation, the pending resolution is discarded silently with no user-visible churn.

**Implementation notes:** Migration `015_milestone_confirmation.sql` adding `pending_resolutions` and a `superseded_by` / `resolution_version` column on the resolutions table. `PRODUCT.md` requires stored milestone results that are not recomputed from a drifting provider response — this preserves that while adding the missing correction affordance.

**Acceptance criteria:**
- Fixture sequence [period flips to 2 at 7-13] then [7-14 at the same period 25s later]: **no** email is sent and 7-14 becomes the new pending candidate. A third successful 7-14 read at least 45 seconds after that candidate was first observed confirms the 7-14 digits. This explicit third read reconciles the example with the two-identical-reads/45-second rule above.
- Fixture sequence [7-13 stable across two reads 60s apart]: resolution confirmed, exactly one email sent.
- Organizer correction: new resolution row, original retained, two correction emails, public board shows the correction.
- Provider regression before confirmation: pending discarded, nothing user-visible changed, no email.

**Tests:** `tests/milestoneConfirmation.test.ts` covers recorded ESPN payload sequences; `tests/milestoneConfirmation.integration.test.ts` proves the confirmation and correction transactions in disposable PostgreSQL. No live game dependency.

---

### T2.3 — Cap and back off winner email retries

**Defect:** `functions/_lib/winnerNotifications.ts:99,116` plus `functions/api/pools/[id]/score.ts:284`. `sendWinnerEmail` short-circuits only on `status === 'sent'` or a `'sending'` row younger than 5 minutes. `attempt_count` is incremented at line 116 but never read or bounded. A `'failed'` row is retried unconditionally. Meanwhile `resolveMilestonesAndNotify` runs on **every** GET of a `post`-state board, and `stale_after` for `post` is 31,536,000 seconds — so this path runs forever.

Failure: Resend returns a transient 500 on the FINAL email but actually delivered it. The row goes `failed`. Every viewer polling the finished board re-enters `sendWinnerEmail` and re-POSTs. Resend's `Idempotency-Key` suppresses the duplicate for 24 hours — after that it does not. The winner gets a duplicate "you won" email, and the loop never terminates.

**Requirements:**

1. Maximum **5** send attempts per notification row. After that the row is terminal `failed_permanent`.
2. Exponential backoff between attempts: 1m, 5m, 25m, 2h. A row is not retried before its `next_attempt_at`.
3. Attempt count and next-attempt time are read and enforced, not merely written.
4. Distinguish a **permanent** provider failure (invalid address, hard bounce, 4xx) from a **transient** one (5xx, timeout). Permanent failures do not retry at all.
5. Retry is driven by the scheduled `CRON_SECRET` worker, **not** by viewer polls. A viewer GET must never trigger an email send attempt.
6. Terminal failures are surfaced to the organizer in the dashboard so a human can follow up. A silently undelivered winner email is worse than a visible failure.

**Acceptance criteria:**
- 5 consecutive transient failures → `failed_permanent`, no 6th attempt.
- A hard-bounce response → terminal immediately, one attempt.
- 100 simulated viewer GETs on a finished board → zero send attempts.
- Backoff respected: an attempt at T+30s when `next_attempt_at` is T+5m is refused.

**Tests:** Extend `tests/notificationEndpoints.test.ts`.

---

### T2.4 — Withdrawn boards must stop serving data everywhere

**Defect:** `functions/api/pools/[id]/score.ts:191`. The share-code branch filters `.in('status', [...])` but omits the `.is('withdrawn_at', null)` check that both the public GET (`functions/api/pools/[id].ts:255`) and subscribe (`subscribe.ts:34`) correctly apply. A withdrawn board 404s on the board endpoint but still returns live score plus `winnerHistory` — which carries participant display names — through the score endpoint.

**Requirements:**

1. Every public read path applies the identical visibility predicate: status in the published set **and** `withdrawn_at IS NULL`.
2. That predicate is defined **once**, in a shared helper, and imported by every endpoint. Three hand-copied filters is how this bug happened.
3. A withdrawn board returns the same 404 shape from every public endpoint.
4. Add a test that fails if any future public endpoint is added without the shared predicate.

**Acceptance criteria:** Withdraw a board; assert 404 from `/api/pools/{code}`, `/api/pools/{code}/score`, and `/api/boards/{code}/subscribe`, with identical response bodies.

---

### Phase 2 exit gate

Full verification gate plus browser suites. Recorded-fixture score tests cover pregame, live, stale, offline, manual, overtime, final, milestone confirmation, and milestone correction. **STOP and report.**

---

## 5. Phase 3 — Load and efficiency

The season has not started. This is the work that determines whether a Super Bowl-night board with 100 viewers stays up.

### T3.1 — Stop re-running the milestone resolver on every poll

**Defect:** `functions/api/pools/[id]/score.ts:209-218` and again at `277-286`. `resolveMilestonesAndNotify` is called once synchronously with `sendNotifications: false`, then a **second** complete pass is scheduled via `waitUntil`. Each pass does a contests read, up to 4 `square_assignments` lookups, 4 upserts, a resolutions select, and a `public_board_snapshots` rewrite.

On a finished board with 30 viewers, `game_state === 'post'` makes the fresh path true forever: roughly 60 resolver passes per minute, ~1,200 redundant database operations per minute per board, indefinitely, including a `winner_history` write that rewrites identical data every time.

**Requirements:**

1. The resolver runs **at most once per score snapshot change**, not once per request. Gate it on the snapshot id or version having advanced.
2. Eliminate the duplicate pass. One invocation per snapshot change, period.
3. When all four milestones are resolved and the game is `post`, the resolver is permanently skipped for that board.
4. The `winner_history` / `public_board_snapshots` write happens only when the computed content actually differs from what is stored.
5. A finished board with 100 concurrent viewers performs **zero** resolver work.

**Acceptance criteria:** Instrumented test asserting the resolver executes exactly once across 50 sequential GETs with an unchanged snapshot, and zero times on a fully-resolved `post` board.

---

### T3.2 — Fix score polling stability

**Defect:** `hooks/useLiveScoring.ts:182,185-196`. `fetchLive` is memoized on the entire `game` object, and the polling effect lists `fetchLive` in its deps and calls `fetchLive()` immediately on every run. Any new `game` identity tears down the interval, builds a new one, and fires an immediate fetch. An organizer editing the board while the game is live — title, payouts, square names — produces a new `game` object per `setGame`, potentially per keystroke, so the score endpoint is hit per keystroke and the 60-second interval never elapses. Each of those requests also runs the T3.1 server work.

Second defect at the same site: `initialWinnerHistory` defaults to a fresh `[]` (line 25) and is a bare dependency of the effect at lines 63-65. Any caller that omits it, or passes an inline array literal, gets `setWinnerHistory` on every render — a "Maximum update depth exceeded" render loop.

**Requirements:**

1. `fetchLive` depends only on the **identity fields it actually needs** — board id, external event id, scoring mode — not the whole `game` object.
2. The polling interval is not torn down by unrelated state changes.
3. Editing board content while the game is live produces **zero** additional score requests.
4. `initialWinnerHistory` is stabilized (ref or deep-compare) so an inline array cannot cause a render loop.
5. Polling stops on `document.hidden` and resumes on visibility, and stops permanently at Final. (Partly present; verify and test.)

**Acceptance criteria:** Test simulating 40 rapid `setGame` calls during a live game asserts exactly one score fetch within the interval window. Test passing an inline `[]` on every render asserts no state-update loop.

---

### T3.3 — Gate `scoreTestMode`

**Defect:** `functions/api/pools.ts:125-143`. `scoreTestMode` comes straight off the request body with no role, flag, or environment gate. Setting it to `true` unlocks board creation against the 5 most recently completed NFL games. A user can create a board on a finished game, activate it, publish it, share it — and the first score poll immediately returns `post`, resolves all four milestones at once, and fires winner emails for a game whose outcome was public before the squares were sold.

**Requirements:**

1. `scoreTestMode` is honored **only** when a server-side environment flag permits it, and that flag is off in production.
2. Additionally require an allowlisted owner id. Two independent gates.
3. When the gate is closed, the field is ignored silently — no error that confirms the feature exists.
4. Any board created in test mode is permanently flagged and displays an unmissable synthetic-data label on every public surface. `PRODUCT.md` requires demonstration data to be labeled when it could be mistaken for real activity.
5. Test-mode boards never send winner email to any address.

**Acceptance criteria:** With the flag off, a `scoreTestMode: true` request behaves exactly as `false`. With the flag on and a non-allowlisted owner, the same. With both, the board is created, flagged, labeled, and email-suppressed.

---

### T3.4 — Decide the realtime question

**Finding:** `DESIGN.md` and `tasks/todo.md` both list Supabase realtime broadcast as required. It does not exist anywhere in the codebase — a repository-wide search for `channel(`, `postgres_changes`, and `removeChannel` returns zero results outside `node_modules`. Viewer freshness is 60-second polling only.

**This is a product decision, not a defect. STOP and ask the product owner** before building anything.

The two options:

- **Ship with polling.** 60 seconds is acceptable for football squares — scores change every few minutes, not every second. Zero new infrastructure. Requires only that the UI never promise faster than it delivers, and that `PRODUCT.md`, `DESIGN.md`, and `tasks/todo.md` are amended to say polling.
- **Build realtime.** Genuinely faster viewer updates and lower load at high viewer counts, but it is a new subsystem with its own failure modes: connection lifecycle, reconnect, RLS on the publication, and a polling fallback that must still exist for when the socket drops.

If polling is chosen, the required work is: remove the realtime claims from all three documents, add an explicit "updates about every minute" statement to the viewer UI, and close the corresponding `tasks/todo.md` items as deliberately deferred.

---

### Phase 3 exit gate

Full verification gate plus browser suites. A documented load observation: one finished board, 50 simulated concurrent viewers, resolver invocations counted at zero. **STOP and report.**

---

## 6. Phase 4 — Verification and launch

### T4.1 — Complete the outstanding verification checklist

The following items in `tasks/todo.md` §6 are still open and must be closed with evidence:

- Clean-install dependencies and build from a clean checkout-equivalent state
- Unit, migration, RLS, API, webhook, and concurrency tests
- Two-context full-stack flow: signup → create → share → viewer opens → manual score → winner update
- Stripe test-mode checkout, webhook, activation, and retry scenarios
- Desktop, tablet, and phone Playwright coverage
- Keyboard, focus, accessible-name, reduced-motion, contrast, and touch-target checks
- Landing motion phases, reverse scrub, pin release, post-hero flow
- Canonical URLs, redirects, OG assets, sitemap, robots, article metadata

### T4.2 — Dependency posture

`npm audit --omit=dev` reports a high-severity React Router advisory scoped to the unstable RSC mode. GridOne is a client-side SPA and does not enable that code path. React Router lists 8.3.0 as the patched line.

**Requirement:** Either upgrade to the patched major with full regression coverage, or write a dated, signed exception in `tasks/todo.md` stating the reasoning and a review date. Do not leave it undocumented.

### T4.3 — Copy consistency

Tracked marketing, documentation, application copy, and schema comments must consistently describe the launch offer as **$4.99 one-time for up to 20 boards**. Keep a focused corpus check so stale price or minimum-board claims cannot return.

### T4.4 — Production organizer smoke test

The standing go/no-go in `tasks/todo.md` holds paid acquisition until one production organizer identity completes: create → publish → viewer → manual score → notification → checkout session → entitlement. Complete it, with a real Stripe **test-mode** charge if a test-mode key can be swapped in, otherwise with explicit owner approval for a real $4.99 charge that is then refunded — which also exercises T1.3.

### T4.5 — Launch gate

Paid signup opens only when all of the following are true:

- Phases 1, 2, and 3 shipped to production
- T4.4 complete
- A refund has been executed end to end and the entitlement observed to revoke
- An abuse test has been run against the production subscribe endpoint and observed to throttle

---

## 7. Phase 5 — Design refresh

**This phase amends `DESIGN.md`.** The current file states an explicit invariant at `src/index.css:116`: *"0px radius everywhere, no shadow, no gradient, no blur, no translucency. Depth is opaque planes + 3px key lines."* The product owner has decided to soften this. Update `DESIGN.md` to match — do not leave the code and the design document contradicting each other.

**Preserved without exception:** the palette (cardinal, cardinal-deep, gold, gold-deep, broadcast white, newsprint, night, chyron, live green), the semantic color meanings (live green means a game is in progress; gold means settled or committing), the phase system, the one-horizon/one-artifact/one-action composition rule, and every accessibility requirement.

### T5.1 — Corner radius system

**Decision:** soft, not round.

**Requirements:**

1. Add three tokens to `src/index.css`:

```css
--gridone-radius-control: 8px;   /* buttons, inputs, selects, chips, tabs */
--gridone-radius-surface: 12px;  /* slabs, cards, dialogs, panels */
--gridone-radius-grid: 0px;      /* board cells and axis headers — unchanged */
```

2. Replace every hardcoded `border-radius: 0` in `src/index.css` with the appropriate token. There are occurrences at lines 250, 314, 618, 691, 875 and elsewhere — sweep the whole file, do not fix only the listed lines.
3. Replace the 83 `rounded-none` utility usages across `components/` and `pages/` with the token-backed classes.
4. **The 10×10 board keeps 0px.** It is the product's instrument and its precision is the point. Cells, axis digit headers, and the grid frame stay sharp. This is a deliberate contrast, not an oversight — document it in `DESIGN.md`.
5. Nothing becomes a pill. No `border-radius: 999px` anywhere in this phase.

**Acceptance criteria:** Zero hardcoded `border-radius: 0` outside the board grid rules. Zero `rounded-none` in `components/` and `pages/` outside the board. A visual diff screenshot set at desktop and phone widths, before and after, attached to the task record.

### T5.2 — Lighten the buttons

**Current state:** `.oa-btn` at `src/index.css:240-255` is `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.08em`, `font-size: 0.8125rem`, `padding: 18px 32px`. Every button in the product shouts.

**Requirements:**

1. **Primary actions keep the uppercase cue treatment.** `DESIGN.md` defines short uppercase cue labels as part of the system, and the one-primary-action-per-phase rule means there is exactly one of these per screen. Reduce its padding to `14px 26px` and letter-spacing to `0.05em`.
2. **Secondary, ghost, and tertiary buttons move to sentence case,** `font-weight: 600`, no letter-spacing, `13px 20px` padding. These are the buttons that appear many-per-screen and cause the heaviness.
3. Minimum target stays **44×44 CSS pixels**. Where reduced padding drops below it, add `min-height: 44px` rather than restoring padding.
4. Focus treatment is unchanged — the 3px ink rule, inverting to gold on dark and cardinal grounds, is correct and accessible. Do not touch it.
5. Hover states keep their current color logic. Replace the `inset 3px 0 0` box-shadow trick on `.oa-btn-primary:hover` with a border-radius-compatible treatment that does not clip against the new corners.

**Acceptance criteria:** Every interactive control measures ≥44×44 rendered. Contrast ratios re-verified at actual rendered size. Existing Playwright touch-target assertions still pass.

### T5.3 — Warm the inputs

**Current state:** `.oa-input` at `src/index.css:314-325` is a bare `broadcast-white` fill with `inset 0 0 0 1px ink` — a hard black hairline box — and a focus state that adds an asymmetric `inset 3px 0 0 cardinal` leading rule.

**Requirements:**

1. Fill becomes a soft neutral derived from the existing palette — `color-mix(in srgb, var(--color-newsprint) 40%, white)` — rather than flat white. No new colors.
2. The border drops from full-strength ink to `color-mix(in srgb, var(--color-ink) 24%, transparent)` at rest. It must still meet the 3:1 non-text contrast minimum against the input's own fill; verify, do not assume.
3. Focus keeps cardinal as the signal but renders as a full 2px cardinal border plus a 3px cardinal-at-20% halo, replacing the asymmetric leading rule.
4. Error states use cardinal **plus** an icon and explicit text. Never color alone. This is a hard `DESIGN.md` rule.
5. Placeholder text meets 4.5:1 against the new fill. Placeholders never replace labels.
6. Disabled inputs are visually distinct without relying on contrast reduction alone.

**Acceptance criteria:** Contrast audit table in the task record covering rest border, focus border, placeholder, entered text, and error text against the new fill. All pass at rendered size.

### T5.4 — Introduce one elevation level

**Current state:** the system bans shadow entirely. Depth is opaque planes plus 3px key lines. The owner finds this too flat.

**Requirements:**

1. Add **exactly one** elevation token. Not a scale — one.

```css
--gridone-elevation-raised: 0 2px 8px rgba(14, 15, 18, 0.10),
                            0 1px 2px rgba(14, 15, 18, 0.06);
```

2. It applies to **three things only**: modal dialogs, the sticky organizer header, and floating controls that overlap the board (zoom, reset, find). Nothing else.
3. **Never on the board itself, board cells, phase horizons, or instrument slabs in the normal document flow.** Slabs stay opaque planes with key lines. That is the system's signature and it stays.
4. No gradients. No blur. No translucency on content surfaces. Those bans remain in force — the owner's note was about flatness, and one honest elevation level fixes flatness without turning the product into glassmorphism.
5. It must survive `prefers-reduced-transparency` and high-contrast mode without losing the boundary — the key line stays underneath the shadow, so removing the shadow leaves a legible edge.

**Acceptance criteria:** A grep proving `--gridone-elevation-raised` is referenced in at most three rule blocks. Screenshots of a dialog, the sticky header, and the board's floating controls at desktop and phone.

### T5.5 — Update the design documentation

**Requirements:**

1. Amend the `src/index.css:116` invariant comment to state the new rules accurately.
2. Amend `DESIGN.md` §Components with the radius tokens, the button hierarchy, the input treatment, the single elevation level, and an explicit statement that the board grid stays sharp **on purpose**.
3. Add a short "what we deliberately did not do" note: no pills, no gradients, no blur, no multi-level shadow scale. This is what stops the next change from drifting further.

### Phase 5 exit gate

- Full verification gate plus browser suites on Chromium and WebKit at desktop, tablet, and phone widths.
- Accessibility re-verification: contrast at rendered size, 44×44 targets, visible focus on every control, keyboard equivalence, reduced-motion behavior.
- Before/after screenshot set for the landing page, organizer Fill view, organizer Draw view, viewer phone view, and one dialog.
- **STOP.** Product owner reviews the screenshots before any deploy.

---

## 8. Open decisions requiring the product owner

| # | Decision | Blocks | Recommendation |
|---|---|---|---|
| 1 | Realtime vs polling (T3.4) | Phase 3 exit, doc accuracy | Ship with polling. 60s is right for squares. Amend the three docs. |
| 2 | React Router major upgrade vs documented exception (T4.2) | Phase 4 | Documented exception now, upgrade after the season. |
| 3 | Real $4.99 charge for T4.4, refunded afterward | Phase 4 | Do it. It is the only way to prove the refund path, and it is $4.99. |
| 4 | Whether a revoked entitlement should also unpublish boards (T1.3) | Phase 1 | No. Viewers must never lose a board because of an organizer's payment dispute. |

---

## 9. Sequencing summary

| Phase | Content | Gate |
|---|---|---|
| 0 | Verify three RPC assumptions | STOP — report findings, amend spec |
| 1 | Money and abuse blockers (T1.1–T1.7) | STOP — required before paid signup |
| 2 | Game-day correctness (T2.1–T2.4) | STOP — required before the season |
| 3 | Load and efficiency (T3.1–T3.4) | STOP — includes the realtime decision |
| 4 | Verification and launch (T4.1–T4.5) | Launch gate |
| 5 | Design refresh (T5.1–T5.5) | STOP — owner reviews screenshots |

Phase 5 is independent of Phases 1–3 and can run in parallel by a second agent on a separate branch, provided it touches only `src/index.css`, `DESIGN.md`, and the class names in `components/` and `pages/`. It must not touch `functions/`, `hooks/`, `supabase/`, or `utils/`.

---

## 10. What is already solid — do not "improve" it

The review verified these. They are correct and they are load-bearing. Changing them without cause is a regression.

- **Ownership enforcement.** Every owner-scoped read and write pairs a server-verified JWT with `.eq('owner_id', <token user id>)`. The PUT path at `functions/api/pools/[id].ts:306-309` correctly uses the anon key with the caller's JWT so RLS applies, and only escalates to service-role for the revision-checked RPC, passing `p_owner_id` from the token rather than the request body. No path was found where a non-owner writes to another organizer's board.
- **The public viewer projection.** `functions/api/pools/[id].ts:251-284` reads only `public_board_snapshots` and returns a hand-listed column set. No purchaser email, owner id, entitlement status, order, or seller attribution is reachable from the share-code path. Anonymous viewers cannot enumerate UUID boards.
- **Webhook payment verification.** The line-item re-fetch against Stripe checking price ID, `amount_total === 499`, and currency — plus `client_reference_id === metadata.order_id` — means a forged or price-tampered session cannot grant entitlement. The signature check uses `constructEventAsync` on the raw body, correctly.
- **Token handling.** Verification tokens are 288 bits of `crypto.randomUUID()`, stored only as SHA-256, matched atomically in the UPDATE's WHERE clause with a 24-hour freshness bound. The unsubscribe HMAC comparison is constant-time. Unverified addresses are never sent winner mail.
- **Provider identity validation.** `fetchExactEventScore` refuses a payload whose event id, either team abbreviation, or kickoff instant does not match the linked board. This is a real defense against showing the wrong game, and it is the thing that makes the automatic-score claim honest.
- **The refresh lease.** Per-board leasing, released in a `finally`, correctly collapses many viewers into one external lookup and prevents a thundering herd.
- **Score input validation.** Bounds-checks totals, cross-foots quarter scores against the total, and validates state and period before persistence.

---

*End of spec.*
