# GridOne Full Refactor — Design Spec
**Date:** 2026-04-01  
**Status:** Approved  
**Approach:** Parallel agent execution across 4 independent domains

---

## Goal

Bring the GridOne codebase to senior engineering standards. The app (`www.getgridone.com`) was started when the developer was new to coding. The first iteration was named SBXPRO and has been fully replaced by GridOne. This refactor eliminates all legacy artifacts, enforces the existing design token system, improves component architecture, and cleans documentation — with zero behavior change.

---

## Constraints

- No product behavior changes
- App must remain fully functional after each domain
- No new dependencies
- Parallel agents must not touch overlapping files (see File Ownership table)

---

## Domain 1 — Legacy Naming & Dead Code

**Agent 1**

### localStorage Keys
Rename all `sbxpro_*` keys to `gridone_*` across every file that reads or writes them:

| Old key | New key | Files |
|---|---|---|
| `sbxpro_preview_mode` | `gridone_preview_mode` | `components/BoardView.tsx` |
| `sbxpro_tokens` | `gridone_tokens` | `components/BoardView.tsx`, `hooks/useBoardActions.ts`, `pages/CreateContest.tsx` |
| `sbxpro_guest_game` | `gridone_guest_game` | `hooks/useBoardActions.ts` |
| `sbxpro_guest_board` | `gridone_guest_board` | `hooks/useBoardActions.ts` |

### CORS Allowlists
Remove `https://sbxpro.pages.dev` from:
- `functions/api/pools.ts` — `DEFAULT_ALLOWED_ORIGINS` array
- `functions/api/pools/[id].ts` — origins array

### wrangler.toml
`name = "five-star-grid-pool"` → `name = "gridone"`

### Default Title
`hooks/useBoardActions.ts:57` — `title: g.title || "SBXPRO Pool"` → `title: g.title || "GridOne Pool"`

### pools.ts Comment Purge
The ~100-line inline dev-notes comment block in `functions/api/pools.ts` (the stream-of-consciousness reasoning about KV vs Supabase, owner_id constraints, guest flows) is replaced with a concise 3-line architectural comment:
```ts
// Pool creation requires an authenticated Supabase user.
// The Authorization header must carry a valid Supabase JWT.
// Guest flows redirect to /login before reaching this endpoint.
```

Remove the `type KVNamespace = any` alias and `POOLS: KVNamespace` from the `Env` interface — KV is no longer used.

### Sample Board Fixture
Move the hardcoded personal-names board data from `constants.ts` (`generateIndexedSquares`, `SAMPLE_BOARD`) into `fixtures/sampleBoard.fixture.ts`. Export it from there; update the single import in `constants.ts` to reference the new path. Add a comment: `// Demo fixture — not production data`.

---

## Domain 2 — Design Token Enforcement

**Agent 2**

### Token System (existing, in `src/index.css`)
The canonical token set is already defined under `@theme`. Tailwind aliases map tokens to utility classes:

| Token | Tailwind class | Value |
|---|---|---|
| `--gridone-color-background` | `bg-background` | `#0B0C0F` |
| `--gridone-color-surface` | `bg-surface` | `#1c1c1e` |
| `--gridone-color-brand-primary` | `bg-cardinal` / `text-cardinal` | `#8F1D2C` |
| `--gridone-color-brand-accent` | `bg-gold` / `text-gold` | `#FFC72C` |
| `--gridone-color-text-primary` | `text-text-primary` | `#FFFFFF` |
| `--gridone-color-text-secondary` | `text-text-secondary` | `rgba(235,235,245,0.6)` |

### Audit Scope
All `.tsx` and `.ts` files in `components/`, `pages/`, `hooks/` are audited for:
- Raw hex values (`#XXXXXX`, `#XXX`)
- Raw `rgba(...)` / `rgb(...)` that match a token value
- Tailwind arbitrary color values (`bg-[#...]`, `text-[#...]`, `border-[#...]`)

