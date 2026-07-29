# GridOne Friday launch

## Delegated local test-board fill — July 28, 2026

- [ ] Start or locate the dedicated local GridOne test instance; do not interact with an unrelated listener.
- [ ] Inspect the active local Football Squares board and select an appropriate editable test board.
- [ ] Assign every currently available square using unmistakably fake participant data.
- [ ] Reproduce and diagnose organizer assignment-control scrolling around Paid, Unpaid, Assign, and Assign Square.
- [ ] Implement and verify a durable UI fix across relevant viewport sizes and normal scrolling.
- [ ] Verify the completed board has no remaining available squares and record the result.

### Delegated test-board review

- Blocked before assignment: port 5173 is an unrelated private-team app, while the dedicated GridOne instance on 5199 reaches the public landing page without an authenticated organizer or editable test board. Do not apply the pending migration, seek credentials, or use a production workaround. No square data or product code was changed.
- UI investigation was scoped to `AdminPanel.tsx`: the organizer controls are currently normal-flow content and the wide grid is only horizontally scrollable. Full reproduction at a real organizer board is migration/identity-dependent and was not performed after the explicit stop instruction.

## Full user-workflow audit and repair

- [x] Inventory organizer, participant, viewer, scoring, notification, checkout, entitlement, and legacy-board workflows.
- [x] Add end-to-end coverage for every locally testable workflow and failure state.
- [x] Fix every reproducible workflow defect found during the audit.
- [x] Re-run unit, API, migration, build, typecheck, accessibility, responsive, and browser verification.
- [x] Record fixed defects, passing evidence, and the remaining production-only test boundary.

### Full workflow review

- Fixed the public viewer lock inversion, exact-name Find My Squares matching, protected-route return paths, clipboard false-success, dashboard false-empty errors, and paid-return recovery.
- Removed legacy board-password storage; organizer authority now comes only from the authenticated account session.
- Draft saves are serialized and flushed before activation, navigation, and publish. Title/payout columns stay synchronized, and published grid controls are keyboard-operable and immutable.
- Publishing is one database transaction through migration `010`; manual score commits and Manual→Auto transitions are atomic through migration `011`.
- New boards require one upcoming ESPN event. Hidden completed-game tests are bounded to the five most recent finals; legacy unlinked boards remain manual-only.
- Paper scanning now returns safe retryable errors for network and malformed-provider failures, while blank-board creation remains available.
- Production smoke found and fixed a manual-scoring UI edge case: manual mode now seeds the last valid score, shows Scheduled/Q4/OT consistently, and preserves overtime Final as period 5.
- `npm test -- --run`: 109/109 tests pass across 18 files, including schedule, scoring, persistence, commercial, notification, and paper-scan endpoints.
- `PLAYWRIGHT_PORT=5199 npx playwright test`: 14/14 browser workflows pass, including return-to-login, keyboard/mobile game selection, creation, organizer save-before-publish, public viewer, exact-name lookup, and invalid links.
- `npm run build`, strict `tsc --noEmit --noUnusedLocals --noUnusedParameters`, and `git diff --check`: pass.
- Migrations `000` through `011` apply in disposable PostgreSQL. Injected manual-score audit failure rolls back mode, snapshot, and public projection; manual and automatic success paths pass.
- Production migrations `009`–`011` were applied July 29, 2026 to the exact `GridOneApp` project (`illqymckwqiawdwxhwcy`). The application release and authenticated production smoke remain pending. A live Stripe charge remains separately approval-gated.

## Scheduled-game binding implementation

- [x] Add a server-side ESPN schedule/event normalizer and upcoming/completed games API.
- [x] Replace freeform team/date creation with a required scheduled-game picker and hidden five-game score-test mode.
- [x] Persist and update canonical game identity atomically; protect published matchups.
- [x] Fetch automatic scores by exact external event ID with identity validation and manual/last-score fallback.
- [x] Add deterministic recorded-payload, API, migration, and browser coverage.
- [x] Run the full local test/build/diff verification suite and document results below.

### Scheduled-game binding review

