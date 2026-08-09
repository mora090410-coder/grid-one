# GridOne Launch-Readiness Review — Execution Plan

**Status:** APPROVED PLAN — NOT YET EXECUTED. No review, refactor, or fix work begins until explicitly initiated.
**Date:** 2026-07-28
**Mode:** Findings-only audit. No code changes, no migration runs, no Supabase/Stripe dashboard access, no deploys at any phase.

---

## Scope & context

- **Codebase:** the current working tree on `main`, including all uncommitted changes (cinematic landing redesign, season-pass entitlements, manual per-quarter scoring, ~35 modified files). This is a whole-app audit, not a diff review.
- **Stack:** React 19 + Vite SPA · Supabase (auth, Postgres, RLS, realtime) · Cloudflare Pages Functions (`functions/api/*`: Stripe checkout/webhook, pools API) · Gemini API · GSAP/Lenis landing page.
- **Special condition:** the Supabase project was just reinstalled. The four files in `supabase/migrations/` are the source of truth for what exists in prod. Any code referencing schema objects not created by those files is a guaranteed runtime failure.
- **Pre-existing unconfirmed flag:** an aborted preliminary pass suggested the app references a `contests` table that no migration creates. Treated as a hypothesis for Phase 1/4 to confirm or refute — not a finding yet.
- **Out of scope:** applying fixes, `docs/marketing/` content, `.impeccable/`, Playwright infrastructure itself.

---

## Phase 0 — Baseline health (~5 min, mechanical, included by decision)

Establish ground truth before any code reading. These commands execute code locally but change nothing and touch no external systems.

1. `npm run build` — runs `tsc` then vite build; catches type/schema drift cheaply.
2. `npx vitest run` — existing suites: `tests/winnerLogic.test.ts`, `tests/retry.test.ts`.
3. Env-var audit: cross-check every `import.meta.env.*` (client) and `env.*` (functions) reference against `wrangler.toml` / local `.env` presence. The reinstalled Supabase project means a new URL and new keys — stale values are a likely launch blocker.

If build or tests fail, reviewers are briefed on the failure so they investigate *why* instead of rediscovering it.

## Phase 1 — Parallel dimension reviews (5 read-only reviewers)

Each reviewer reads its file set fully and reports: severity (critical/high/medium/low) · `file:line` · one-sentence defect · concrete failure scenario. Verified-in-code issues only; no speculation. Each also notes what is genuinely solid.

### 1.1 Auth & Security
- **Files:** `context/AuthContext.tsx`, `hooks/useAuth.ts`, `components/auth/RequireAuth.tsx`, `pages/Login.tsx`, `services/supabase.ts`, all 4 migrations (RLS focus), all `functions/api/*`, `wrangler.toml`, `vite.config.ts`, `services/geminiService.ts`, `components/AdminPanel.tsx`, `components/board/RecoveryModal.tsx`.
- **Hunts for:** RLS holes (non-organizer writing scores, stealing squares, self-granting entitlements); missing server-side auth on API endpoints; Stripe webhook signature verification; secrets leaking into the client bundle (the Gemini key in a Vite SPA is a prime suspect); XSS via player names; open redirects; guessable recovery codes; CORS and rate-limiting gaps.

### 1.2 Live Scoring & Winner Logic
- **Files:** `hooks/useLiveScoring.ts`, `services/scoreService.ts`, `utils/winnerLogic.ts` + tests, `utils/retry.ts`, `components/AdminPanel.tsx` (manual per-quarter entry), realtime propagation in `hooks/usePoolData.ts`, `fixtures/sampleBoard.fixture.ts`.
- **Hunts for:** polling that never stops / stale closures; malformed-API-response crashes; axis-orientation bugs (home vs away rows/cols); winners computed before digits assigned; manual scores overwritten by live polling (and vice versa); per-viewer client polling hitting API rate limits on game day; quarter/final/OT detection errors; duplicate winner announcements.

### 1.3 Payments & Entitlements (Stripe season pass — $4.99 once / up to 20 boards)
- **Files:** `services/stripe.ts`, `functions/api/stripe/create-checkout-session.ts`, `functions/api/stripe/webhook.ts`, `functions/api/pools.ts`, `functions/api/pools/activate.ts`, `functions/api/pools/[id].ts`, `supabase/migrations/005_canonical_launch_schema.sql`, `pages/Paid.tsx`, `pages/CreateContest.tsx`, `hooks/useContestEntries.ts`, `components/BoardWizard/WizardModal.tsx`.
- **Hunts for:** client-controlled pricing; webhook idempotency (double-grant on Stripe retries); lost grants on webhook errors; 20-board cap enforced client-side only; users inserting their own entitlement rows via RLS gaps; paid-but-webhook-delayed UX dead ends; secret handling for Stripe keys.

