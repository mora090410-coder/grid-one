# GridOne Architecture

This file describes the current production architecture, not an immutable topology or component vocabulary. Explore alternative seams, materials, and mechanisms when they improve the user outcome or maintainability. Adopt them only within approved scope with coordinated contracts/tests, reversible implementation, and relevant verification. Unchanged surfaces retain the coherent current token system. Browser/server credential isolation, owner/public/family privacy, payment boundaries, score authority, and data integrity remain binding.

## Topology

- **Frontend:** React 19 + TypeScript + Vite, built to `dist/` and served as a SPA by **Cloudflare Pages** (`wrangler.toml`, `pages_build_output_dir = "dist"`).
- **API:** **Cloudflare Pages Functions** under `functions/api/`. One file, one edge handler.
- **Scheduled work:** two **Cloudflare Workers** in `workers/`, each on a one-minute cron:
  - `workers/score-refresh-scheduler.ts` (`wrangler.score-scheduler.toml`) calls `POST /api/scores/refresh`.
  - `workers/notification-retry-scheduler.ts` (`wrangler.retry-scheduler.toml`) calls `POST /api/notifications/retry`.
  Both authenticate with `CRON_SECRET`; the endpoints do the work, the workers only wake them.
- **Data:** Supabase Postgres with Row Level Security. Schema and policies live in `supabase/migrations/` (`000`–`025`). The browser client is `services/supabase.ts`.
- **Payments:** Stripe Checkout — session creation and webhook activation in `functions/api/stripe/`.
- **NFL schedule and live score:** ESPN, server-side only, through `functions/_lib/espnNfl.ts`. `functions/api/nfl/games.ts` lists scheduled games; `functions/api/scores/refresh.ts` fetches the live scoreboard **once per cron tick for the whole slate** and promotes canonical snapshots.
- **Paper-board import:** Gemini OCR runs only inside `functions/api/boards/scan.ts`. It never runs in the browser.
- **Email:** Resend, server-side, from the notification endpoints.

## Routes

`App.tsx` owns every route with `react-router-dom` v7.

| Path | Element |
|---|---|
| `/` | `src/features/homepage/Homepage` (lazy). With `?poolId=` it renders `BoardView` instead. |
| `/demo` | `BoardView` in demo mode |
| `/b/:shareCode` | `BoardView` — the public viewer link |
| `/boards/:boardId` | `BoardView` behind `RequireAuth` — the organizer workspace |
| `/family` | Scoped private family editor; fragment credential, no organizer account |
| `/s/:code` | Public seller link: pick a seller's unsold squares and claim them by name; no account |
| `/login` | `pages/Login` |
| `/dashboard` | `pages/Dashboard` behind `RequireAuth` |
| `/create` | Public `pages/CreateContest` preview; API creation remains authenticated |
| `/paid` | `pages/Paid` — checkout return |
| `/articles`, `/articles/:slug` (12 guides) | `pages/*` (lazy) |
| `/privacy`, `/terms` | `pages/Privacy`, `pages/Terms` |
| `*` | `pages/NotFound` |

## Frontend structure

### `src/design/` — the design system

- `tokens.css` is the single source of current production token truth: the maintained palette, plus semantic tokens that flip on `[data-base="dark"]` (viewer, homepage, site) and `[data-base="cream"]` (organizer). Keep its normative values until a replacement is intentionally adopted.
- `src/index.css` re-exposes those variables to Tailwind v4 through `@theme inline`, and holds the deliberately unlayered cascade guards (button fill re-assertion, focus rule, dialog and organizer-header elevation, square board corners).
- `Base.tsx` sets `data-base` and the page ground.
- `primitives/`: `Glass`, `Island`, `Sheet`, `Capsule`, `Ring`, `Numeral`, `Eyebrow`, `Spotlight`, and `motion.ts` (durations, easings, `useReducedMotion()`). These are current shared building blocks, not a requirement to reproduce Broadcast Glass in every proposal.
- Mapping reference: `docs/DESIGN_TOKENS.md`. Normative current-implementation meaning and intentional adoption contract: root `DESIGN.md`.