- `npm test -- --run`: 47/47 tests pass across schedule normalization, exact-event scoring, persistence, picker states, winner logic, and existing behavior.
- `PLAYWRIGHT_PORT=5199 npx playwright test`: 8/8 browser checks pass, including authenticated creation and hidden completed-game mode. The explicit port prevents another local project already using 5173 from being mistaken for GridOne.
- `npm run build`, `npx tsc --noEmit`, and `git diff --check`: pass.
- Full migrations `000` through `009` apply cleanly to disposable PostgreSQL 17 with Supabase auth/role stubs; the new RPC and published-identity trigger are present.
- Live read-only ESPN verification returned five real completed franchise games with exact IDs, kickoffs, final totals, and quarter/OT scoring. Pro Bowl AFC/NFC pseudo-teams are excluded.
- Production migration 009 and deployment were intentionally not applied in this local implementation turn.

Target: public soft launch on Friday, July 31, 2026.

Production boundary: implementation and local/test-mode verification are authorized. Stop for fresh action-time approval before applying production Supabase migrations, changing the live Stripe price, enabling live Stripe payments, or deploying Cloudflare Pages.

Production launch approval received July 28, 2026. Approved account boundary: GridOne Supabase, GridOne Cloudflare Pages/custom domains, and the Parkside Advisory Group Stripe account.

## Production launch execution

- [x] Apply scheduled-game, atomic-publish, and atomic-scoring migrations `009`–`011` to project `illqymckwqiawdwxhwcy`.
- [x] Audit and restrict the six new function ACLs to `postgres`/`service_role`; Supabase's explicit default `anon` and `authenticated` grants required revocation beyond `PUBLIC`.
- [x] Verify access to Supabase project `illqymckwqiawdwxhwcy`; do not substitute another project. Verified healthy as `GridOneApp | Sideline Hacks` in the Codex in-app browser; Safari is authenticated to a different Supabase account.
- [x] Confirm the pre-reset recovery boundary. The free Supabase project reported no existing backups; the owner confirmed its contents were test-only and approved a clean start.
- [x] Reset the approved GridOne database and apply migrations `000` through `008`.
- [x] Verify production RLS, RPCs, share-code generation, passcode removal, and published-board lock.
- [x] Verify the Parkside Advisory Group Stripe account and live mode.
- [x] Create or reuse one live `$4.99` GridOne 2026 season-pass price. Created `price_1TyFoqFwSi8ogxSrY9KvKd70` under product `prod_UyCDIvzdzv0KAe`.
- [x] Configure the live `checkout.session.completed` webhook for `https://www.getgridone.com/api/stripe/webhook`. Created active destination `we_1TyG4zFwSi8ogxSrz4vF0clc`; its signing secret is stored encrypted as Cloudflare production `STRIPE_WEBHOOK_SECRET`.
- [x] Configure Cloudflare production variables and secrets without exposing values. Verified Pages project `grid-one`, GitHub source `mora090410-coder/grid-one`, production branch `main`, and both custom domains. Added encrypted `EMAIL_PROVIDER_API_KEY`, `CRON_SECRET`, and `NOTIFICATION_TOKEN_SECRET`; `EMAIL_FROM` is source-controlled as `GridOne <updates@parksideag.com>`.
- [x] Deploy the exact reviewed source revision to the GridOne Pages project. Production revision `0c5b229` completed successfully in Cloudflare Pages.
- [x] Verify `getgridone.com` redirects to `www.getgridone.com` while preserving path/query. Confirmed 301 for `/privacy?source=final-smoke` to the identical path and query on `www`.
- [ ] Run production organizer, viewer, scoring, notification, checkout, webhook, and entitlement smoke tests. Public viewer/demo, API rejection paths, and unsigned-webhook handling pass; the account-backed organizer and notification flow still needs an explicitly selected production test identity. No live charge will be submitted without separate financial approval.
- [x] Record final production go/no-go evidence below.

## Locked product decisions

