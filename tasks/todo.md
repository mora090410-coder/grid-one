# Gap remediation — August 1, 2026

Source: `docs/gap-remediation-plan-2026-08-01.md` and the attached owner brief.

Execution boundary: Gaps 4, 1, and 2 were completed locally on top of the PR #9 score-cron revision. On August 1 the owner approved Gap 3's recommended “Open square — see board rules” behavior and explicitly authorized commit, push, production migrations, and deployment. Do not send live email, change payment objects, or mutate production board data beyond applying the reviewed migrations and normal release smoke paths.

## Plan

- [x] Confirm the PR #9 baseline, worktree ownership, migration sequence, and current test baseline; isolate the work on a `codex/` branch without touching unrelated untracked files.
- [x] Gap 4: remove verified-dead payout/landing/scenario code and empty directories, preserve live pricing assertions, rename guest-board draft adoption terminology, and make verification configuration failures visible at the board or in branded HTML.
- [x] Verify Gap 4 with reference scans, strict TypeScript, and focused Vitest coverage before proceeding; the repository-wide suite remains in the final verification gate so it runs against the complete stable tree.
- [x] Gap 1: add RLS-safe migration `021`, owner-only payout-description validation/write support, organizer editing and preview, public snapshot projection, viewer display beside the off-platform disclaimer, and focused regression tests.
- [x] Gap 2: add a single normalized tiered name matcher, human-resolved suggestions/browse fallback, share-code-scoped persisted selection, and focused component/unit tests without changing organizer `PlayerFilter` behavior.
- [x] Run migration/database coverage where available, strict TypeScript, production build, full Vitest, relevant Playwright workflows, and `git diff --check`.
- [x] Review the final diff for scope, integrity, money-handling language, and elegance; record exact evidence and the deferred Gap 3 decision below.
- [x] Gap 3: add an explicit allow-open draw confirmation, publish 1–99 open squares without changing the default full-board path, and render OPEN cells distinctly.
- [x] Enforce owner-only post-publish assignment of previously open squares before kickoff; reject occupied-square edits, existing-name mutations, axis changes, and all edits at/after kickoff.
- [x] Add deterministic open-square milestone resolutions, public history projection, and notification suppression without payout adjudication.
- [x] Apply migrations `021`–`022` to disposable PostgreSQL and run focused endpoint/UI/browser coverage plus the complete verification gates.
- [ ] Stage only remediation-owned files, commit, push, open the GitHub PR/release path appropriate to PR #9 status, apply production migrations in order, deploy Cloudflare Pages, and verify the canonical production revision and public behavior.

## Review

- Baseline: branch `codex/gap-remediation-2026-08-01` starts at PR #9 revision `984313b`; strict TypeScript and all 48 Vitest files pass (285 passed, one expected hosted Stripe skip).
- Scope correction: the live organizer, `usePoolData`, and create API still use numeric `payouts`/`payout_labels` with invented `$125/$250` defaults. Gap 1 must replace that live editor/default path with optional text descriptions, not merely delete dead components or add a second contradictory payout model.
- Gap 4: deleted the three import-free legacy components, removed empty cleanup directories, preserved pricing assertions against `FilmLanding`, renamed guest migration to `adopt-draft`, and fixed verification configuration failures with a board-scoped redirect or branded no-store 503 page. Focused coverage passes 18/18 and strict TypeScript passes.
- Gap 1: migration `021` adds validated optional description JSON to canonical contests and public snapshots. Owner-authenticated, revision-checked PATCH updates the canonical row and published projection atomically through a service-only RPC. The numeric organizer editor and invented defaults are gone; new boards no longer seed legacy payout labels. Organizer text remains editable after publish, previews locally, and renders anonymously only when present beside the exact off-platform disclaimer.
- Gap 2: the viewer modal now normalizes case, whitespace, punctuation, and accents; exact normalized matches resolve only on submit, while token/substring matches and normalization collisions require a human choice. Zero results expose the distinct assigned-name list. The selected canonical label persists per share code and is revalidated after load, preserving exact highlighting and participant identity.
- Focused remediation coverage passes 78/78 with strict TypeScript and `git diff --check`. Disposable PostgreSQL applies through migration `021` and proves initial projection, post-publish atomic edits, URL constraints, revision behavior, and service-only write authority.
- Final verification: `npm run build` passes; the full Vitest run passes 54/54 files with 325 tests passing and one expected hosted Stripe skip. The full Docker-backed run used `--testTimeout=15000`; default-timeout concurrency failures were rerun in isolation and passed, confirming timing flakes rather than behavior failures.
- Playwright passes all 44 non-visual workflows across Chromium and WebKit (10 intentional capture skips), including normalized viewer search, reload persistence, focus containment, and the published payout block. The rendered desktop viewer review is captured at `/Users/amm13/.codex/visualizations/2026/08/01/019fbe70-b161-79e0-a311-fd6a9feadf3a/gridone-payout-viewer.png`; the block is clear, ordered, and adjacent to the exact disclaimer.
- The active numeric payout model is removed from client types, organizer controls, new-board settings, and public responses. Legacy database `payout_labels` remains only as an unexposed compatibility column for existing migrations/RPC signatures; new boards write `{}` there.
- Gap 3 approval: the owner selected “Open square — see board rules,” no participant email, no automated rollover or redistribution, and allowed late assignment of only previously open cells before kickoff.
- Release authorization: commit, push, production migrations, and deployment are now approved. Migration `021` must deploy before the API/client revision, followed by the new Gap 3 migration.
- Gap 3 implementation: an organizer may explicitly commit a number draw with 1–99 open cells; the persisted draft opt-in and action-time publish confirmation are both required. The default publish path still rejects open cells, and a 100-cell open board cannot publish.
- Gap 3 integrity: the service-only late-fill RPC accepts only the complete normalized name array, proves every occupied cell is unchanged, permits only `[] -> [name]` before kickoff, and atomically advances canonical board data, assignments, participants, public projection, revision, and audit history.
- Gap 3 resolution behavior: open winners are stored and projected explicitly, render as `Open square` with a board-rules link only when organizer notes exist, and enqueue no notification delivery. Corrections preserve append-only resolution versions and can move between open and assigned outcomes without inventing a payout decision.
- Final local verification after the open-square draft-display correction: strict TypeScript, production build, both Worker dry-runs, and `git diff --check` pass; full Vitest passes 56/56 files with 343 tests passing and one expected hosted Stripe skip; full Playwright passes all 44 non-visual Chromium/WebKit workflows with 10 intentional capture skips.

# Landing pricing/Stripe alignment — July 30, 2026

- [x] Confirm the changed landing page belongs to canonical GridOne `main`, not HomeWork.
- [x] Compare the active landing copy and structured offers with the approved Free, Game Day, and Organization tiers.
- [x] Verify the matching live Stripe prices and production checkout configuration were deployed before the new landing page.
- [x] Correct the one misleading first-board payment sentence and extend the pricing-drift test to the new landing component.
- [x] Run the production build, focused pricing/checkout/publish tests, and `git diff --check`.
- [x] Move the leftover `_to_delete/film-frames.zip` transfer archive to macOS Trash.

## Review

