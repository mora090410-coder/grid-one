# Family / seller workflow repair — local verification

Date: 2026-11-07 (America/Chicago). Status: implemented and verified locally; NOT committed, pushed, migrated in production or deployed.

Plan: [family-buyer-workflow-repair.md](plans/family-buyer-workflow-repair.md).

## Findings and changes

1. **Family saves:** reproduced disabled Save for an availability-only edit on a blank allocated square. The browser, API and SQL independently rejected empty names. Empty display names are now allowed and stored as canonical `[]`; family labels still cannot be blank. Repeated saves use the returned revision, and conflicts, scope enforcement and failed-save input retention remain intact.
2. **Inventory mismatch:** the seller read and claim RPCs required the first display name to equal the family label. Explicitly offered blank allocations were rejected. Migration 039 changes both predicates together: blank AND explicitly available, or the existing sole-family-name placeholder unless unavailable. Other buyer names are protected regardless of explicit availability. Claims atomically record the buyer and consume availability. Clearing/correcting a name alone does not re-offer a consumed square; availability must deliberately be changed back. No historical record backfill.
3. **Link-generation stall:** source inspection found an unbounded operation across flush, session, fetch and body parsing. Stalled promises at all four steps reproduced indefinite busy state. Added a 15-second whole-operation deadline, network abort, cleanup and late-result guards. Retry sync is deliberate and preserves known links. An unconfirmed rotation hides potentially revoked displayed links and requires sync before another deliberate replacement. **The exact transport/auth cause of Grok's historical production stall was not established.**
4. Organizer unsold summaries now include blank family allocations without treating ambiguous multi-name arrays as placeholders. Public explicit availability remains independent data, not a permission to overwrite buyer names; public and family views explain contradictory offered/name records. No inference of paid status.

## Executed verification

- `npx tsc --noEmit`: PASS; `npm run build`: PASS.
- `npm run test:unit`: **172 files / 1,333 passed**, including final rerun after contract edits.
- `npm run test:integration`: **20 files / 160 passed / 1 existing optional hosted Stripe Sandbox proof skipped**. Disposable PostgreSQL applied the complete migration sequence including 039. Tests cover actual family clearing/offering, persisted seller claims, deliberate re-offer, private payment preservation, scope, link stability/rotation/reassignment, number locking, and one-winner races.
- `PLAYWRIGHT_PORT=5207 npx playwright test --project=chromium --workers=4`: **204 passed**, no retries/skips in the final run.
- Targeted `family-seller-repair`, `family-workspace`, `seller-links` in `webkit` and `phone-webkit`: **16 passed**. These are browser emulations, not physical iPhone testing.
- The connected browser fixture exercises actual React components with stateful intercepted APIs and independent family/buyer/organizer contexts; database behavior is separately exercised with real SQL. This is not a claim that a complete hosted production stack was tested.
- New connected tests cover availability-only save, name entry, clearing, another save, anonymous claim, reload persistence in buyer/family/public/organizer views, exclusion of another family's squares, and explanation of recorded-buyer restrictions. Axe checks found no serious/critical family-editor violations. Phone/desktop screenshots visually inspected for legibility and containment.
- `npm run design:lint`: **0 errors / 5 existing unused-token warnings**.
- `git diff --check`: PASS. Added-line scan (including new files): no hardcoded-secret, eval, shell-true or unsafe-HTML matches. Direct source review; no independent reviewer agent under Anton-only mode.
- `npm audit --omit=dev --audit-level=moderate`: **0 vulnerabilities**. Full audit retains **2 pre-existing high development-only findings**, design CLI → Zod, with no available fix reported. No dependency or lockfile changes; no remediation or release waiver implied.

Observed failed runs are not hidden: RED reproduced family/API empty-name rejection and unbounded busy states; SQL rejected clearing and offered blanks; an early migration guard correctly failed closed due to a mismatched replacement prerequisite. Integration fixture migration-number expectations were advanced to 039. The prior name-only mistaken-claim recovery test was intentionally expanded to require deliberate availability re-offering. Initial new browser tests used incorrect label/hidden-control/singular-button locators, corrected against the actual rendered/source controls without changing application behavior to satisfy them.

## Evidence and protected work

Full Chromium and targeted WebKit ran from an isolated source snapshot so pre-existing screenshot/evidence work could not be overwritten:

`/Users/amm13/.hermes/cache/scratch/gridone-workflow-check-lp7q1df6/`

- `test-results/`: Chromium screenshots; `webkit-test-results/`: targeted WebKit screenshots.
- `verification-manifest.json`: copied source list and protected-artifact checksums.
- Executable application/test/schema/config source hashes matched the tested snapshot after the gates. All **25** pre-existing tracked screenshot artifacts checked remained unchanged during isolated testing. Existing untracked evidence was not edited or staged.
- Scratch evidence is temporary; this report and the plan are the durable repository deliverables.

## Release dependency / remaining acceptance

Migration `supabase/migrations/039_family_seller_workflow.sql` is prepared, not applied remotely. It updates existing functions only; no tables, grants, credentials, pricing, scoring, dependencies or production settings change.

A separately approved release should capture the existing two function definitions and deployment identity for rollback, apply 039 before publishing the matching API/browser artifact, then retest Grok's preserved synthetic board across family save → stable Maple/River links → anonymous claim → organizer/public persisted state. Do not silently clear real buyer names or rewrite historical availability. A rollback restores prior function definitions and prior application/API artifact without deleting claims or rewriting board records.

Residual UI observation: the public viewer's selected-square strip can still show square 1 while filtered details show another square. That is pre-existing selection-versus-filter behavior, not a new claim-state failure; no unrelated redesign was made.

Reusable workflow lesson staged here, not applied as a cross-session policy change: isolate browser evidence generation when repository tests write tracked screenshots; bound the complete async workflow, not only fetch; reconcile unknown mutation outcomes through a stable read/sync rather than blindly retrying a non-idempotent rotation.