- [x] NFL-only for launch.
- [x] One signed-in organizer owns and edits each board.
- [x] Viewers are read-only; GridOne does not collect or distribute square money.
- [x] Rebuild the test-only Supabase project from a clean canonical schema.
- [x] Use UUID primary keys with separate short public share codes.
- [x] Remove legacy board passcodes and recovery endpoints.
- [x] Preserve and merge the current uncommitted On Air redesign.
- [x] Use privacy-reduced names in the glanceable mobile board, with deliberate detail disclosure.
- [x] Keep automatic scoring as beta with a reliable organizer manual override.
- [x] Use `www.getgridone.com` as canonical and preserve paths/queries from the apex redirect.
- [x] Launch offer: $4.99 once for up to 20 activated boards during the 2026 football season.
- [x] Repeat purchases do not stack additional 2026 allowances.
- [x] Replace the prior On Air visual world with **Game-Day Horizon** while preserving the cardinal/gold/cool-neutral/ink/live-green palette.
- [x] Use approved composition **C — Split Stage** as the shared organizer/viewer signature: calm context above, exact board below, one phase horizon across both.
- [x] Treat generated comp content as composition only; do not ship invented teams, payout amounts, percentages, probabilities, or real-time guarantees.

## 0. Approved experience contract

- [x] Product interview and greenfield specification completed.
- [x] Existing-code gap assessment completed.
- [x] Impeccable dual critique completed and archived.
- [x] Game-Day Horizon visual direction selected and documented.
- [x] Three visual compositions generated and reviewed.
- [x] Composition C selected by the product owner.
- [x] Translate Split Stage into semantic responsive HTML/CSS/SVG; never rasterize the comp as product UI.
- [x] Desktop: shared horizon with personal/live context and the exact board in one field.
- [x] Mobile: score authority → Find My Squares → current winner/scenarios → pan/zoom board → resolved winners.
- [x] Organizer: preserve the same horizon grammar across Fill → Reconcile → Draw → Preview → Go Live.

## 1. Database and authorization foundation

- [x] Replace the incomplete migrations with a clean, reproducible schema that creates `contests` before dependents.
- [x] Store UUID IDs internally and generate a unique short `share_code` for public links.
- [x] Separate public board data from private organizer/payment fields at the RLS/API boundary.
- [x] Make Supabase account ownership the only board-administration authority.
- [x] Remove passcode hashes, salts, passcode login, and recovery-code flows.
- [x] Reject assignment or axis changes after publication in both the API and database.
- [x] Propagate authenticated JWTs for user-scoped writes.
- [x] Add atomic/versioned board updates to prevent stale autosaves overwriting newer work.
- [x] Add a canonical score snapshot and source/freshness fields.
- [ ] Add realtime publication/policies for read-only viewer board and score updates.
- [x] Add migration and RLS tests for anonymous viewer, owner, and non-owner behavior.

## 2. Server-authoritative NFL scoring

- [x] Remove Gemini API usage and credentials from the browser bundle.
- [x] Add an authenticated/board-scoped Cloudflare score endpoint.
- [x] Allow at most one external score refresh per board freshness window.
- [x] Validate, normalize, and persist all Gemini score responses before rendering.
- [x] Include source, fetched time, freshness, game state, and failure details.
- [x] Stop automatic refresh after Final and avoid background/inactive-tab polling.
- [x] Prevent stale async results from overwriting manual mode or newer snapshots.
- [ ] Broadcast persisted score changes to all open viewers through Supabase realtime.
- [x] Keep organizer manual quarter scores authoritative when manual override is enabled.
- [ ] Add pregame, live, stale, offline, manual, overtime, and Final tests.

## 3. Payments and 2026 entitlements

- [x] Change launch copy and configuration from $14.99 to $4.99.
- [x] Model one non-stacking 2026 entitlement per organizer with a 20-board allowance.
- [x] Bind checkout creation to the authenticated owner and an existing owned board.
- [x] Verify Stripe price and payment state server-side.
- [x] Make checkout completion and entitlement delivery atomic/idempotent.
- [x] Make board activation atomic so concurrent requests cannot exceed the allowance.
- [x] Provide recoverable paid-but-processing and entitlement-error states.
- [ ] Add webhook, retry, ownership, concurrency, and allowance tests.

## 4. Viewer and organizer launch UX