- Completed 2026-07-30 at 9:23 AM CDT.
- Production Cloudflare deployment `10e912fa-d716-45ae-91ee-532fede5ba01` is on committed `main` revision `fcf2bc1`, which records the completed pricing rollout.
- Production already has the approved live one-time Stripe prices configured: Game Day `$9.99` (`price_1TytcMFwSi8ogxSrCLXjAzRA`) and Organization `$79.00` (`price_1TytdIFwSi8ogxSrTg4WLaNj`). Paid signup is enabled, and the earlier authenticated smoke path opened exact `$9.99` Checkout without submitting payment.
- The live page's server-rendered structured data already advertises Free `$0`, Game Day `$9.99` for up to 5 boards, and Organization `$79` for up to 50 boards.
- The uncommitted `FilmLanding` uses the same amounts, allowances, and season framing. Replaced `Pay only when you're ready to share it.` with `Your first published board is free. Upgrade only when you need another.` so the closing CTA no longer implies payment is required for the free first board.
- Added `components/FilmLanding.tsx` to `tests/pricingCopyConsistency.test.ts`, including an explicit assertion for the free-first-board upgrade edge.
- `npm run build` passed. Focused pricing/checkout/publish verification passed 3 files and 20 tests. `git diff --check` passed.
- Moved the 13 MB transfer archive to `/Users/amm13/.Trash/gridone-film-frames-transfer-2026-07-30.zip`; it is recoverable from Trash. The empty `_to_delete` directory remains.
- The landing redesign remains deliberately uncommitted and undeployed with the owner's other working-tree files preserved.

### Production landing follow-through

- [x] Reproduce the reported old production landing page and confirm the film landing existed only in the local worktree.
- [x] Isolate the landing release on `agent/film-landing-release` without staging unrelated `.impeccable` or documentation files.
- [x] Preserve the landing-only Lenis ownership contract and replace obsolete board-animation browser assertions with film-specific progression, reduced-motion, responsive, pricing, and route-cleanup coverage.
- [x] Pass the production build, all 46 Vitest files (271 passed, one expected hosted Stripe skip), and all 44 Chromium/WebKit workflows (10 intentional visual-capture skips).
- [x] Commit and push the isolated landing release, merge it to `main`, and verify the new production page after Cloudflare completes.

### Production landing follow-through review

- PR `#8` merged the isolated film landing as `0006a8d`; Cloudflare production deployment `cb992398-e8c4-4a23-987d-c121e2583d86` serves that revision.
- A fresh headless Chromium visit to `https://www.getgridone.com/` rendered the film opening and `THE BOARD WATCHES THE GAME`, showed `Your first published board is free`, displayed `$9.99` and `$79`, and did not contain the old `Run your game day` headline.
- The production frame asset `film/frames/frame_0300.jpg` returned HTTP 200.
- Unrelated untracked `.impeccable` and documentation files remain untouched.

# GridOne Friday launch

## Phase 5 design refresh — July 29, 2026

- [x] Capture the required pre-refresh screenshot set for landing, organizer Fill, organizer Draw, viewer phone, and one dialog.
- [x] T5.1 add the 8px control, 12px surface, and 0px grid radius tokens; keep only the board instrument sharp.
- [x] T5.2 preserve the primary uppercase cue while moving secondary controls to a quieter sentence-case treatment, with every target at least 44×44.
- [x] T5.3 warm inputs, replace the asymmetric focus rule, and document rendered contrast for rest, focus, placeholder, text, disabled, and error states.
- [x] T5.4 add exactly one elevation token used only by dialogs, the sticky organizer header, and floating board controls.
- [x] T5.5 update `DESIGN.md` and the CSS invariant, including the deliberate no-pills/no-gradients/no-blur/no-shadow-scale boundary.
- [x] Run strict type, production build, full Vitest, diff checks, Chromium, and WebKit at desktop, tablet, phone, reduced-motion, and keyboard-accessibility coverage.
- [x] Capture and review the matching post-refresh screenshot set.
- [x] Commit, push, review, merge, and deploy the verified refresh under the owner's autonomous-plan authorization.

### Phase 5 execution boundary

- The product owner explicitly waived the phase stop gates for this task and authorized autonomous completion of the entire plan, including Phase 5 review and deployment.
- Phase 5 remains intentionally narrow: `src/index.css`, `DESIGN.md`, token-backed class names in `components/` and `pages/`, focused tests, screenshots, and this task record.
- Do not change payment, score, migration, notification, or entitlement behavior as part of the visual refresh.
- Preserve the organizer-first free board, the sharp 10×10 instrument, the existing palette and semantic color meanings, phase composition, focus rule, and reduced-motion behavior.

### Phase 5 review

- All 83 component/page `rounded-none` usages now resolve to the token system: 48 controls, 33 surfaces, and the two intentional organizer-grid exceptions. `BoardGrid` also carries explicit sharp frame/table/cell/axis rules.
- Primary actions retain the uppercase cue. Supporting actions use sentence case, 600 weight, no tracking, and a 44px minimum target.
- The warm input fill is approximately `#F2F3F3`. The specified 24% ink boundary measured only 1.71:1, so the accessible implementation uses 55% ink: 4.11:1. Placeholder ink at 60% measures 4.85:1; entered ink 17.19:1; cardinal focus/error 7.91:1. The halo is supplemental to the passing 2px cardinal border.
- Exactly three rule blocks reference the single elevation token: semantic modal dialogs, the sticky organizer header, and the floating Find/zoom/reset board-control cluster. Each keeps a key-line boundary and drops only the shadow in reduced-transparency or forced-colors modes.
- No `rounded-none`, out-of-system radii, pills, gradients, blur, arbitrary shadow utility, or hardcoded `border-radius: 0` remains in the refreshed source boundary.
- Deterministic before/after artifacts live in `docs/audits/phase5-design-refresh-2026-07-29/{before,after}`. Chromium capture passes 5/5 using mocked owner/viewer fixtures and never touches production.
- Full Vitest passes 44/44 files with 270 passing tests and one hosted Stripe proof skipped. Full Playwright passes 44 workflows across Chromium and WebKit; ten explicit visual-capture cases skip unless `PHASE5_CAPTURE=before|after` is set. Strict TypeScript, production build, retry-worker dry run, and `git diff --check` pass.
- `npm audit --omit=dev` remains the approved documented exception: two high package findings for one React Router RSC-only advisory.
- Commit `cde3cbe` passed the Cloudflare Pages preview, PR `#4` merged as `753270d`, and production deployment `593db8f1-6b9f-4276-ab4b-9c7769b1530e` succeeded.
- Production asset `index-Cgp-wPj6.css` contains all three radius tokens and exactly three elevation references. Rendered organizer proof shows a 12px raised header, 8px warm inputs with a 2px boundary, 12px normal-flow surfaces, and 0px grid cells.

## Launch hardening Phase 4 — July 29, 2026

- [x] T4.1 complete the outstanding clean-install, full-stack, Stripe test-mode, responsive, accessibility, motion, and metadata verification matrix.
- [x] T4.2 record the approved dated React Router RSC-only advisory exception with a post-season review date.
- [x] T4.3 remove obsolete prelaunch pricing/capacity claims; retain `$4.99` one-time for up to 20 boards.
- [x] T4.4 complete one production organizer create → publish → viewer → manual score → notification → checkout → entitlement flow.
- [x] Prove one end-to-end refund and observe entitlement revocation without unpublishing the board.
- [x] Run a production subscribe-endpoint abuse test and observe throttling.
- [x] T4.5 open paid signup only after Phases 1–3 are deployed and every launch gate above is proven.

