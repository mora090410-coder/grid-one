# GridOne Architecture

## System Overview
- Frontend: React + TypeScript + Vite.
- Routing: `react-router-dom` in `/Users/amm13/00-Projects/GridOneApp/App.tsx`.
- Data store: Supabase (`contests`, `contest_entries`) via `/Users/amm13/00-Projects/GridOneApp/services/supabase.ts`.
- Edge/API layer: Cloudflare Pages Functions under `/Users/amm13/00-Projects/GridOneApp/functions/api`.
- Payment: Stripe checkout + webhook activation.
- Live scoring: ESPN scoreboard through proxy (`VITE_LIVE_PROXY_URL`) consumed by `/Users/amm13/00-Projects/GridOneApp/hooks/useLiveScoring.ts`.

## Frontend Boundaries
- Pages (`/Users/amm13/00-Projects/GridOneApp/pages`) handle route-level orchestration.
- Components (`/Users/amm13/00-Projects/GridOneApp/components`) are UI modules.
- Hooks (`/Users/amm13/00-Projects/GridOneApp/hooks`) contain stateful behavior:
  - `usePoolData`: contest read/write + migration flows.
  - `useLiveScoring`: live game synchronization and polling.
  - `useBoardActions`: publish/join actions and fallback API path.
- Services (`/Users/amm13/00-Projects/GridOneApp/services`) encapsulate external SDK/API calls.
- Utilities (`/Users/amm13/00-Projects/GridOneApp/utils`) provide pure logic/reusable infra (`retry`, winner logic, theme helpers).

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
