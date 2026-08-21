# GridOne Product Metrics and Evidence Contract

**Status:** Planning authority
**Created:** 2026-08-20
**Owner:** Product
**Related:** `../PRODUCT.md`, `wayfinder-gridone-production-quality.md`

## North-star outcome

### Successful Game-Day Board Runs through Final

GridOne’s primary outcome is the count and rate of published boards that successfully complete the real game-day job.

A board qualifies only when all of the following are true:

1. The board is published with a scheduled game and one committed set of top/side axis digits.
2. Its public viewer remains available after publication.
3. Its canonical score authority becomes active through validated automatic scoring or explicit organizer manual scoring.
4. Q1, Q2, Q3, and Final are durably resolved exactly once, including any audited corrections.
5. The board reaches Final without an unresolved integrity, publication, or score-authority failure.

A purchase, activation, publication, page view, or notification by itself does not count as a successful run.

## Why this metric

The product promise is not account creation or board publication. It is replacing the paper/spreadsheet/text-chain workflow through the end of game day. This outcome aligns organizer trust, viewer utility, scoring reliability, milestone correctness, and operational recovery.

## Reporting shape

Report both:

- **Count:** successful runs during the reporting period.
- **Completion rate:** successful runs divided by eligible published boards whose scheduled game has reached Final plus the defined resolution grace period.

Do not count upcoming games in the denominator. Define the grace period before implementation so delayed provider Final states are not mislabeled as failures.

Segment only when sample size is sufficient:

- Free, Game Day, Organization
- First board vs repeat board
- Automatic vs manual score authority
- Organizer cohort/source when collected with consent

Never publish percentages from tiny cohorts without displaying the denominator.

## Leading organizer outcomes

1. Draft created → first square assigned
2. First assignment → reconciliation-ready
3. Reconciliation-ready → axis draw committed
4. Draw committed → viewer preview opened
5. Preview → published board
6. Median active time from first edit to publish
7. Blocker recovery rate by phase
8. First published board → repeat board
9. Free allowance exhausted → Game Day checkout started/completed
10. Game Day allowance exhausted → Organization checkout started/completed

These diagnose the journey; none replaces the north star.

## Viewer outcomes

1. Viewer link returns the intended published board
2. Find My Squares opened
3. Name search produces a deliberate result or recoverable no-match state
4. Median time from viewer load to selected squares
5. Selected viewer reaches personalized scenarios
6. Selected viewer reaches/inspects the exact grid
7. Notification opt-in started → verified
8. Winning milestone notification delivered exactly once

The product benchmark remains: a representative phone viewer should find their squares in under ten seconds during moderated testing. Treat this as a target to validate, not an existing production fact.

## Reliability, safety, and quality guardrails

- Wrong-matchup or invalid score accepted: zero tolerance
- Older automatic score overwrites newer/manual authority: zero tolerance
- Duplicate or missing milestone resolution
- Duplicate, missing, bounced, or exhausted notification delivery
- Published viewer unavailable during game window
- Checkout paid without correct entitlement, or entitlement without verified payment
- Public/private data-boundary violation: zero tolerance
- Unrecoverable organizer mutation conflict or data loss: zero tolerance
- Crash-free viewer and organizer sessions
- WCAG, keyboard, touch-target, reduced-motion, 200% zoom, and narrow-phone gate failures
- Support interventions per eligible board and per successful run

A growth improvement that degrades a zero-tolerance guardrail is not accepted.

## Evidence plan before numerical targets

Do not invent polished percentages before baseline evidence exists.

### Qualitative baseline

- Five moderated sessions with target youth-sports fundraiser organizers
- Five phone-based sessions with representative viewers
- Observe task completion, hesitation, terminology confusion, recovery, and requests for help
- Record findings without collecting unnecessary participant or board data

### Production baseline

- First ten real eligible fundraiser boards
- Review the complete organizer funnel and game-day outcome
- Inspect every failed or ambiguous north-star qualification individually
- Establish baseline medians/rates with denominators

### Target-setting gate

Set numerical improvement targets only after baseline review. Targets must include:

- current value and denominator;
- desired value and time horizon;
- measurement definition;
- responsible owner;
- guardrails that may not regress.

## Privacy-minimal instrumentation contract

GridOne currently has durable domain records but no verified product-analytics implementation. Instrumentation is a later, approval-gated implementation slice.

Permitted event data:

- internal board/account identifiers needed for funnel joins;
- event name and server/client timestamp;
- route/surface and lifecycle phase;
- success/failure code;
- device class, viewport bucket, and coarse performance timings;
- tier and scoring authority where relevant.

Prohibited analytics payloads:

- purchaser/display names;
- seller/parent labels;
- email addresses or notification tokens;
- payout descriptions;
- raw uploaded board images;
- raw score-provider payloads;
- full URLs containing secrets or personal query values;
- free-form error text when it could contain user data.

Prefer server-derived outcome events for publication, checkout, milestone, delivery, and Final qualification. Use client events only for interaction questions the domain database cannot answer.

## Proposed event families

Names are provisional until the instrumentation ticket is resolved:

- `board_draft_created`
- `board_first_assignment_completed`
- `board_reconciliation_ready`
- `axis_draw_committed`
- `viewer_preview_opened`
- `board_published`
- `viewer_board_loaded`
- `find_squares_opened`
- `find_squares_resolved`
- `viewer_grid_inspected`
- `notification_verification_completed`
- `milestone_resolved`
- `notification_delivery_succeeded`
- `board_finalized`
- `board_run_qualified`
- `board_run_failed`

Every event requires a schema, owner, production reason, retention period, and test before collection begins.

## Definition of done for measurement

- North-star qualification is computed from durable server-owned facts.
- Denominators exclude games not yet eligible for Final evaluation.
- Event schemas contain no prohibited data.
- Funnel and outcome calculations are covered by deterministic tests.
- Analytics failure cannot block organizer or viewer workflows.
- Privacy and Terms accurately describe collection before activation.
- A board-run failure can be traced to an actionable reason without exposing personal data.