### Phase 4 completion run — July 29, 2026

- [x] Re-confirm canonical repository `main` at `0b59dd5`, Cloudflare account `a675816e0fde9aff2ebda171a6e39ead`, Pages project `grid-one`, Stripe account `acct_1TsBjcFwSi8ogxSr`, and Supabase project `illqymckwqiawdwxhwcy`.
- [x] Add and test an explicit production checkout hold with a named organizer smoke-test allowlist.
- [x] Deploy the checkout hold before correcting the production Stripe credential.
- [x] Replace the Pages `STRIPE_SECRET_KEY` with the confirmed live Parkside key without exposing its value.
- [x] Deploy the one-minute notification retry Worker with the matching `CRON_SECRET`.
- [x] Complete the production organizer and independent-viewer path through publish, manual score, notification, checkout, webhook, and entitlement.
- [x] Refund the smoke-test charge and verify entitlement revocation while the published board remains viewable.
- [x] Run the bounded production subscribe abuse proof and observe a 429 without sending to an unowned address.
- [x] Run a clean-install verification at final `main`, reconcile the detailed verification checklist, commit, push, and record the production release evidence.
- [x] Correct and deploy the production activation-relation shape mismatch exposed by the paid smoke test, then re-prove organizer, publish, and scoring gates against the fulfilled order.

### Phase 4 execution boundary

- Phase 1–3 commit `8e1cafd` is pushed on `agent/launch-hardening-phases-1-3`; draft PR `#2` targets `main`.
- Production migrations `012`–`018` are applied to confirmed project `illqymckwqiawdwxhwcy` and pass the schema/RPC/trigger postflight.
- Phase 4 may run local verification, documentation/copy corrections, non-financial production reads, and an approved application deployment.
- The product owner explicitly authorized autonomous completion of the entire execution plan in this Codex task on July 29, 2026, including the production $4.99 charge/refund proof, recipient notification proof, deployments, and Phase 5. Re-verify exact targets before every irreversible action.

### React Router dependency security exception — July 29, 2026

- Advisory: `GHSA-qwww-vcr4-c8h2`, React Router RSC-mode CSRF bypass. Current resolved packages are `react-router-dom@7.18.1` and `react-router@7.18.1`. `npm audit --omit=dev` reports two high-severity findings for this single advisory.
- Exposure decision: Temporarily accepted for the 2026 season. GridOne is a Vite-built client-side SPA using `ReactDOM.createRoot` with `BrowserRouter`, `Routes`, and `Route`. It has no React Server Components runtime, React Router framework/server entry, route actions/loaders, or RSC request handler, so the advisory’s vulnerable RSC action-execution path is not enabled.
- Remediation decision: Do not run `npm audit fix --force`; npm currently proposes a breaking downgrade to `react-router-dom@7.11.0`. Re-evaluate and upgrade to a non-vulnerable supported release with full unit, build, Chromium, and WebKit regression coverage after the season.
- Guardrail: Enabling React Router RSC/framework mode, server actions, or an RSC request handler invalidates this exception and requires remediation before merge or deployment.
- Review/expiry date: February 16, 2027. Close earlier if a low-risk patched 7.x release becomes available.
- Approved by: GridOne product owner — recommended decision approved in this Codex task on July 29, 2026.
- Recorded by: Codex, July 29, 2026.

### Phase 4 local verification

- A detached worktree at pushed commit `8e1cafd` completed a fresh `npm ci`, production build, and all 41 Phase 1–3 Vitest files: 259 passing tests and one credential-gated hosted Stripe proof skipped.
- The Phase 4 tree passes strict TypeScript, production build, and `git diff --check`.
- Full Vitest passes 43/43 files with 265 passing tests and the same hosted Stripe proof skipped. Disposable PostgreSQL 17 covers migrations, RLS, checkout/webhook/refund, concurrency, rate limits, notification retry, milestone confirmation, and score-test suppression.
- Full Playwright passes 42/42 workflows across Chromium and WebKit. Coverage now includes desktop, 768×1024 tablet, phone, reduced motion, reverse scrub, sticky release, 44×44 targets, visible keyboard focus, dialog focus containment/Escape/return, and the organizer/viewer workflows.
- Build-time output contains crawler-visible route-specific HTML for all 17 public routes. The sitemap, canonical URLs, robots policy, Article JSON-LD, OG metadata, and 1200×630 OG image are contract-tested.
- `npm audit --omit=dev` still reports the two package findings for the single documented React Router RSC-only advisory; do not describe the audit as clean.

### Phase 4 production verification

- Confirmed live Stripe account `acct_1TsBjcFwSi8ogxSr` is Parkside Advisory Group. Product `prod_UyCDIvzdzv0KAe` and live price `price_1TyFoqFwSi8ogxSrY9KvKd70` are active at `$4.99`.
- Created production organizer board `8c40d1b6-c7c8-4626-b46f-22996e25e858`, assigned all 100 squares, and committed both random axes while the unpaid board remained fully editable.
- The first approved checkout attempt stopped before a charge with Stripe's exact server error `No such price: 'price_1TyFoqFwSi8ogxSrY9KvKd70'`. Production `checkout_orders` contains zero rows for the board, so no open order or payment requires cleanup.
- Because the same price exists in live mode, the production `STRIPE_SECRET_KEY` is in the wrong mode/account. Correcting the secret and deploying the retry Cron Worker require the Cloudflare account's Apple sign-in/passkey; GitHub and Google were both rejected as a different provider and Wrangler has no local authentication.
- The owner completed Cloudflare authentication. Pages now has the corrected encrypted live Stripe key, and Worker `gridone-notification-retry-scheduler` runs every minute with the matching encrypted `CRON_SECRET` (versions `aa20cb0d-8c10-4238-b679-a692d2df1a9a` and `5867b2fb-1d1d-4306-9ec2-987f41356f52`).
- Stripe destination `we_1TyG4zFwSi8ogxSrz4vF0clc` now sends the seven required checkout, refund, and dispute events to `https://www.getgridone.com/api/stripe/webhook`.
- Live order `add872d6-5336-4250-b0fa-f24e9df81450` completed for $4.99 and activated board `8c40d1b6-c7c8-4626-b46f-22996e25e858`. The paid-return page rendered “Payment confirmed. Your board is unlocked.”
- The paid proof exposed a PostgREST relation-shape defect: the unique `board_activations.contest_id` relationship arrives as `{ id }`, while organizer, dashboard, publish, and score gates accepted only `[{ id }]`. Shared normalization commit `f04a963` fixed both shapes; commit `cbee047` also added an explicit organizer “Open viewer” link. Production deployment `7345f3a2-b727-4314-ac57-4bf711631171` proved the activation, dashboard, publish, and score gates.
- Published viewer `https://www.getgridone.com/b/BDRNUWDH` returns 200 without cookies and renders the exact board in a separate browser tab. Manual authority published CAR 3–ARI 0, advancing to Q2 resolved Q1 exactly once for `Phase4 Proof`.
- The organizer-owned `mora090410@gmail.com` address received one verification email, verified successfully, and then received the exact production Q1 winner email from `updates@parksideag.com`.
- Stripe payment `pi_3TyihYFwSi8ogxSr1s61MtAx` was fully refunded for $4.99 at the owner's requested-customer reason. The webhook changed the paid-return state to “Season pass inactive,” while `/b/BDRNUWDH` remained public with its manual score and Q1 winner history.
- With the one legitimate verification already counted, four additional same-address requests returned the generic accepted response without new mail; the fifth additional request returned the production 429 throttle response. Gmail still contained only the original verification message.
- Detached clean checkout `f7a2eba` passed `npm ci`, strict TypeScript, the production build, all 44 Vitest files, and 272 passing tests with only the credential-gated hosted Stripe proof skipped. Production deployment `8b339b21-7a66-44c7-8a42-ebb082481b64` carries `PAID_SIGNUP_ENABLED=true` with an empty smoke allowlist; both the apex and preserved viewer returned 200 after deployment.