### Replacement Rules
- Match to the closest semantic token, not just the closest color value
- If no token exists for a pattern found 2+ times, add the token to `src/index.css` under `@theme` and its alias
- Do not change visual output — token values must be identical to what they replace

### Output
- All replaced values use token-based Tailwind classes
- `docs/DESIGN_TOKENS.md` — concise reference table: token name, CSS variable, Tailwind alias, usage intent, example usage

---

## Domain 3 — Component Architecture

**Agent 3**

### BoardView.tsx Split (603 lines → orchestrator + 5 focused components)

Current `BoardView.tsx` responsibilities (to be extracted):

| Extracted component | Path | Responsibility |
|---|---|---|
| `BoardHeader` | `components/board/BoardHeader.tsx` | Game title, team names, cover image display |
| `BoardScorebar` | `components/board/BoardScorebar.tsx` | Live scores, period, clock, manual score badge |
| `WinnerBanner` | `components/board/WinnerBanner.tsx` | Winner highlight for current/past quarters |
| `JoinFlow` | `components/board/JoinFlow.tsx` | Join modal, name entry, cell claim logic |
| `PreviewGate` | `components/board/PreviewGate.tsx` | Preview mode toggle, token auth for organizer |

`BoardView.tsx` becomes a thin orchestrator: imports the above, owns route params and top-level data fetch, passes props down. Target: ~150 lines.

`BoardGrid.tsx` already exists — verify it is the canonical grid render and remove any duplicated grid rendering found in `BoardView.tsx`.

### CreateContest.tsx — Wizard State Persistence
Fix CodeRabbit finding (lines 76–80): user redirected to login loses all wizard state.

**On redirect:**
```ts
sessionStorage.setItem('gridone_draft_game', JSON.stringify(game));
sessionStorage.setItem('gridone_draft_board', JSON.stringify(finalBoard));
```

**On mount (useEffect):**
```ts
const savedGame = sessionStorage.getItem('gridone_draft_game');
const savedBoard = sessionStorage.getItem('gridone_draft_board');
if (savedGame) { setGame(JSON.parse(savedGame)); sessionStorage.removeItem('gridone_draft_game'); }
if (savedBoard) { setBoard(JSON.parse(savedBoard)); sessionStorage.removeItem('gridone_draft_board'); }
```

Keys use the new `gridone_` namespace (consistent with Domain 1).

### Dashboard.tsx Review (389 lines)
Audit for mixed concerns. If player list rendering and organizer controls are co-located in render, extract:
- `components/dashboard/PlayerList.tsx`
- `components/dashboard/OrganizerControls.tsx`

Only extract if the split produces meaningfully simpler files. Do not split for the sake of splitting.

### index.html — OG/Twitter Consistency
Fix CodeRabbit finding: `twitter:url` and `twitter:image` must use `https://www.getgridone.com/` (with `www`) to match `og:url` and `og:image`.

### HowToRunSquares.tsx:41 — UX Copy
Replace vague copy per CodeRabbit finding:
- "upload a board photo if you have one" → "upload a background image of your physical board"
- "clean everything up before you publish it" → "review team names, positions, and remove any stray marks before publishing"

---

## Domain 4 — Docs, Stale Files, Structure

**Agent 4**

### Files to Delete
| File | Reason |
|---|---|
| `weekly-plan.html` | Unrelated planning artifact |
| `weekly-plan.css` | Unrelated planning artifact |
| `weekly-plan.js` | Unrelated planning artifact |
| `proxy.js` | Leftover dev utility, superseded by wrangler |

### dist/ — Git Tracking
Add `dist/` to `.gitignore` if not already present. Do not delete the directory, only stop tracking it.

### SQL Migration Structure
Move from repo root to proper Supabase convention:

| Old path | New path |
|---|---|
| `supabase_migration.sql` | `supabase/migrations/001_initial_schema.sql` |
| `supabase_migration_2.sql` | `supabase/migrations/002_board_data.sql` |
| `supabase_migration_rls.sql` | `supabase/migrations/003_rls_policies.sql` |

### README.md Rewrite
Full rewrite. Sections:

1. **What it is** — one paragraph product description
2. **Tech stack** — React + Vite + TypeScript, Supabase (auth + data), Stripe (payments), Cloudflare Pages (deployment + API functions)
3. **Local development**
   - Prerequisites: Node 20+, Supabase CLI
   - Setup steps including all required env vars (see below)
   - `supabase link` or `supabase start` instructions
   - `npm run dev` vs `npm run local`
4. **Environment variables** — full table:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (frontend) |
| `STRIPE_SECRET_KEY` | Stripe secret key (functions) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `VITE_GEMINI_API_KEY` | Gemini API key for live scoring |
| `PUBLIC_SITE_URL` | Canonical site URL (`https://www.getgridone.com`) |

5. **Scripts** — `dev`, `local`, `build`, `test`, `test:coverage`
6. **Notes** — keep: production domain, GridOne branding rule, design token system rule. Fix: "team/styling" → "theme/styling"

### docs/ARCHITECTURE.md Update
- Replace "Cloudflare Pages Functions" references with accurate description: Cloudflare Pages hosts the SPA; API routes are Cloudflare Pages Functions (this is still accurate — keep it, just be precise)
- Add section: **Auth Flow** — Supabase JWT issued on login → passed as Bearer token to API functions → functions call `supabase.auth.getUser(token)` → RLS enforced on all DB operations
- Keep all existing engineering rules section unchanged

---

## File Ownership (Parallel Safety)

| Domain | Files owned exclusively |
|---|---|
| Agent 1 | `components/BoardView.tsx` (keys only), `hooks/useBoardActions.ts`, `pages/CreateContest.tsx` (keys only), `functions/api/pools.ts`, `functions/api/pools/[id].ts`, `wrangler.toml`, `constants.ts`, `fixtures/` (new) |
| Agent 2 | Token audit across all files NOT owned by Agent 3. Specifically: `components/AdminPanel.tsx`, `components/InfoCards.tsx`, `components/LandingPage.tsx`, `components/OrganizerDashboard.tsx`, `components/layout/`, `components/loading/`, `components/empty/`, `components/auth/`, `pages/Login.tsx`, `pages/Paid.tsx`, `pages/Privacy.tsx`, `pages/Terms.tsx`, `pages/RunYourPoolAlternative.tsx`, `services/`, `hooks/` (color values only). Also: `src/index.css`, `docs/DESIGN_TOKENS.md` (new) |
| Agent 3 | `components/BoardView.tsx` (full rewrite — includes token compliance), `components/board/` (new — token-compliant from the start), `pages/CreateContest.tsx` (wizard fix — token-compliant), `pages/Dashboard.tsx` (token-compliant), `pages/HowToRunSquares.tsx`, `index.html` |
| Agent 4 | `README.md`, `docs/ARCHITECTURE.md`, `.gitignore`, `supabase/` (new), weekly-plan files (delete), `proxy.js` (delete) |

**Conflict note:** Agent 1 and Agent 3 both touch `BoardView.tsx` and `CreateContest.tsx`. Resolution: Agent 1 only makes text substitutions (key renames); Agent 3 does structural work. Run Agent 1 first on those two files, then Agent 3 picks up the result.

---

## Success Criteria

- `npm run build` passes with zero TypeScript errors
- `npm run test` passes
- No `sbxpro` string remains anywhere in `src/`, `components/`, `hooks/`, `pages/`, `functions/`, `constants.ts`, `wrangler.toml`
- All Tailwind arbitrary color values replaced with token-based classes
- `BoardView.tsx` under 200 lines
- `README.md` includes complete env var table and Supabase setup steps
- `dist/` removed from git tracking