### 1.4 Data Layer & Concurrency
- **Files:** `hooks/usePoolData.ts`, `hooks/useBoardActions.ts`, `hooks/useContestEntries.ts`, `functions/api/pools*`, all migrations (constraints/indexes/cascades), `types.ts`, `components/board/RecoveryModal.tsx`, `components/board/FindSquaresModal.tsx`, `App.tsx` data flow.
- **Hunts for:** simultaneous claims of the same square (unique constraint vs last-write-wins); non-atomic number randomization, or re-randomization after squares are sold; **schema drift — every table/column/RPC the code touches vs. what the 4 migrations create** (owns the `contests` hypothesis); missing indexes on hot queries; nullable columns the code assumes non-null; type mismatches that crash at runtime; refetch behavior on auth change / tab refocus.

### 1.5 UI/UX & Launch Polish
- **Files:** `components/LandingPage.tsx` + `lib/scrollRuntime.ts`, `components/BoardView.tsx`, `components/BoardGrid.tsx`, `components/board/*` modals, `components/OrganizerDashboard.tsx`, `pages/Dashboard.tsx`, `components/BoardWizard/WizardModal.tsx`, `pages/Login.tsx`, `components/ErrorBoundary.tsx` / `loading/` / `empty/` and their actual usage in `App.tsx`, `index.html` + `components/seo/*`, `README.md`.
- **Hunts for:** mobile usability of the 10×10 grid (touch targets, horizontal scroll); GSAP/Lenis cleanup and `prefers-reduced-motion`; missing error/loading/empty states; 404 handling and scroll restoration; share-link/QR correctness; modal focus traps and keyboard access; console.log/TODO/placeholder copy in user-visible paths; OG/meta tags and favicon; README deploy-step accuracy.

## Phase 2 — Adversarial verification

- Every **critical/high** finding gets an independent verification pass: a fresh reviewer per finding, prompted to *refute* it. Findings that don't survive are dropped or downgraded.
- **Medium/low** findings are spot-checked by the lead.
- Cross-dimensional issues (e.g. scoring × RLS, payments × schema drift) are traced end-to-end here.

## Phase 3 — Consolidated report (the deliverable)

One report, ordered by launch impact:

1. **Launch blockers** — ship-stoppers: data loss, payment holes, prod crashes from schema drift.
2. **High** — will bite real users on game day.
3. **Medium/Low** — fix-after-launch list.
4. **What's solid** — the areas verified as sound.
5. **Suggested fix order** — a sequenced punch list, presented for approval as a separate work phase. No fixes applied until explicitly approved.

Each finding: severity · `file:line` · defect · concrete failure scenario · suggested fix direction.

## ── GO/NO-GO GATE ──

Phase 4 does not run until the Phase 3 report has been reviewed and Phase 4 is explicitly approved.

## Phase 4 — Live smoke test against the reinstalled Supabase project (gated)

Purpose: confirm or refute what static analysis can only suspect — schema drift, env wiring, realtime behavior — against the real database.

- **Setup:** local dev server (`npm run dev` + wrangler functions via the browser-preview tooling); throwaway test account; test data only.
- **Flow exercised:** signup/login → create board → share link opens → claim a square (two browser contexts for the concurrency check) → manual per-quarter score entry → winner display. Stripe checkout exercised only in **test mode**, and only if test-mode keys are configured — never a real payment.
- **Observed:** console errors, failed network requests (404s on missing tables/RPCs, 401/403s on RLS), realtime update propagation.
- **Boundaries:** no prod writes beyond throwaway test rows; no dashboard changes; findings appended to the Phase 3 report with the same severity rubric.

---

## Decisions locked in

| Question | Decision |
|---|---|
| Run Phase 0 build/tests as part of the review? | **Yes** — read-only in effect, cheapest ground truth. |
| Live testing? | **Yes, as Phase 4** — gated behind the Phase 3 report and explicit approval. |
| Apply fixes during review? | **No** — findings only; fix work is a separate approved phase. |