## Launch hardening Phase 3 — July 29, 2026

- [x] T3.1 observe milestones at most once per promoted score snapshot, skip permanently completed finals, and avoid unchanged public projection writes.
- [x] T3.2 keep the 60-second score poll stable across unrelated organizer edits, inline history arrays, page visibility changes, and Final.
- [x] T3.3 require both a server flag and owner allowlist for score-test boards; permanently label them and suppress all winner email.
- [x] T3.4 implement the approved Step 8 recommendation: ship polling, remove realtime claims, and disclose updates about every minute.
- [x] Prove one finished board with 50 concurrent viewers performs zero milestone-observation work.
- [x] Apply the complete local migration chain to disposable PostgreSQL 17 and prove new RPC/RLS/load behavior.
- [x] Run the full unit, strict type, build, diff, Chromium, and WebKit gates.
- [x] Record the Phase 3 review and stop before any production migration or deploy.

### Phase 3 execution boundary

- Baseline remains commit `2f357d9` on `main`; the completed, uncommitted Phase 1 and Phase 2 work remains the starting tree.
- Phase 3 is authorized for local code, recorded fixtures, disposable PostgreSQL, load simulation, documentation, and browser tests only.
- The Step 8 decision already selects 60-second polling, so T3.4 does not require another owner decision.
- Do not apply new migrations, deploy Cloudflare Pages or the Cron Worker, send live email, or mutate production data without fresh approval.

### T3.2 review

- `useLiveScoring` now keys automatic polling only to board reference, external event identity, scoring authority, readiness, and visibility—not the full organizer `game` object.
- Forty unrelated organizer edits leave the one-minute interval intact and produce zero additional score requests. Inline winner/pending arrays are synchronized by content signature, eliminating render-loop behavior.
- Hiding the document clears the timer; returning to the page performs one immediate refresh and restores one timer. A Final response clears that timer permanently.
- Focused hook coverage passes 6/6 tests, including the 40-edit load case, inline-array regression, visibility lifecycle, and Final stop.

### T3.1 review

- Migration `017_milestone_observation_efficiency.sql` makes score promotion and milestone observation one transaction. A projection or outbox failure rolls promotion back instead of leaving a Final snapshot permanently unobserved.
- Durable snapshot/count/finalized markers serialize replayed observations, conservatively backfill already-observed boards, and permanently seal completed post-game boards after all four milestones exist.
- Milestone projection updates use JSON difference checks, so unchanged history no longer churns `updated_at`. Automatic and manual handlers read the transactionally published projection without a second observer call.
- Focused coverage passes 29/29 tests. Fifty sequential and fifty concurrent finished-board viewer GETs perform zero observer or RPC work; disposable PostgreSQL applies migrations `000`–`017` and proves atomic promotion, one replay observation, permanent Final skip, and unchanged projection timestamps.

### T3.4 review

- `PRODUCT.md`, `DESIGN.md`, and this launch checklist now describe visibility-aware viewer polling about every minute. Supabase realtime is explicitly deferred until after the 2026 season.
- The public score authority line says “Score updates about every minute,” and the comparison article no longer promises instant or “Real-Time” updates.
- Focused documentation/UI contract coverage passes 2/2 tests. No realtime subsystem, deployment, or production configuration was added.

### T3.3 review

- Score-test creation and completed-game discovery require both `SCORE_TEST_MODE_ENABLED=true` and an authenticated owner UUID in `SCORE_TEST_MODE_OWNER_IDS`. Closed gates silently fall back to ordinary upcoming-game behavior and copy.
- Migration `018_score_test_mode.sql` makes the server-created flag immutable, projects it onto public snapshots, and suppresses winner/correction delivery inserts at the database boundary.
- Every organizer and public board branch displays an unmissable “SYNTHETIC SCORE TEST” warning explaining that completed-game data is not live and winner/correction emails are disabled.
- Disposable PostgreSQL applies the full chain through `018` and passes 7/7 database tests. Focused API, discovery, UI, and regression coverage passes 37/37; Chromium creation/discovery coverage passes 4/4.

### Phase 3 verification and stop

- Fifty sequential and fifty concurrent reads of one permanently finished board perform zero milestone-observation calls and zero score-promotion RPC work.
- Disposable PostgreSQL 17 applies migrations `000`–`018`. The database suites prove atomic score promotion plus observation, one observation per snapshot, permanent Final sealing, unchanged-projection write suppression, score-test immutability, public projection, and notification suppression.
- `npx vitest run --maxWorkers=1`: 41/41 files pass, with 259 passing tests and one intentionally environment-gated Stripe lifecycle proof skipped.
- Strict TypeScript, production build, `git diff --check`, and the retry-scheduler Wrangler dry run pass.
- `PLAYWRIGHT_PORT=5199 npx playwright test`: 34/34 workflows pass across Chromium and WebKit.
- Phase 3 stops here. Migrations `012`–`018`, the Pages release, the Cron Worker, and all live email remain undeployed; no production data, Stripe object, or live notification was changed.

## Launch hardening Phase 2 — July 29, 2026

- [x] T2.1 make manual scoring authoritative before the first score, order automatic refreshes monotonically, and promote canonical plus public score atomically.
- [x] T2.2 confirm milestone results only after two stable reads at least 45 seconds apart, then add append-only organizer corrections and public correction history.
- [x] T2.3 cap winner-email delivery at five attempts with scheduled exponential backoff, immediate permanent failure, organizer visibility, and no viewer-triggered sends.
- [x] T2.4 centralize the published-and-not-withdrawn predicate and return one identical 404 from board, score, and subscribe public endpoints.
- [x] Apply migrations `000`–`016` to disposable PostgreSQL 17 and prove RPC/RLS/concurrency behavior.
- [x] Add recorded-fixture coverage for pregame, live, stale, offline, manual, overtime, final, milestone confirmation, and milestone correction.
- [x] Run the full unit, strict type, build, diff, Chromium, and WebKit gates.
- [x] Record the Phase 2 review and stop before any production migration or deploy.

### Phase 2 execution boundary

- Baseline remains commit `2f357d9` on `main`; the completed, uncommitted Phase 1 work is preserved as the starting tree.
- Phase 2 is authorized for local development, recorded fixtures, disposable PostgreSQL, and browser tests only.
- Do not apply migrations `014`, `015`, or `016` to production, deploy Cloudflare Pages, send live email, or mutate production data without fresh approval.