- [x] Render an explicit invalid/unavailable-board state instead of a plausible empty board.
- [x] Add mobile pan/zoom guidance, sticky axes, and tap-accessible participant detail.
- [x] Use privacy-reduced names in board cells without breaking Find My Squares.
- [x] Bring primary touch targets to at least 44×44 CSS pixels.
- [x] Add semantic dialogs, accessible names, Escape handling, focus containment, and focus return.
- [x] Render completed winners from immutable milestone resolutions rather than recalculating history from the latest score.
- [x] Make scoring source, freshness, beta status, and manual override crystal clear.
- [x] Add a real 404 route and preserve intended redirect/share behavior.
- [x] Finish Terms, Privacy, Paid, splash, and critical CSS in the Game-Day Horizon system.
- [x] Use fixed policy publication dates rather than the visitor's current date.
- [x] Add the missing Open Graph image and verify social metadata.
- [ ] Generate crawlable metadata/static output for article routes.

## 5. Runtime and dependency hardening

- [ ] Upgrade or replace vulnerable production dependencies and re-run `npm audit --omit=dev`.
- [x] Lazy-load organizer/admin, article, and landing-only runtime where practical.
- [ ] Keep one Lenis owner and preserve all reduced-motion behavior.
- [x] Correct `.env.example`, Cloudflare build/runtime variable documentation, and local process lifecycle.
- [x] Document canonical domain redirects and production configuration without secrets.

## 6. Verification

- [ ] Clean-install dependencies and build from a clean checkout-equivalent state.
- [x] Apply the full schema to a fresh local/test Supabase database.
- [ ] Run unit, migration, RLS, API, webhook, and concurrency tests.
- [ ] Run a two-context full-stack flow: signup → create → share → viewer opens → manual score → realtime winner update.
- [ ] Run automatic-score tests with recorded fixtures; do not depend on a live NFL game.
- [ ] Run Stripe test-mode checkout/webhook/activation and retry scenarios.
- [ ] Run desktop, tablet, and phone Playwright coverage.
- [ ] Run keyboard, focus, accessible-name, reduced-motion, contrast, and touch-target checks.
- [ ] Verify landing motion phases, reverse scrub, pin release, and post-hero flow.
- [ ] Verify canonical URLs, redirects, OG assets, sitemap, robots, and article metadata.
- [ ] Verify `npm audit --omit=dev`, bundle output, console, network, and `git diff --check`. Bundle and diff pass; audit retains the React Router RSC-only advisory and browser network verification is blocked locally.

## Review

Local implementation review, July 28, 2026:

- `npm run build`: pass. Initial app chunk is 15.96 kB (5.52 kB gzip); framework, Supabase, motion, viewer, organizer, landing, and article routes are split.
- `npm test -- --run`: pass, 19/19 tests across fixed-axis number drawing, immutable winner-history projection, notification delivery leases, canonical retry identity, winner logic, score validation, and retry behavior.
- Fresh Postgres 17 migration chain: pass; canonical share code generated, required RPCs present, legacy passcode columns absent, and the published-board integrity trigger installed.
- Cloudflare Pages Functions compilation: pass.
- Impeccable finish review: pass after publication-retry, immutable-history, notification-lease, hook-order, touch-target, and published-board integrity fixes.
- `git diff --check`: pass.
- `npm audit --omit=dev`: two high findings remain under React Router's optional RSC mode. GridOne is a client-side SPA and does not use RSC, but the published package advisory prevents a clean audit until an upstream fixed release is available.
- Open Graph asset: `public/og-image.jpg`, verified at 1200×630.
- Local rendered browser QA remains pending because the browser tool rejected the loopback URL under its URL policy. Do not substitute a different browser surface for that blocked verification.
- Production Supabase migration and live Stripe price/webhook configuration are now complete; Cloudflare source deployment is still pending.
- Production Supabase rebuild, July 28, 2026: the first transaction rolled back cleanly when Supabase's extension schema exposed a `gen_random_bytes` search-path portability bug. `000_contests_foundation.sql` now uses PostgreSQL UUID randomness; the full chain then passed against the Supabase PostgreSQL image and committed in project `illqymckwqiawdwxhwcy`.
- Production schema verification: 20 public tables, 14 `gridone_*` functions, RLS enabled on every public table, zero legacy passcode columns, zero test auth users, valid eight-character share-code generation, checkout/activation/score-lease RPCs present, and the published-board integrity trigger installed.
- Resend/Cloudflare launch configuration, July 28, 2026: created a domain-scoped, sending-only `GridOne Production` Resend key for `parksideag.com`; revoked the initially exposed key and verified exactly one replacement remains. Cloudflare production now lists encrypted `EMAIL_PROVIDER_API_KEY`, `CRON_SECRET`, and `NOTIFICATION_TOKEN_SECRET`.
- Production deployment, July 28, 2026: Cloudflare Pages revision `0c5b229` reports success. Safari independently rendered the landing page, sign-in page, and `/demo`, proving the application booted past the splash. The earlier empty-root observation was isolated to the Codex in-app browser rather than the deployed application.
- Public production smoke, July 28, 2026: `/`, `/demo`, `/terms`, `/privacy`, `/paid`, and `/api/health` return 200. The public demo uses explicit `Demo Player` labels, exposes source/freshness, presents current-quarter arithmetic scoring scenarios, and labels its fixture synthetic. Apex canonicalization preserves path/query; unauthenticated billing returns 401, invalid board and score references return 404, and an unsigned Stripe webhook returns 400.
- Final local verification against the deployed source: 20/20 tests pass across six files; production build passes; `git diff --check` passes. `npm audit --omit=dev` still reports React Router's high-severity unstable-RSC-only advisory. GridOne uses the client-side SPA APIs, not React Server Components, so the vulnerable code path is not enabled; React Router lists 8.3.0 as the patched line and that major upgrade remains a post-launch hardening item.
- Go/no-go: **go for the public marketing/demo surface; hold organizer onboarding and paid acquisition until one production organizer identity completes create → publish → viewer → manual score → notification → checkout-session → entitlement verification.** A real Stripe charge is outside this smoke test unless separately approved at action time.
- Scheduled-game production migration, July 29, 2026: migrations `009`–`011` applied successfully. Verification found all six expected functions and the enabled `gridone_protect_published_game_identity` trigger. A production-only ACL audit exposed Supabase's explicit default execute grants to `anon` and `authenticated`; the migration source and live ACLs were corrected so the six functions are callable only by `postgres` and `service_role`.
- Authenticated scheduled-game smoke, July 29, 2026: created QA board `46117e9f-118b-4c33-a1c0-0fd8274b1064` for ESPN event `401772988` (SEA at NE). Automatic scoring returned the exact ESPN link, 29–13 score, Final state, and canonical February 8 kickoff. Testing then exposed a manual-score seeding/period-display defect; the fix adds regulation/overtime state tests and raises the suite to 113/113 before redeployment.
- Repeating the manual-score path exposed a stale-revision save failure that incorrectly replaced the organizer with a board-unavailable screen. Save conflicts no longer poison the board-load state; the API returns the current revision, the retained draft can be retried explicitly, and 115/115 tests now cover serialized saves plus conflict recovery.
- The first production retest after conflict recovery exposed a circular lazy chunk between `BoardView` and `AdminPanel`: every referenced asset returned 200, but Safari rejected the dynamic organizer import. Removing that boundary moved the same failure to the route-level `BoardView` import, proving the issue affected this full feature graph rather than one missing file. The organizer/viewer graph now loads synchronously from the application entry so creation, demo, viewer, and organizer routes do not depend on either fragile dynamic boundary.
- Production manual-to-auto testing exposed a Final-state transition bug: clearing the manual snapshot left the hook's internal Final guard set, so Auto was enabled but could not perform the one provider refresh needed to reclaim authority. A missing snapshot now resets that guard; the regression test verifies a final manual score transitions back to the canonical ESPN snapshot.
- A second fresh-shell test proved the chunk failure was deployment-wide rather than organizer-specific: an already-open shell later requested a removed hashed Create chunk. All core product routes now ship with the application entry so a loaded session can move among landing, authentication, dashboard, creation, board, paid, legal, and not-found workflows without requesting a deployment-specific route chunk. Editorial article routes remain on-demand.
