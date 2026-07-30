# GridOne

Football squares board builder and live scoring viewer. Organizers create and share boards; everyone else follows the live game from one link.

## Product model

- Organizer creates an account and builds or uploads a board
- Building, editing, and previewing unlimited draft boards is **free**
- The Free tier includes **1 published board per account per season**
- **Game Day is $9.99 once** for up to 5 published boards in the 2026 season
- **Organization is $79 per season** for up to 50 published boards plus organization naming, a shared dashboard, and one organization receipt
- Payment gates published-board count only; every published board includes live scores, scenarios, Find My Squares, winner emails, and QR sharing
- Each published board provides one viewer link; everyone can follow it, but only the organizer can make changes

## Tech stack

- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** Tailwind CSS v4 with design tokens (see `docs/DESIGN_TOKENS.md`)
- **Auth & data:** Supabase (PostgreSQL + Row Level Security)
- **Payments:** Stripe checkout + webhook activation
- **Deployment:** Cloudflare Pages + Cloudflare Pages Functions (API routes)
- **NFL schedule and scoring:** server-side exact-event ESPN lookups, cached and validated before persistence
- **Paper-board import:** server-side Gemini OCR with organizer review

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
   Migration files are in `supabase/migrations/`.

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. For local API/function testing (requires wrangler):
   ```bash
   npm run local
   ```

## Environment variables

Create `.env.local` with the following variables:

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, never expose to frontend) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (frontend) |
| `STRIPE_SECRET_KEY` | Stripe secret key (Cloudflare Functions only) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_GAMEDAY_PRICE_ID` | Verified one-time $9.99 Game Day price ID (server-side only) |
| `STRIPE_ORG_PRICE_ID` | Verified one-time $79 Organization price ID (server-side only) |
| `PAID_SIGNUP_ENABLED` | Checkout kill switch; keep `false` until both approved prices are configured |
| `GEMINI_API_KEY` | Server-only Gemini key for beta paper-board import |
| `OCR_MODEL` | Gemini model used only for paper-board import |
| `PUBLIC_SITE_URL` | Canonical site URL — `https://www.getgridone.com` in production |
| `EMAIL_PROVIDER_API_KEY` | Server-only Resend sending key |
| `EMAIL_FROM` | Verified sender identity — `GridOne <updates@parksideag.com>` in production |
| `CRON_SECRET` | High-entropy token for scheduled notification processing |
| `RETRY_ENDPOINT` | HTTPS URL the one-minute Cron Worker calls to process notification retries |
| `NOTIFICATION_TOKEN_SECRET` | High-entropy signing key for verification and unsubscribe links |
| `SCORE_TEST_MODE_ENABLED` | Server-only kill switch; score-test requests are honored only for the exact value `true` |
| `SCORE_TEST_MODE_OWNER_IDS` | Comma-separated authenticated owner UUID allowlist; both this and the kill switch are required |

See `.env.example` for a template.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run local` | Run Cloudflare Pages + Vite locally |
| `npm run build` | Production build (TypeScript + Vite) |
| `npm run test` | Run Vitest |
| `npm run test:coverage` | Run Vitest with coverage report |

## Notes

- Production domain: `www.getgridone.com`
- Cloudflare Redirect Rule `Canonical apex to www` permanently redirects `https://getgridone.com/*` to `https://www.getgridone.com/${1}` with the query string preserved. This hostname redirect is configured at the zone edge, not in Pages `_redirects`.
- Brand name is **GridOne** — do not use legacy names (SBXPRO, five-star-grid-pool, etc.)
- Do not materially redesign theme/styling without intent
- Use design tokens as the customization layer — see `docs/DESIGN_TOKENS.md`
- Architecture decisions are documented in `docs/ARCHITECTURE.md`