### T2.1 review

- Migration `014_score_promotion_ordering.sql` adds authority generations and refresh-start sequences, refuses automatic lease acquisition in manual mode, rejects stale/old-generation promotions, and updates canonical plus public score in one transaction.
- The organizer Manual action now persists authority before exposing the score form. A fresh manual board returns the explicit `awaiting_organizer_entry` state without a provider call or synthetic 0–0 score.
- Disposable PostgreSQL 17 proves a later-started refresh beats a slower earlier request, a missing published projection rolls the whole promotion back, manual mode invalidates in-flight automatic authority, and an explicit return to automatic allows only a new-generation refresh.
- Focused T2.1 verification passes 13/13 tests plus strict TypeScript and diff checks. No production migration, provider call, deployment, or data mutation occurred.

### T2.2 review

- Migration `015_milestone_confirmation.sql` keeps automatic Q1–Q3 results provisional until two distinct, identical successful reads are at least 45 seconds apart. Candidate changes reset the clock, provider regressions clear pending state, manual results confirm immediately, and a provider FINAL confirms on `post`.
- Confirmed results are versioned append-only. Organizer corrections record actor, time, reason, previous version, public version history, and separate outbox rows for the previous recipient and corrected winner.
- The UI renders provisional results in a neutral dashed treatment, exposes settled correction history publicly, and requires explicit consequence copy before publishing a correction.
- The original 7–13 then 7–14 at T+25 fixture is explicitly amended: T+25 remains pending; the matching 7–14 read at T+70 confirms.

### T2.3 review

- Migration `016_notification_delivery_retry.sql` moves send authority to service-role-only claim/completion RPCs with a five-attempt cap and 1m, 5m, 25m, and 2h database-enforced backoff.
- The `CRON_SECRET` worker sends bounded batches with deterministic idempotency, treats hard 4xx failures as permanent and 408/429/5xx/timeouts as transient, and produces clearly worded winner and correction messages. A dedicated one-minute Cloudflare Cron Worker invokes the protected endpoint; its separate Wrangler configuration passes a local deployment dry run.
- Score reads only queue confirmed deliveries; viewer polling performs no provider email call. Owner board reads expose sanitized terminal failures, and the organizer dashboard explains when human follow-up is needed.

### T2.4 review

- `publicBoardVisibility.ts` is the single public predicate for published lifecycle states plus `withdrawn_at IS NULL`.
- Public board, score, and subscribe handlers all use that helper and the byte-identical unavailable response. Architecture tests fail if these routes bypass the helper.

### Phase 2 verification and stop

- Disposable PostgreSQL 17 applies migrations `000`–`016`. The migration suites prove score ordering and atomic projection, milestone stability/correction history, notification retry/backoff/attempt caps, checkout lifecycle preservation, and notification rate-limit/RLS behavior.
- `npx vitest run --maxWorkers=1`: 35/35 files pass, with 229 passing tests and one intentionally environment-gated Stripe lifecycle proof skipped.
- Strict TypeScript, production build, `git diff --check`, and the retry-scheduler Wrangler dry run pass.
- `PLAYWRIGHT_PORT=5199 npx playwright test`: 32/32 workflows pass across Chromium and WebKit.
- Phase 2 stops here. Migrations `014`–`016`, the Pages release, the Cron Worker, and all live email remain undeployed; no production data, Stripe object, or live notification was changed.

## Launch hardening Phase 1 — July 29, 2026

- [x] T1.1 prevent duplicate payment for the non-stacking 2026 season pass.
- [x] T1.2 handle completed, delayed-success, delayed-failure, and expired Stripe Checkout sessions idempotently.
- [x] T1.3 revoke and restore entitlements for refunds and disputes without unpublishing boards.
- [x] T1.4 enforce durable board, address, IP, and participant notification-send limits.
- [x] T1.5 preserve verified subscriptions during same-address resubmission and pending address changes.
- [x] Confirm T1.6 remains not required because the activation RPC is concurrency-safe.
- [x] Confirm T1.7 remains not required because the emailed HMAC unsubscribe flow works.
- [x] Apply migrations `000`–`013` to disposable PostgreSQL 17 and prove RPC/RLS/concurrency behavior.
- [x] Run Stripe test-mode lifecycle/refund proof without a real charge.
- [x] Run the full unit, strict type, build, diff, Chromium, and WebKit gates.
- [x] Record the Phase 1 review and stop before any production migration or deploy.

## Pricing, gating, and landing-copy amendment — July 29, 2026

Source: `docs/pricing-gating-copy-2026-07-29.md` / attached Version 1.0 amendment.

Execution boundary: local code, migrations, tests, copy, and documentation are authorized by this task. Do not create/archive live Stripe prices, apply the production migration, change production environment variables, deploy, charge, refund, or mutate production data without fresh action-time approval.

### Plan

- [x] Audit the current entitlement, checkout, publish, billing-status, organizer, landing, SEO, and documentation surfaces.
- [x] Add explicit `free`, `gameday`, `org`, and `legacy` tiers with per-tier allowances and an optional organization display name.
- [x] Make the atomic publish RPC lazily create the verified organizer's one-board free allowance and consume allowance only when a valid draft is published.
- [x] Make checkout upgrade an entitlement without consuming or publishing its referenced draft; verify Game Day and Organization prices from a server-owned price map.
- [x] Return tier, allowance, and used count from billing status and publish allowance-edge details from the server.
- [x] Replace the pre-publish unlock flow with the exact free-to-Game-Day and Game-Day-to-Organization upgrade edges.
- [x] Ship the approved landing hero, sample-game ticker, how-it-works, pricing FAQ, footer, and plain-language marketing guardrail.
- [x] Update `PRODUCT.md`, `README.md`, FAQ/JSON-LD, tracked marketing/product docs, configuration examples, and current operational copy in one sweep.
- [x] Add migration/RPC, webhook/checkout, API, UI, pricing-contract, and browser coverage.
- [x] Run focused tests, fresh PostgreSQL migration/integration coverage, strict TypeScript, production build, full Vitest, Playwright, copy grep, and `git diff --check`.

### Design decisions

- Publishing is the only allowance edge. Draft creation, editing, number draw, and preview never call billing or consume allowance.
- `board_activations` remains the durable record that a board consumed one publish allowance and may keep all live services for the season.
- A paid webhook upgrades the owner's season entitlement only. The organizer returns to the draft and publishes explicitly; payment success is not publication consent.
- The free entitlement is created by the same server-side publish transaction used by paid tiers and is keyed by the authenticated owner account and season.
- Existing historical `$4.99` rows remain auditable as `legacy`, but the migration does not preserve the retired 20-board commercial offer for new publishes.
- Organization name is stored on the Organization entitlement, copied into new public board snapshots, retroactively applied to the season's existing published snapshots when the upgrade is fulfilled, and included in Stripe payment description/metadata.

### Review

