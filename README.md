# GridOne

Football-squares board builder and live game-day viewer. An organizer builds a 10×10 board, draws the axis numbers, and publishes one link; everyone else follows the live NFL score from that link with no account.

## Product model

- The organizer creates an account and builds or imports a board
- Building, editing, and previewing unlimited draft boards is **free**
- The Free tier includes **1 published board per account per season**
- **Game Day is $9.99 once** for up to 5 published boards in the 2026 season
- **Organization is $79 per season** for up to 50 published boards plus organization naming, a shared dashboard, and one organization receipt
- Payment gates published-board count only; every published board includes live scores, scenarios, Find my squares, winner emails, and QR sharing
- Each published board provides one viewer link; anyone can follow it, only the organizer can change it
- GridOne never collects square money, holds funds, or pays winners

The ladder is written once, in `src/features/homepage/pricing.ts`. Change it there, in Stripe, and nowhere else.

## Tech stack

- **Frontend:** React 19 + Vite + TypeScript, deployed to Cloudflare Pages (build output `dist/`)
- **Styling:** Tailwind CSS v4 over the Broadcast Glass tokens in `src/design/tokens.css` — see `docs/DESIGN_TOKENS.md`
- **API:** Cloudflare Pages Functions in `functions/api/`
- **Scheduled work:** two one-minute Cloudflare cron Workers in `workers/` — score refresh and notification retry
- **Auth & data:** Supabase (PostgreSQL + Row Level Security), migrations in `supabase/migrations/`
- **Payments:** Stripe Checkout + webhook activation
- **NFL schedule and scoring:** server-side ESPN lookups, validated and cached before persistence
- **Paper-board import:** server-side Gemini OCR with organizer review

Architecture: `docs/ARCHITECTURE.md`. Product truth: `PRODUCT.md`. Design: `DESIGN.md`.

## Local development

### Prerequisites

- Node.js 20+
- npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example env file and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

3. Link to your Supabase project (or start a local instance):
   ```bash
   # Option A: link to an existing Supabase project
   supabase link --project-ref <your-project-ref>

   # Option B: start a local Supabase instance
   supabase start
   ```

4. Apply database migrations:
   ```bash
   supabase db push
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. For local API/function testing (requires wrangler):
   ```bash
   npm run local
   ```
   Vite proxies `/api` to `wrangler pages dev` on port 8788.

## Environment variables

Create `.env.local` with the following variables:

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, never expose to the browser) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (frontend) |
| `STRIPE_SECRET_KEY` | Stripe secret key (Cloudflare Functions only) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_GAMEDAY_PRICE_ID` | Verified one-time $9.99 Game Day price ID (server-side only) |
| `STRIPE_ORG_PRICE_ID` | Verified $79 Organization price ID (server-side only) |
| `PAID_SIGNUP_ENABLED` | Checkout kill switch; keep `false` until both approved prices are configured |
| `GEMINI_API_KEY` | Server-only Gemini key for paper-board import |
| `OCR_MODEL` | Gemini model used only for paper-board import |
| `PUBLIC_SITE_URL` | Canonical site URL — `https://www.getgridone.com` in production |
| `EMAIL_PROVIDER_API_KEY` | Server-only Resend sending key |
| `EMAIL_FROM` | Verified sender identity — `GridOne <updates@parksideag.com>` in production |
| `CRON_SECRET` | High-entropy bearer token the cron Workers present to their endpoints |
| `REFRESH_ENDPOINT` | HTTPS URL the one-minute score Worker calls (`/api/scores/refresh`) |
| `RETRY_ENDPOINT` | HTTPS URL the one-minute retry Worker calls (`/api/notifications/retry`) |
| `NOTIFICATION_TOKEN_SECRET` | High-entropy signing key for verification and unsubscribe links |
| `LIVE_SCORING_ENABLED` | Live-scoring kill switch, editable from the Cloudflare dashboard |
| `SCORE_POLL_SECONDS` | Viewer polling cadence hint (60 in production) |
| `SCORE_TEST_MODE_ENABLED` | Server-only kill switch; score-test requests are honored only for the exact value `true` |
| `SCORE_TEST_MODE_OWNER_IDS` | Comma-separated authenticated owner UUID allowlist; both this and the kill switch are required |

See `.env.example` for a template.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run local` | Run Cloudflare Pages Functions + Vite locally |
| `npm run build` | Production build (`tsc && vite build`, including the static SEO prerender) |
| `npm run test` | Vitest in watch mode |
| `npm run test:unit` | Unit suite (`vitest run --project unit`) |
| `npm run test:integration` | Postgres-container integration suite (requires Docker) |
| `npm run test:coverage` | Vitest with a coverage report |
| `npm run design:lint` | `designmd lint DESIGN.md` |

Playwright is a devDependency but has no npm script; run it directly:

```bash
npx playwright test --project=chromium
```

### Release gates

```bash
npx tsc --noEmit
npx vitest run --project unit
npm run build
npm run design:lint
npx playwright test --project=chromium
```

See `docs/TEST_STRATEGY.md` for what each layer owns.

## Deploying to production

The repo cannot tell you which migrations or Worker versions are live. Check the
Supabase and Cloudflare dashboards before relying on anything below.

- **Site and API.** The Cloudflare Pages project `grid-one` (domains
  `grid-one.pages.dev`, `getgridone.com`, `www.getgridone.com`; `wrangler.toml`'s
  `name = "gridone"` is the Wrangler config name, not the Pages project) is Git-connected and
  builds production from `main` (`npm ci && npm run build`, output directory
  `dist`). `git push origin main` therefore deploys both the site and the Pages
  Functions in `functions/`. There is no manual deploy step.
- **Node version.** `.node-version` pins `22`, which Cloudflare Pages reads; keep
  the `NODE_VERSION` environment variable on the Pages project in step with it.
  Wrangler 4 needs Node 20 or newer.
- **Cron Workers.** The two scheduled Workers deploy separately and are *not*
  covered by a push to `main`:

  ```bash
  npx wrangler deploy -c wrangler.score-scheduler.toml
  npx wrangler deploy -c wrangler.retry-scheduler.toml
  ```

- **Secrets.** `CRON_SECRET` must be set on both Workers and on the Pages project —
  the Workers sign their cron call with it and the Pages Functions
  (`/api/scores/refresh`, `/api/notifications/retry`) check it. `REFRESH_ENDPOINT`
  and `RETRY_ENDPOINT` are plain vars already committed in the two scheduler
  `wrangler.*.toml` files; override them per environment if the endpoint moves.
- **Database.** Migrations in `supabase/migrations/` are applied by hand through
  the Supabase dashboard SQL editor. Nothing in the repo records which have been
  applied — verify the complete sequence through `037` (intentional `004` gap),
  including both `035` then `036`, before relying on the integrated candidate.
  See `docs/audit-release-preflight.md`. No migration or deployment is authorized
  merely by these instructions; the pricing remediation is still incomplete.

## Notes

- Production domain: `www.getgridone.com`. Cloudflare Pages builds production from `main`.
- The Cloudflare Redirect Rule `Canonical apex to www` permanently redirects `https://getgridone.com/*` to `https://www.getgridone.com/${1}` with the query string preserved. This hostname redirect is configured at the zone edge, not in Pages `_redirects`.
- Public routes are prerendered at build time: `seo/publicRouteMetadata.ts` declares the metadata and `build/staticSeoPages.ts` writes one static HTML file per route into `dist/`.
- Brand name is **GridOne** — do not use legacy names (SBXPRO, five-star-grid-pool, etc.)
- The design system is `src/design/`. Use the tokens; do not add one-off colors, fonts, or radii.