### `src/features/` — the shipped surfaces

- `homepage/` — `Homepage.tsx` composes the static hero, ivory organizer chapter, score explanation, pricing/FAQ and local grouped footer. Sample data remains in `demoData.ts` and `renders/organizerDemoData.ts`; `pricing.ts` is the price ladder. `atmosphere/useScoreExplanation.ts` imports GSAP only when the score explanation enters view, owns one local timeline/observer, and reverts on unmount. The former fill, parallax, reveal and device-preview implementations have been retired from the homepage. Shared motion primitives remain available to other surfaces.
- `viewer/` — composed by `shell/ViewerShell.tsx`: `shell/ViewerIsland`, `score/ScoreInstrument`, `identity/FindSquaresEntry`, `personal/YourSquaresSummary`, `scenarios/ScenarioDisclosure`, `notifications/WinnerEmailDisclosure`, `details/BoardDetailsDisclosure`, `board/ViewerBoardGrid`. Pure logic sits beside each: `viewerScoreModel`, `viewerIdentityModel`, `scenarioModel`, `milestoneViewModel`, `boardGridModel`.
- `organizer/` — `workspace/OrganizerWorkspace.tsx` composes `WorkspaceHeader`, `OrganizerIsland`, `BoardEditor`, `RangeAssignBar`, `SquareSheet`, `DrawControl`, `ReconcileCard`, `PayoutRulesCard`, `BoardToolsCard`, the `PreviewSheet` → `PublishSheet` → `PublishedSheet` sequence, `UpgradeSheet`, and `gameday/` (`SharePanel`, `ScoreAuthorityCard`, `CorrectionsCard`, `DeliveryIssuesCard`, `FinalRecordCard`). Behavior lives in `lifecycle/organizerLifecycle.ts`, `draft/draftSaveModel.ts`, `game-day/manualScoringModel.ts`, and the workspace's own `useWorkspaceDraft`, `selection`, `secureDraw`, `publishBoard`, `applyScheduledGame`, `entryMetaService`, `renamePublishedSquare`.
- `site/` — the chrome shared by every non-product route: `SiteHeader`, `SiteFooter`, `SitePage`, `ArticleShell`.
- `instrumentation/` — `eventSchema.ts` (the closed event union) and `clientEvents.ts`.

### Shared app code

- `pages/` — route-level orchestration only.
- `components/` — `BoardView` (the viewer/organizer host), auth guards, error boundary, loading.
- `hooks/` — `usePoolData` (board read/write), `useContestEntries` (participants and assignments), `useLiveScoring` (score polling and freshness), `useBoardActions` (publish/join), `useAuth`, `useDialogFocus`.
- `services/` — `supabase.ts`, `scoreService.ts`, `stripe.ts`, `boardImportService.ts`. All external SDK/API calls live here.
- `utils/` — pure logic with unit tests: winner logic, retry/backoff, player-name matching, board image.
- `context/AuthContext` — Supabase session.

## SEO prerender

`seo/publicRouteMetadata.ts` declares the metadata for every public route. `build/staticSeoPages.ts` runs as a Vite `closeBundle` plugin and writes a static HTML file per route into `dist/`, injecting the title, canonical URL, robots directive, Open Graph tags, and JSON-LD between the `gridone:seo` markers. `tests/staticSeo.test.ts` keeps the route table, `public/sitemap.xml`, and `App.tsx` in agreement.

## Auth

1. The organizer authenticates with Supabase Auth.
2. The JWT lives in the browser session.
3. The browser sends `Authorization: Bearer <token>` to Pages Functions.
4. Functions resolve identity with `supabase.auth.getUser(token)`.
5. RLS decides everything else — client and server alike.
6. A signed-out visitor who starts a board is sent to `/login`; the draft is held in `sessionStorage` and adopted after sign-in.

Viewers never authenticate. A published board is readable through its share code and nothing more.

## API surface