- Migration `019_pricing_tiers.sql` makes publish the sole allowance boundary, lazily creates the one-board free entitlement, atomically validates and consumes allowances, upgrades the same season entitlement to Game Day or Organization, and leaves every previously published board functional through refunds, disputes, or later entitlement state changes.
- Checkout is server-mapped to exact `$9.99` Game Day and `$79.00` Organization price IDs and amounts, accepts only the next valid allowance-edge upgrade, and never publishes the referenced draft. Organization fulfillment also brands every already-published board in that season.
- Organizer and dashboard UI now render server-authoritative tier/usage state. The exact upgrade prompt appears only after a publish allowance rejection, requires a deliberate purchase action, and returns the organizer to the draft for a separate publish action after payment.
- Landing, structured data, public-route metadata, current product/marketing documentation, and operational copy now use the approved three-tier offer and plain-language positioning.
- Verification passed: 230/230 non-integration Vitest tests; 41/41 PostgreSQL integration tests with one credential-gated hosted test skipped; strict TypeScript; production build; `git diff --check`; and 44/44 Chromium/WebKit Playwright tests with 10 intentional visual-capture tests skipped.
- No live Stripe price was created or archived, no production environment variable or database was changed, and nothing was deployed. `PAID_SIGNUP_ENABLED=false` remains the checkout hold until the owner approves the explicit live-price and production steps.

### Approved production rollout — July 30, 2026

Approval received for the previously held production sequence: create the live Game Day and Organization prices, archive the retired `$4.99` price, configure the production price IDs, apply migration `019`, deploy, enable checkout, and verify the live boundaries.

- [x] Reconfirm the canonical Stripe account, Supabase project, Cloudflare Pages project/domain, branch, and committed revision.
- [x] Create one-time live prices for Game Day at `$9.99` and Organization at `$79.00`, then archive the retired price.
- [x] Configure both server-side production price IDs while keeping `PAID_SIGNUP_ENABLED=false`.
- [x] Apply and verify production migration `019_pricing_tiers.sql` without rewriting or deleting existing rows.
- [x] Build and deploy the committed revision to Cloudflare Pages production.
- [x] Verify production health, public routes, unauthenticated API boundaries, and checkout hold.
- [x] Enable paid signup only after the price, migration, deployment, and held-state checks all pass.
- [x] Run the narrow approved checkout smoke path without submitting a real charge.
- [x] Record exact production evidence and any remaining owner-attended boundary.

Rollout notes:

- Stripe account `Parkside Advisory Group` (`acct_1TsBjcFwSi8ogxSr`) now has verified live one-time prices for Game Day `$9.99` and Organization `$79.00`. The retired `$4.99` price was briefly archived, then immediately restored when the live-state preflight showed the old production checkout was still enabled.
- A database-compatible temporary production deployment (`fd8558c`, deployment `17cd99ca-66d8-41df-a4f5-c0f1808595f2`) sets `PAID_SIGNUP_ENABLED=false` before the schema and application cutover. Health returned `200`, and the apex redirect preserved path and query.
- Canonical production database was visibly confirmed as `GridOneApp` under `Sideline Hacks`, ref `illqymckwqiawdwxhwcy`. Pre-migration checks found zero open checkout orders, zero active entitlements, and zero active entitlements without activations.
- The first SQL Editor attempt was rejected before execution because the editor appended migration `019` to a truncated preflight query. The exact editor contents were then replaced and verified byte-for-byte against SHA-256 `5ecb3f9c775312802c8bd9ef7bcb505dce2164eb5c0ba10a20fc6a23c9e027a2`.
- The exact migration then completed with `Success. No rows returned.` Post-migration queries confirmed the three new pricing/organization columns, the new atomic publish RPC, zero open checkout orders, and zero active entitlements.
- Held tier-pricing commit `cffb30f` deployed as Cloudflare production deployment `ce5c484b-2055-428d-bbdf-8a3883e89fa5`. `/`, `/demo`, `/terms`, `/privacy`, `/paid`, and `/api/health` returned `200`; unauthenticated billing status returned `401`; an unsigned webhook returned `400`.
- The retired `$4.99` live price is archived. The new live prices are `price_1TytcMFwSi8ogxSrCLXjAzRA` for Game Day and `price_1TytdIFwSi8ogxSrTg4WLaNj` for Organization.
- A temporary allowlist deployment at commit `09505d9` / deployment `b1f68916-e902-45f3-bfa3-01615c0ee6f4` exposed checkout only for draft `46117e9f-118b-4c33-a1c0-0fd8274b1064`. The held path first returned `Paid signup is not open yet`; the allowlisted path then opened Stripe Checkout for `GridOne Game Day — 2026 Season` at exactly `$9.99`.
- No payment information was entered and `Pay` was not pressed. Production remained unchanged at the entitlement edge: the checkout order was `checkout_created` for `999` cents and tier `gameday`, the referenced board had no public snapshot, and the pre-existing inactive legacy entitlement remained at one used of one allowed board.
- Git deployment `a646778e-6461-41a4-8c66-5a720ff76a26` carried commit `5dfff61`, but the Cloudflare configuration read-back exposed the held production-environment override. Checkout therefore remained safely held. Direct production deployment `5e5a4c74-5259-4aad-a99e-2b7e4d7ef6bb` then replaced that override with `PAID_SIGNUP_ENABLED=true`, removed the smoke allowlist, retained both approved price IDs, and deployed the same commit.
- Final production smoke returned `200` for `/`, `/demo`, `/terms`, `/privacy`, `/paid`, and `/api/health`; `401` for unauthenticated billing status; `400` for an unsigned webhook; and a path/query-preserving `301` from the apex. The authenticated dashboard still rendered `Free · 1 of 1 published`, and the QA board remained a private draft.
- Exact-release verification passed the production build, `git diff --check`, and all 46 Vitest files: 271 tests passed and the credential-gated hosted lifecycle test remained the one expected skip. A real customer purchase remains deliberately owner/customer-attended; the rollout submitted no charge.

### Phase 1 payment implementation

- [x] Scope checkout claims and live sessions to owner + 2026 season, with an atomic database claim and attach path.
- [x] Reuse one deterministic open session, expire every other open session, and set Stripe's minimum 30-minute Checkout expiry.
- [x] Record a completed-but-unpaid checkout as processing; fulfill delayed success through the same verified path; terminalize delayed failure and expiry.
- [x] Make fulfillment idempotent, preserve one non-stacking entitlement, and mark any second payment refundable without granting allowance.
- [x] Revoke only the current purchase source after a full refund or opened dispute, restore a won dispute, and protect a later repurchase from older events.
- [x] Preserve every existing activation and published snapshot during revocation; block only new activations with a deliberate repurchase affordance.

#### Payment implementation review

