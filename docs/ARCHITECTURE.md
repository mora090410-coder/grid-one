# GridOne Architecture

## System Overview

- **Frontend:** React 19 + TypeScript + Vite, served as a SPA from Cloudflare Pages.
- **Routing:** `react-router-dom` v7 in `App.tsx`.
- **Data store:** Supabase (`contests`, `contest_entries` tables) via `services/supabase.ts`. Row Level Security enforced on all tables.
- **API layer:** Cloudflare Pages Functions under `functions/api/`. Each function is a separate edge handler.
- **Payment:** Stripe checkout session creation + webhook-based activation.
- **Live scoring:** Google Gemini Search Grounding via `services/geminiService.ts`, consumed by `hooks/useLiveScoring.ts`.

## Frontend Boundaries

- `pages/` handles route-level orchestration.
- `components/` contains UI modules.
- `hooks/` contains stateful behavior:
  - `usePoolData`: contest read/write.
  - `useLiveScoring`: live game synchronization and polling.
  - `useBoardActions`: publish/join actions and fallback API path.
- `services/` encapsulates external SDK/API calls.
- `utils/` provides pure logic/reusable infra (`retry`, winner logic, theme helpers).

## Auth Flow

1. User authenticates via Supabase Auth (email/password or OAuth).
2. Supabase issues a JWT stored in the browser session.
3. Frontend passes the JWT as `Authorization: Bearer <token>` to Cloudflare Pages Functions.
4. Functions call `supabase.auth.getUser(token)` to resolve the user identity server-side.
5. All Supabase queries (both client-side and server-side via anon key) are subject to Row Level Security — policies ensure users can only read/write their own contests.
6. Guest flows (unauthenticated users who start creating a board) are redirected to `/login` before any data is written. Draft state is persisted to `sessionStorage` and restored after login.

## Backend/API Boundaries
- `functions/api/pools.ts`: create route (legacy-compatible path, Supabase-backed).
- `functions/api/pools/[id].ts`: read/auth/update by id.
- `functions/api/stripe/create-checkout-session.ts`: checkout session creation.
- `functions/api/stripe/webhook.ts`: payment completion -> contest activation.
- `functions/api/health.ts`: health probe.

## Security and Reliability Posture
- RLS policies applied to contest tables (see SQL migrations in repo root).
- No secrets in frontend runtime code.
- Network resilience:
  - Exponential retry utility in `/Users/amm13/00-Projects/GridOneApp/utils/retry.ts`.
  - Applied to checkout and critical board action API calls.
  - Live scoring already includes retry/backoff for upstream ESPN proxy failures.

## Core Engineering Rules
- Keep UI logic out of API handlers.
- Keep SDK side effects in `services/`.
- Keep pure calculations in `utils/` with unit tests.
- Prefer typed interfaces over ad hoc object shapes.
- Any new network call should define retry policy and explicit non-retry conditions.