```
functions/api/health.ts
functions/api/pools.ts                                  create
functions/api/pools/[id].ts                             read / update
functions/api/pools/[id]/publish.ts
functions/api/pools/[id]/score.ts                       viewer score projection
functions/api/pools/[id]/score/manual.ts                organizer manual authority
functions/api/pools/[id]/open-squares.ts
functions/api/pools/[id]/milestones/[milestone]/correct.ts
functions/api/pools/activate.ts
functions/api/scores/refresh.ts                         cron-driven slate refresh
functions/api/nfl/games.ts                              scheduled-game picker
functions/api/boards/scan.ts                            paper-board OCR
functions/api/boards/[shareCode]/subscribe.ts           winner-email opt-in
functions/api/notifications/verify.ts
functions/api/notifications/unsubscribe.ts
functions/api/notifications/retry.ts                    cron-driven delivery retry
functions/api/billing/status.ts
functions/api/stripe/create-checkout-session.ts
functions/api/stripe/webhook.ts
```

## Security boundaries

- Browser and server are separate security boundaries. Service-role, Stripe secret, Gemini, email, and cron secrets exist only in Pages Functions and Workers.
- Every contest table is under RLS; the anon key alone grants nothing an unauthenticated viewer should not see.
- Manual score authority is canonical until the organizer returns to automatic. A late or stale automatic result can never overwrite manual or newer state (`014_score_promotion_ordering.sql`).
- Publication is atomic (`010_atomic_board_publish.sql`); so is manual scoring (`011_atomic_manual_scoring.sql`).
- Network calls that matter use the retry utility in `utils/retry.ts` with explicit non-retry conditions. Schedule failures keep the organizer in the picker with a retry; score failures keep the last accepted snapshot and the manual path open.

## Engineering rules

- Feature-local first: components, hooks, models, and services live next to the surface that uses them. A primitive is promoted to `src/design/primitives/` only when two real features share the behavior.
- No UI logic in API handlers. No SDK side effects outside `services/`. Pure calculations in `*Model.ts` or `utils/`, with unit tests.
- Every new network call declares its retry policy and its non-retry conditions.
- Typed interfaces, not ad hoc object shapes.


## Pre-game sharing (September 4)

`026_pregame_sharing.sql` adds explicit `contests.shared_at`, guarded owner sharing via service-only `gridone_share_board`, seasonal allowance reservation, and safe public allocation projection. First share reserves activation; `published_at` continues to represent final number locking. All scoring entry points must require finalization as well as activation. The existing final snapshot lookup takes precedence over a strict sales projection at the same share code.

`POST /api/pools/:id/share` requires verified organizer identity and current revision. `functions/_lib/pregameBoard.ts` validates exactly 100 buyer cells/public allocation labels and constructs the narrow selling payload. It never projects private metadata, draft numbers, scoring or contact information. `BoardData.allocationLabels` is explicit public data independent of private entry metadata. `usePoolData` tracks sharing separately and retains visible data during background refresh. `SalesBoardViewer` owns selling presentation; `ViewerShell` retains finalized game-day behavior.

## Simpler board setup and family collaboration

`src/features/organizer/create/createDraft.ts` validates a bounded 24-hour session preview and adopts it after auth; `boardTemplateModel.ts` whitelists reusable setup. The public create route never writes anonymously.

`BoardData.participation` and `availability` are explicit public fields. Server and migration 027 validate shape and bounds; the sales projection remains an allowlist. Neither names nor payment notes imply availability.

`POST /api/pools/:id/seller-links` verifies the organizer and creates one active link per seller (`sync`) or replaces one (`rotate`). `GET /api/sellers/:code` and `POST /api/sellers/:code` read a seller's squares and claim unsold ones by name through service-only `gridone_seller_link` (migration `031_seller_links.sql`). The RPC locks the contest row, rechecks shared/lock state, seller scope (current `allocationLabels`), and that each square still shows the seller's name, then writes names and an audit event. `seller_links` has RLS enabled and no anon/authenticated grants.