- Migration `012_checkout_lifecycle_and_entitlement_revocation.sql` adds owner-season checkout claims, terminal session states, refundable duplicate orders, refund/dispute history, entitlement audit events, and source-aware revocation/restoration RPCs. All new RPCs are service-role-only.
- Checkout creation rechecks entitlement atomically immediately before reuse/creation, uses the order ID as a non-PII Stripe idempotency key, attaches the resulting Session transactionally, and expires stale owner-season Sessions.
- The webhook verifies the raw signature, acknowledges valid but unactionable events with `2xx`, sends genuine processing failures to Stripe as `5xx`, and handles completed, async-success, async-failure, expired, refunded, dispute-opened, and dispute-closed events.
- The organizer sees distinct no-entitlement, exhausted-allowance, inactive-pass, processing, failed/expired, duplicate-payment, refund, and dispute states. An inactive pass requires a deliberate second click to purchase again; previously published boards remain available.
- Disposable PostgreSQL 17 applies migrations `000`–`013`. The full suite passes 183/183 tests across 29 files, including payment and notification concurrency/RLS; strict TypeScript, production build, and `git diff --check` pass; Playwright passes 32/32 across Chromium and WebKit.
- Stripe Sandbox hosted proof completed against Parkside Advisory Group with `livemode=false`: Checkout Session `cs_test_a1gtJtfAjfLPcIYEXI3ax3W2RUwonngKVBRg0R6ukIJz84hgMmay55ViJT` paid $4.99 and emitted completion event `evt_1TydwoFwSi8ogxSrBW8zlqdk`.
- The environment-gated PostgreSQL integration test retrieved that exact Stripe event, signed and submitted it to the production webhook handler, and proved order `paid`, entitlement `active`, one activation, and one idempotent event record after migrations `000`–`012`.
- The same proof published a disposable viewer snapshot, issued Sandbox refund `re_3TydwnFwSi8ogxSr1X4iDEeC`, processed real `charge.refunded` event `evt_3TydwnFwSi8ogxSr1bvtXso9` through the production handler, and proved order `refunded`, entitlement `revoked`, full 499-cent refund, one preserved activation, and one unwithdrawn published snapshot.
- Hosted lifecycle verification passed 5/5 tests on disposable PostgreSQL 17. The temporary Sandbox price and product were archived and the temporary webhook endpoint was deleted. No live Stripe object, real charge, production migration, deployment, email, or production data was changed.

### Phase 1 notification implementation

- [x] Add migration `013_notification_rate_limits.sql` with durable forensic logging, atomic four-dimension claims, send completion, and one-current-address verification.
- [x] Make the public subscribe response enumeration-safe and byte-identical across all accepted outcomes.
- [x] Trust only a valid Cloudflare client-IP header and require a successful database claim before any provider request.
- [x] Prove the limits, address-change lifecycle, RPC privileges, and claim-before-send behavior in focused unit and disposable PostgreSQL tests.
- [x] Record verification results here; do not apply the migration or send email in production.

#### Notification implementation review

- The subscribe endpoint now returns one byte-identical `202` response for new, invalid-participant, already-verified, changed-address, and provider-failure outcomes. Only durable throttles return a generic `429` with `Retry-After`.
- Migration `013` serializes board, address, IP, and participant claims with ordered transaction advisory locks; stores HMAC address hashes plus service-only forensic outcomes; and completes provider results through a second service-only RPC.
- Same-address resubmission is a no-op. A changed address remains pending beside the old verified address, and verification atomically replaces the old row under a participant lock and a one-verified-address unique index. Unsubscribed addresses may start fresh verification.
- Disposable PostgreSQL 17 applied migrations `000`–`013` and passed 9/9 focused RPC/RLS/concurrency tests. The database proof exposed and migration `013` repairs a migration-005 trigger defect that dereferenced `current_snapshot_id` on notification rows.
- Focused endpoint/winner/unsubscribe tests pass 25/25; strict TypeScript, production build, and diff checks pass. No production migration, email, or data mutation occurred.

## Launch hardening Phase 0 audit — July 29, 2026

- [x] Audit `gridone_activate_board` for an atomic 20-board allowance check and a database backstop.
- [x] Audit `gridone_promote_score_snapshot` for transaction-local manual-mode and stale-write rejection.
- [x] Trace the winner-email unsubscribe token through generation, delivery, validation, and state change.
- [x] Add executable proof for the exact audit cases and a failing-first regression for the exhausted-allowance API state.
- [x] Run the full unit, strict type, build, diff, migration, and Phase 0 browser verification gates.
- [x] Record exact findings, test evidence, and the T2.1 amendment required before Phase 1.
- [x] Stop after the Phase 0 exit gate and report to the product owner.

### Phase 0 findings

#### T0.1 — Allowance concurrency: safe through the activation RPC

The applied function in `supabase/migrations/005_canonical_launch_schema.sql` serializes all activations for one owner and season by locking the single active entitlement row before it counts or inserts:

```sql
SELECT *
  INTO entitlement
FROM public.season_entitlements e
WHERE e.owner_id = p_owner_id
  AND e.season_year = p_season_year
  AND e.status = 'active'
FOR UPDATE;
```

Only after that lock does it read `count(*)` from `board_activations`, reject `used_count >= entitlement.boards_allowance`, and insert the activation. Unique constraints also prevent duplicate owner/season entitlements and duplicate contest activations. The numeric limit is not independently enforced against a direct service-role table insert, but every application activation path uses the service-role-only RPC; the spec therefore makes T1.6 not required.

Disposable PostgreSQL 17 proof applies migrations `000`–`011`, sends 25 parallel requests through the actual activation handler backed by real RPC connections, and consistently records exactly 20 activations under one still-active entitlement. The other five now receive HTTP 409 with `BOARD_ALLOWANCE_EXHAUSTED`, `used: 20`, and `allowance: 20`; retrying all 25 boards is idempotent and leaves 20 rows.

#### T0.2 — Exact database guards pass; stronger slow-response ordering is not complete

The promotion function locks the per-board score state and independently rejects automatic promotion while manual authority is active:

```sql
SELECT * INTO state_row
FROM public.contest_score_state
WHERE contest_id = p_contest_id
FOR UPDATE;

IF state_row.scoring_mode = 'manual'
  AND next_snapshot.source_mode = 'automatic'
THEN
  RETURN false;
END IF;
```

It also rejects the exact older-timestamp case required by Phase 0:

```sql
IF current_snapshot.retrieved_at > next_snapshot.retrieved_at THEN
  RETURN false;
END IF;
```

Direct SQL tests prove both behaviors, including manual mode with no current snapshot. The broader slow-response assumption is partially refuted: `retrieved_at` is assigned after the provider call, equal timestamps have no tiebreaker, and the viewer projection is written after the promotion transaction. `docs/execution-spec-2026-07-29.md` now amends T2.1 to require monotonic refresh-start/lease ordering and atomic canonical-plus-public projection in new migration `014_score_promotion_ordering.sql`; the milestone-confirmation migration moves to `015`.

#### T0.3 — Emailed unsubscribe link works

Winner email generation signs `HMAC-SHA256(NOTIFICATION_TOKEN_SECRET, subscription.id)`, and the unsubscribe handler recomputes and constant-time-compares that same HMAC before moving the row to `unsubscribed`. Future winner selection filters to `status = 'verified'`. The separately generated `unsubscribe_token_hash` stored during initial subscription is unused dead state, but it is not the emailed token contract and does not break the link. T1.7 is therefore not required.

The end-to-end regression renders a real winner email, extracts its unsubscribe URL, calls the real handler, verifies the row becomes `unsubscribed`, resolves a later winner for the same participant, and proves no second email is sent.

### Phase 0 verification

