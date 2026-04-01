# GridOne

Football squares board builder and live scoring viewer. Organizers create and share boards; viewers get a read-only board with live game scoring.

## Product model

- Organizer creates an account and builds or uploads a board
- Organizer unlocks sharing for **$14.99 per board**
- One unlocked board supports up to 100 viewers
- Viewers get read-only access to the board, scoreboard, and winner highlights

## Tech stack

- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** Tailwind CSS v4 with design tokens (see `docs/DESIGN_TOKENS.md`)
- **Auth & data:** Supabase (PostgreSQL + Row Level Security)
- **Payments:** Stripe checkout + webhook activation
- **Deployment:** Cloudflare Pages + Cloudflare Pages Functions (API routes)
- **Live scoring:** Google Gemini Search Grounding via `services/geminiService.ts`

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
| `VITE_GEMINI_API_KEY` | Google Gemini API key for live scoring |
| `PUBLIC_SITE_URL` | Canonical site URL — `https://www.getgridone.com` in production |

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
- Brand name is **GridOne** — do not use legacy names (SBXPRO, five-star-grid-pool, etc.)
- Do not materially redesign theme/styling without intent
- Use design tokens as the customization layer — see `docs/DESIGN_TOKENS.md`
- Architecture decisions are documented in `docs/ARCHITECTURE.md`
