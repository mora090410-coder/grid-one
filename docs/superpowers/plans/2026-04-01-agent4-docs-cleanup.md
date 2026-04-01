# Agent 4 — Docs, Stale Files & Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete stale artifact files, reorganize SQL migrations to `supabase/migrations/`, rewrite README with complete setup instructions, and update ARCHITECTURE.md to reflect current stack.

**Architecture:** Pure documentation and file-system changes. No TypeScript, no component code. Safe to run in full parallel with Agents 1, 2, and 3 since there is zero file overlap.

**Tech Stack:** Markdown, TOML, SQL, git

---

## Pre-flight

- [ ] **Check git status to confirm clean state before starting**

```bash
cd /Users/amm13/00-Projects/GridOneApp && git status
```

---

## Task 1: Delete stale artifact files

**Files:**
- Delete: `weekly-plan.html`
- Delete: `weekly-plan.css`
- Delete: `weekly-plan.js`
- Delete: `proxy.js`

These are unrelated planning artifacts and a leftover dev utility. They have no relationship to the app.

- [ ] **Step 1: Confirm files exist**

```bash
ls weekly-plan.html weekly-plan.css weekly-plan.js proxy.js 2>&1
```

- [ ] **Step 2: Delete them**

```bash
rm weekly-plan.html weekly-plan.css weekly-plan.js proxy.js
```

- [ ] **Step 3: Verify deletion**

```bash
ls weekly-plan* proxy.js 2>&1
```
Expected: `No such file or directory` for all.

- [ ] **Step 4: Commit**

```bash
git rm weekly-plan.html weekly-plan.css weekly-plan.js proxy.js
git commit -m "chore: remove stale weekly-plan artifacts and proxy.js dev utility"
```

---

## Task 2: Stop tracking `dist/` in git

**Files:**
- Modify: `.gitignore`

The `dist/` directory contains build output and should not be committed to the repo.

- [ ] **Step 1: Check current .gitignore**

```bash
cat .gitignore 2>/dev/null || echo "(no .gitignore found)"
```

- [ ] **Step 2: Add dist/ to .gitignore if not present**

```bash
grep -q "^dist/" .gitignore || echo "dist/" >> .gitignore
```

- [ ] **Step 3: Verify .gitignore contains dist/**

```bash
grep "dist/" .gitignore
```
Expected: `dist/`

- [ ] **Step 4: Commit .gitignore change**

```bash
git add .gitignore
git commit -m "chore: add dist/ to .gitignore"
```

Note: Do NOT run `git rm -r --cached dist/` — that would stage deletions of all built files which could be disruptive in a shared repo. The `.gitignore` change is sufficient to prevent future tracking. If the team wants to remove dist from history, that is a separate manual operation.

---

## Task 3: Reorganize SQL migrations

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/migrations/002_board_data.sql`
- Create: `supabase/migrations/003_rls_policies.sql`
- Delete: `supabase_migration.sql`
- Delete: `supabase_migration_2.sql`
- Delete: `supabase_migration_rls.sql`

- [ ] **Step 1: Read current migration files to understand their content**

```bash
head -10 supabase_migration.sql && echo "---" && head -10 supabase_migration_2.sql && echo "---" && head -10 supabase_migration_rls.sql
```

- [ ] **Step 2: Create supabase/migrations/ directory**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 3: Copy migrations to new paths**

```bash
cp supabase_migration.sql supabase/migrations/001_initial_schema.sql
cp supabase_migration_2.sql supabase/migrations/002_board_data.sql
cp supabase_migration_rls.sql supabase/migrations/003_rls_policies.sql
```

- [ ] **Step 4: Verify copies exist with content**

```bash
wc -l supabase/migrations/*.sql
```
Expected: non-zero line counts for all three files.

- [ ] **Step 5: Delete originals**

```bash
rm supabase_migration.sql supabase_migration_2.sql supabase_migration_rls.sql
```

- [ ] **Step 6: Commit**

```bash
git rm supabase_migration.sql supabase_migration_2.sql supabase_migration_rls.sql
git add supabase/migrations/
git commit -m "chore: move SQL migrations to supabase/migrations/ with numbered naming"
```

---

## Task 4: Rewrite `README.md`

**Files:**
- Modify: `README.md`

Read the current README first, then replace with a complete, accurate version.

- [ ] **Step 1: Read the current README**

Read `README.md`.

- [ ] **Step 2: Read .env.example to confirm env vars**

Read `.env.example` to see what's currently documented.

- [ ] **Step 3: Write the new README**

Replace the full content of `README.md` with:

```markdown
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
|---|---|
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
|---|---|
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
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README with complete env vars, Supabase setup, and accurate tech stack"
```

---

## Task 5: Update `docs/ARCHITECTURE.md`

**Files:**
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Read the current ARCHITECTURE.md**

Read `docs/ARCHITECTURE.md`.

- [ ] **Step 2: Update the System Overview section**

Replace the current System Overview with:

```markdown
## System Overview

- **Frontend:** React 19 + TypeScript + Vite, served as a SPA from Cloudflare Pages.
- **Routing:** `react-router-dom` v7 in `App.tsx`.
- **Data store:** Supabase (`contests`, `contest_entries` tables) via `services/supabase.ts`. Row Level Security enforced on all tables.
- **API layer:** Cloudflare Pages Functions under `functions/api/`. Each function is a separate edge handler.
- **Payment:** Stripe checkout session creation + webhook-based activation.
- **Live scoring:** Google Gemini Search Grounding via `services/geminiService.ts`, consumed by `hooks/useLiveScoring.ts`.
```

- [ ] **Step 3: Add the Auth Flow section**

After the Frontend Boundaries section, add:

```markdown
## Auth Flow

1. User authenticates via Supabase Auth (email/password or OAuth).
2. Supabase issues a JWT stored in the browser session.
3. Frontend passes the JWT as `Authorization: Bearer <token>` to Cloudflare Pages Functions.
4. Functions call `supabase.auth.getUser(token)` to resolve the user identity server-side.
5. All Supabase queries (both client-side and server-side via anon key) are subject to Row Level Security — policies ensure users can only read/write their own contests.
6. Guest flows (unauthenticated users who start creating a board) are redirected to `/login` before any data is written. Draft state is persisted to `sessionStorage` and restored after login.
```

- [ ] **Step 4: Verify no stale Cloudflare KV references remain**

```bash
grep -n "KV\|KVNamespace\|R2\|Durable Object" docs/ARCHITECTURE.md
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: update ARCHITECTURE.md with accurate auth flow and remove KV references"
```

---

## Post-flight

- [ ] **Verify stale files are gone**

```bash
ls weekly-plan.html weekly-plan.css weekly-plan.js proxy.js supabase_migration.sql supabase_migration_2.sql supabase_migration_rls.sql 2>&1
```
Expected: all `No such file or directory`.

- [ ] **Verify migrations exist at new paths**

```bash
ls -la supabase/migrations/
```
Expected: `001_initial_schema.sql`, `002_board_data.sql`, `003_rls_policies.sql`.

- [ ] **Verify no SBXPRO or legacy names in docs**

```bash
grep -rni "sbxpro\|five-star-grid-pool\|KVNamespace" README.md docs/ARCHITECTURE.md
```
Expected: no output.

- [ ] **Final git status check**

```bash
git status
```
Expected: working tree clean.