- Baseline confirmed at `2f357d9` on `main`; pre-existing untracked design/architecture/marketing files were preserved.
- `npm test -- --run`: 143/143 tests pass across 24 files, including the disposable PostgreSQL concurrency and direct-SQL audits.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: passes.
- `npm run build`: passes.
- `git diff --check`: passes.
- `PLAYWRIGHT_PORT=5199 npx playwright test`: 32/32 pass across Chromium and WebKit.
- Migrations `000`–`011` apply unchanged to disposable PostgreSQL 17; the harness executes the activation RPC as `service_role` and removes its container after the run.
- No production migration, Cloudflare deploy, Stripe change/charge, live email, or production data mutation was performed.

### Step 8 owner decisions

- [x] Launch with 60-second polling and amend the three realtime claims in `PRODUCT.md`, `DESIGN.md`, and `tasks/todo.md` during T3.4.
- [x] Document a React Router advisory exception through the season; schedule the major upgrade after the season.
- [x] Include one real $4.99 charge followed by a refund in Phase 4, with fresh action-time approval required immediately before submitting the charge.
- [x] Keep already-published boards live after entitlement revocation; block only new activations.

## Organizer setup flow repair plan — July 29, 2026

- [x] Reproduce Overview → Continue setup → Edit in the authenticated production Safari session without changing board data.
- [x] Verify normal scroll, Page Down, draggable-scrollbar, assignment-mode, and draft Preview behavior.
- [x] Trace the flow through `OrganizerDashboard`, `AdminPanel`, `BoardView`, `ScheduledGamePicker`, `GameDayHorizon`, and the global Lenis runtime.
- [x] Save and inspect the four-step audit evidence in `docs/audits/organizer-setup-2026-07-29/`.
- [x] Replace the fixed nested commissioner scroller with one normal document-flow scroll owner; make the organizer header sticky and remove Preview clipping.
- [x] Scope Lenis to cinematic surfaces or explicitly exclude native application scrollers.
- [x] Replace the phase-blind Overview CTA with typed Assign, Reconcile, Draw, Preview, and Scoring destinations with scroll, focus, and announcements.
- [x] Put Grid Editor and draw before secondary settings; collapse and lazy-mount `Change scheduled game`.
- [x] Always render the blank 10×10 board in organizer Preview with draft-aware copy.
- [x] Make payment review advisory, prioritize published/game-day state, and replace `Locked (Unpaid)` lifecycle copy.
- [x] Present pre-activation live scoring as an unavailable paid-service card while preserving free board interaction.
- [x] Share exact 0–9 axis validation between Overview and publication.
- [x] Add Chromium and WebKit coverage for phase routing, scroll/focus, assignment, blank Preview, lifecycle state, and entitlement boundaries.
- [x] Run full unit, API, type, build, responsive, accessibility, Chromium, and WebKit verification before release.

### Organizer setup audit review

- Root cause: global Lenis cancels wheel/touch input while commissioner mode is a fixed nested native scroller. The document cannot move because fixed organizer content contributes no document height.
- The scrollbar itself can be dragged, proving that the content exists and the failure is input routing/scroll ownership rather than missing board data.
- `Continue setup` changes only the tab. The full unbounded schedule then separates the organizer from Grid Editor by many viewports.
- Preview and lifecycle logic contain additional contradictions documented in the audit report. No board data or production state was changed during investigation.

### Organizer setup repair review

- Organizer mode now uses native document scrolling. Lenis mounts only with the cinematic landing page and is destroyed when that route unmounts.
- Assign opens Edit with Grid Editor first, enables assignment mode, and focuses the label field. The phase rail has typed destinations for assignment, private payment review, number draw, Preview, and game-day scoring.
- The NFL schedule is collapsed and unfetched until the organizer explicitly opens it. Secondary settings follow the grid and draw.
- Empty private Preview renders the exact 100-cell board. Unactivated boards keep all core board interactions while presenting live scoring, updates, scenarios, notifications, and sharing as paid services.
- Payment review is advisory, published state wins lifecycle precedence, and both UI and publication now share exact permutation validation for digits 0–9.
- `npm test -- --run`: 138/138 pass across 22 files.
- `PLAYWRIGHT_PORT=5199 npx playwright test --project=chromium`: 16/16 pass.
- `PLAYWRIGHT_PORT=5199 npx playwright test --project=webkit`: 16/16 pass, including phone-size document scrolling, Page Down, wheel, assignment focus, lazy schedule, blank Preview, and entitlement boundaries.
- `npm run build`, `npx tsc --noEmit`, responsive overflow assertion, keyboard focus checks, and `git diff --check`: pass.
- No production deployment or push was performed in this implementation turn.

## QA board preview visibility — July 29, 2026

- [x] Inspect the rendered QA board and identify the organizer preview boundary.
- [x] Trace Overview, Edit, and Preview state through `BoardView` and `AdminPanel`.
- [x] Keep draft/unactivated organizer boards fully visible, editable, and interactive.
- [x] Gate automatic live-score refresh, live scenarios/updates, notifications, and published sharing behind activation.
- [x] Add browser and API coverage for the free-board/paid-services boundary.
- [x] Run the focused browser test, full test suite, build, and diff checks.

### QA board preview review

- The organizer-owned 10×10 board is no longer dimmed or pointer-disabled before activation. Edit controls, preview, zoom, square inspection, and Find My Squares remain available.
- Unactivated previews now identify the grid as `Board preview` and explain that live scoring, automatic updates, winner scenarios, notifications, and published sharing are the paid GridOne services.
- Client polling is disabled until activation. The automatic score endpoint independently returns `402` before cached-score reads, ESPN refreshes, milestone resolution, or notification work when `board_activations` is empty.
- `npm test -- --run`: 120/120 pass across 20 files.
- `PLAYWRIGHT_PORT=5199 npx playwright test`: 15/15 browser workflows pass, including free draft edit/preview interaction with no automatic score request.
- `npm run build`, strict `tsc --noEmit --noUnusedLocals --noUnusedParameters`, and `git diff --check`: pass.

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
- [x] Ship read-only viewer board and score updates through visibility-aware one-minute polling; realtime transport is deliberately deferred until after the 2026 season.
- [x] Add migration and RLS tests for anonymous viewer, owner, and non-owner behavior.

## 2. Server-authoritative NFL scoring

- [x] Remove Gemini API usage and credentials from the browser bundle.
- [x] Add an authenticated/board-scoped Cloudflare score endpoint.
- [x] Allow at most one external score refresh per board freshness window.
- [x] Validate, normalize, and persist all Gemini score responses before rendering.
- [x] Include source, fetched time, freshness, game state, and failure details.
- [x] Stop automatic refresh after Final and avoid background/inactive-tab polling.
- [x] Prevent stale async results from overwriting manual mode or newer snapshots.
- [x] Poll persisted score changes about every minute, pause while hidden, and retain polling as the explicit launch transport.
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
- [ ] Run a two-context full-stack flow: signup → create → share → viewer opens → manual score → polled winner update.
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
- Final production verification after custom-domain propagation: authenticated Create → Dashboard → Organizer navigation stayed in one shell; the completed-game board returned to ESPN authority at Final 29–13 with event `401772988`; the legacy `Test 1` draft linked to the canonical CAR-at-ARI event and persisted the corrected 7:00 PM kickoff across reload; a one-square `QA Workflow` assignment persisted after the explicit revision-conflict Retry path. Paid publish, a real Stripe charge, and recipient email delivery were intentionally not executed.
