# GridOne Friday launch

Target: public soft launch on Friday, July 31, 2026.

Production boundary: implementation and local/test-mode verification are authorized. Stop for fresh action-time approval before applying production Supabase migrations, changing the live Stripe price, enabling live Stripe payments, or deploying Cloudflare Pages.

Production launch approval received July 28, 2026. Approved account boundary: GridOne Supabase, GridOne Cloudflare Pages/custom domains, and the Parkside Advisory Group Stripe account.

## Production launch execution

- [x] Verify access to Supabase project `illqymckwqiawdwxhwcy`; do not substitute another project. Verified healthy as `GridOneApp | Sideline Hacks` in the Codex in-app browser; Safari is authenticated to a different Supabase account.
- [x] Confirm the pre-reset recovery boundary. The free Supabase project reported no existing backups; the owner confirmed its contents were test-only and approved a clean start.
- [x] Reset the approved GridOne database and apply migrations `000` through `008`.
- [x] Verify production RLS, RPCs, share-code generation, passcode removal, and published-board lock.
- [x] Verify the Parkside Advisory Group Stripe account and live mode.
- [x] Create or reuse one live `$4.99` GridOne 2026 season-pass price. Created `price_1TyFoqFwSi8ogxSrY9KvKd70` under product `prod_UyCDIvzdzv0KAe`.
- [x] Configure the live `checkout.session.completed` webhook for `https://www.getgridone.com/api/stripe/webhook`. Created active destination `we_1TyG4zFwSi8ogxSrz4vF0clc`; its signing secret is stored encrypted as Cloudflare production `STRIPE_WEBHOOK_SECRET`.
- [x] Configure Cloudflare production variables and secrets without exposing values. Verified Pages project `grid-one`, GitHub source `mora090410-coder/grid-one`, production branch `main`, and both custom domains. Added encrypted `EMAIL_PROVIDER_API_KEY`, `CRON_SECRET`, and `NOTIFICATION_TOKEN_SECRET`; `EMAIL_FROM` is source-controlled as `GridOne <updates@parksideag.com>`.
- [ ] Deploy the exact reviewed source revision to the GridOne Pages project.
- [ ] Verify `getgridone.com` redirects to `www.getgridone.com` while preserving path/query.
- [ ] Run production organizer, viewer, scoring, notification, checkout, webhook, and entitlement smoke tests.
- [ ] Record final production go/no-go evidence below.

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