`POST /api/pools/:id/family` verifies the organizer and issues, revokes, or reassigns scoped family access. `POST /api/family` accepts a family bearer token, hashes it with SHA-256 and invokes service-only `gridone_family_access`. The private table has RLS enabled and no anon/authenticated grants. The RPC serializes on the contest row before checking credential, revision and cell scope. Tokens are randomly generated 256-bit values in URL fragments; they are never stored plaintext, included in public payloads, or sent in referrers. Mutating POST requests are never automatically retried. A conflict preserves UI edits until deliberate reload.

Migration `027_family_access.sql` is additive and must be installed before releasing these controls. Rollback revokes active family links while retaining all edited names and history; do not drop the data or break existing public share links.

`POST /api/family/guest-link` accepts only `read` or `create` with the private family bearer capability. The server resolves board identity, enforces the guest rollout gate and keyed per-IP/per-capability rate limits, then calls the service-only `gridone_family_guest_link` RPC from migration `030_family_guest_links.sql`. Under the board lock, the RPC rechecks the current capability and derives exact assignment scope. Existing matching public invites retain organizer settings; disabled, expired or mismatched scopes cannot be bypassed. The response projects saved availability counts and a signed public URL only for active links. No names, availability or payment metadata are changed. The family UI keeps draft editing separate from link reads and refreshes its complete saved record after an explicit successful create while editing is disabled; it never advances a revision while retaining older saved names.


## Organizer Payments and adaptive island

`src/features/organizer/payments/paymentModel.ts` groups private statuses by responsible allocation and derives filtered square lists. `PaymentsPanel` owns search and explicit selection in the existing Sheet. `entryMetaService.savePaymentStatuses` sends only identity keys and `paid_status` in one owner-RLS upsert, then verifies the returned receipt. It neither writes public board state nor replaces seller/contact fields.

The organizer uses a feature-local island with `organizerIslandModel` and token-based CSS, leaving the shared viewer island unchanged. `OrganizerWorkspace` coordinates payment writes, save/failure state, sheet and board focus, and existing lifecycle actions. No database migration or public payload field is added.


## Guest invites (local implementation; default off, legacy)

> **Superseded 2026-09-23 by Seller links.** Organizers and families no longer create these links in the app. Links already posted still open at `/p/...` and keep working until the numbers lock; the tables, endpoints and occupancy guards below stay in place so nothing already claimed is lost.

`/p/:poolId?invite=<signed token>` is a separate anonymous guest route. On load it retains the invitation capability in browser storage and removes the query from browser history. `/dev/guest-invites` is an injected, in-memory prototype excluded from production builds. `src/features/guest/` owns the UI, transport, credential storage and invalidation hook. The organizer's Guest claim links card is separate from private Family access.

Cloudflare handlers expose `POST /api/pools/:id/guest`, owner-only `GET/POST /api/pools/:id/invites`, and public occupancy `GET /api/pools/:id/guest-state`. `functions/_lib/guestInvites.ts` validates an exact server-side board allowlist, signed invitation versions, verified owner identity, bounded request bodies, anonymous capabilities and generic payment URLs. Response projections are explicit; no credential or payment instruction appears in public state or broadcasts. Secrets remain server-side. Mutation and recovery requests have separate persistent rate limits.

Migration `029_guest_invites.sql` adds private RLS tables for invitations, claim groups, holds, claims, and rate buckets. A service-only RPC serializes on the canonical contest row and enforces lifecycle, revision, scope, current availability, holds and credentials. A unique active-claim index prevents duplicate occupation. Relational triggers protect guest occupancy from existing owner/family writers and preserve the published correction contract. Invite regeneration rotates the public invitation version while retaining claim history and quota identity. Claim-code rotation revokes the previous code and browser session.

Supabase database broadcasts on `pool:<board UUID>` carry only event/revision invalidation, never authoritative state. Clients refetch an authenticated or public projection, coalesce events and poll at 15 seconds while visible; disconnection is labelled. Correctness uses server deadlines and row locks, independent of socket timing. Hosted broadcast transport and target latency require separate pre-release verification.
