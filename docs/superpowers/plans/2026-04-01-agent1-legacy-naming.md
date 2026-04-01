# Agent 1 — Legacy Naming & Dead Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all SBXPRO naming artifacts from backend/hook files and clean dead Cloudflare KV code.

**Architecture:** Pure text substitutions and dead-code removal across 5 files. No behavior changes. Agent 3 owns the structural rewrites of `BoardView.tsx` and `CreateContest.tsx` (with correct naming) so this agent skips those two files entirely.

**Tech Stack:** TypeScript, Cloudflare Pages Functions, Supabase

---

## Pre-flight

- [ ] **Verify tests pass before starting**

```bash
cd /Users/amm13/00-Projects/GridOneApp && npm run test -- --run
```

Expected: all tests pass.

- [ ] **Verify build passes before starting**

```bash
npm run build
```

Expected: zero TypeScript errors, build succeeds.

---

## Task 1: Rename sbxpro_ keys in `useBoardActions.ts`

**Files:**
- Modify: `hooks/useBoardActions.ts`

Current state — three `sbxpro_` key usages:
- Line 81: `localStorage.getItem('sbxpro_tokens')`
- Line 83: `localStorage.setItem('sbxpro_tokens', ...)`
- Line 115: `localStorage.setItem('sbxpro_guest_game', ...)`
- Line 116: `localStorage.setItem('sbxpro_guest_board', ...)`
- Line 150: `localStorage.getItem('sbxpro_tokens')`

And the default title on line 57: `title: g.title || "SBXPRO Pool"`

- [ ] **Step 1: Rename guest storage keys**

In `hooks/useBoardActions.ts`, replace:
```ts
localStorage.setItem('sbxpro_guest_game', guestGameStr);
localStorage.setItem('sbxpro_guest_board', JSON.stringify(b));
```
With:
```ts
localStorage.setItem('gridone_guest_game', guestGameStr);
localStorage.setItem('gridone_guest_board', JSON.stringify(b));
```

- [ ] **Step 2: Rename all sbxpro_tokens references**

Replace every occurrence of `'sbxpro_tokens'` in `hooks/useBoardActions.ts` with `'gridone_tokens'`. There are 3 occurrences (lines 81, 83, 150).

Verify:
```bash
grep -n "sbxpro" hooks/useBoardActions.ts
```
Expected: no output.

- [ ] **Step 3: Fix default pool title**

In `hooks/useBoardActions.ts` around line 57, replace:
```ts
game: { ...g, title: g.title || "SBXPRO Pool", coverImage: g.coverImage || "" },
```
With:
```ts
game: { ...g, title: g.title || "GridOne Pool", coverImage: g.coverImage || "" },
```

- [ ] **Step 4: Build to confirm no regressions**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add hooks/useBoardActions.ts
git commit -m "refactor: rename sbxpro_ localStorage keys and default title in useBoardActions"
```

---

## Task 2: Clean `functions/api/pools.ts`

**Files:**
- Modify: `functions/api/pools.ts`

Three changes: remove KVNamespace, purge the ~100-line comment block, remove sbxpro from CORS.

- [ ] **Step 1: Remove KVNamespace type and POOLS from Env**

Find and remove these lines near the top of the file:
```ts
type KVNamespace = any;
```
And in the `Env` interface, remove:
```ts
  POOLS: KVNamespace;
```

The resulting `Env` interface should be:
```ts
interface Env {
  PUBLIC_SITE_URL?: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}
```

- [ ] **Step 2: Remove sbxpro.pages.dev from CORS allowlist**

In `DEFAULT_ALLOWED_ORIGINS`, remove:
```ts
  'https://sbxpro.pages.dev',
```

The resulting array should be:
```ts
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8788',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://getgridone.com',
  'https://www.getgridone.com',
];
```

- [ ] **Step 3: Replace the giant comment block with a concise architectural comment**

Locate the block starting with `// Note: owner_id is required by RLS usually.` and ending just before `const token = authHeader?.replace('Bearer ', '') || '';` inside `onRequestPost`.

Replace the entire comment block (approximately 60 lines of inline dev notes) with:

```ts
// Pool creation requires an authenticated Supabase user.
// The Authorization header must carry a valid Supabase JWT.
// Guest flows redirect to /login before reaching this endpoint.
```

- [ ] **Step 4: Verify no sbxpro references remain**

```bash
grep -n "sbxpro\|KVNamespace\|POOLS:" functions/api/pools.ts
```
Expected: no output.

- [ ] **Step 5: Build to confirm no regressions**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add functions/api/pools.ts
git commit -m "refactor: remove KVNamespace, sbxpro CORS origin, and inline dev notes from pools.ts"
```

---

## Task 3: Clean `functions/api/pools/[id].ts`

**Files:**
- Modify: `functions/api/pools/[id].ts`

Two changes: remove KVNamespace/POOLS, remove sbxpro from CORS.

- [ ] **Step 1: Remove KVNamespace type alias**

Remove this line from the top of the file:
```ts
type KVNamespace = any;
```

- [ ] **Step 2: Remove POOLS from Env interface**

In the `Env` interface, remove:
```ts
  POOLS: KVNamespace; // Kept to avoid build errors if bindings exist
```

The resulting `Env` interface should be:
```ts
interface Env {
  PUBLIC_SITE_URL?: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}
```

- [ ] **Step 3: Remove sbxpro.pages.dev from CORS allowlist**

In `DEFAULT_ALLOWED_ORIGINS`, remove:
```ts
  'https://sbxpro.pages.dev',
```

The resulting array:
```ts
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8788',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://getgridone.com',
  'https://www.getgridone.com',
];
```

- [ ] **Step 4: Verify no legacy references remain**

```bash
grep -n "sbxpro\|KVNamespace\|POOLS:" "functions/api/pools/[id].ts"
```
Expected: no output.

- [ ] **Step 5: Build to confirm no regressions**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add "functions/api/pools/[id].ts"
git commit -m "refactor: remove KVNamespace and sbxpro CORS origin from pools/[id].ts"
```

---

## Task 4: Fix `wrangler.toml`

**Files:**
- Modify: `wrangler.toml`

- [ ] **Step 1: Rename the Cloudflare Pages project name**

In `wrangler.toml`, replace:
```toml
name = "five-star-grid-pool"
```
With:
```toml
name = "gridone"
```

- [ ] **Step 2: Verify**

```bash
grep "name" wrangler.toml
```
Expected output:
```
name = "gridone"
```

- [ ] **Step 3: Commit**

```bash
git add wrangler.toml
git commit -m "refactor: rename wrangler project from five-star-grid-pool to gridone"
```

---

## Task 5: Move sample board fixture out of `constants.ts`

**Files:**
- Modify: `constants.ts`
- Create: `fixtures/sampleBoard.fixture.ts`

The `generateIndexedSquares` function and `SAMPLE_BOARD` constant contain hardcoded personal names and are demo-only data. They need to live in a `fixtures/` directory so their purpose is clear.

- [ ] **Step 1: Create the fixtures directory and file**

Create `fixtures/sampleBoard.fixture.ts` with the following content (copy exactly from `constants.ts`):

```ts
import { BoardData } from '../types';

/**
 * Demo fixture — not production data.
 * Maps names from a physical photo transcription to board positions.
 */
const generateIndexedSquares = (opp: number[], bears: number[]): string[][] => {
  const grid: string[][] = Array(100).fill(null).map(() => []);
  const raw: Record<string, string[]> = {
    "9-7": ["Mastalski", "Carol N."], "4-7": ["Mora"], "8-7": ["Zappia"], "6-7": ["Winkoff"], "2-7": ["Diego"], "0-7": ["Nowicki"], "1-7": ["Mckernin"], "7-7": ["Rosenbaum"], "5-7": ["Moy"], "3-7": ["J. Danielson"],
    "9-1": ["Lefko"], "4-1": ["Mastalski", "Lauren B."], "8-1": ["Mora"], "6-1": ["Zappia"], "2-1": ["Lefko"], "0-1": ["Blastick"], "1-1": ["Nowicki"], "7-1": ["Mckernin"], "5-1": ["Rosenbaum"], "3-1": ["Moy"],
    "9-8": ["Burk"], "4-8": ["Lefko Dustin"], "8-8": ["Mastalski Jen Poskin"], "6-8": ["Mora"], "2-8": ["Zappia"], "0-8": ["Winkoff"], "1-8": ["Goetz"], "7-8": ["Nowicki"], "5-8": ["Mckernin"], "3-8": ["Rosenbaum"],
    "9-4": ["B. St. Clair"], "4-4": ["Lefko Dustin"], "8-4": ["Burk"], "6-4": ["Mastalski Rita M."], "2-4": ["Mora"], "0-4": ["Zappia"], "1-4": ["Winkoff"], "7-4": ["Redmond"], "5-4": ["Nowicki"], "3-4": ["Mckernin"],
    "9-6": ["Moy"], "4-6": ["St. Clair"], "8-6": ["Burk"], "6-6": ["Lefko Drew"], "2-6": ["Rubo"], "0-6": ["Heide"], "1-6": ["Zappia"], "7-6": ["Mastalski K & C Mast"], "5-6": ["Peffers"], "3-6": ["Nowicki"],
    "9-9": ["Rosenbaum"], "4-9": ["Moy"], "8-9": ["Valfre"], "6-9": ["Burk"], "2-9": ["Rademacher"], "0-9": ["McCarthy"], "1-9": ["Mora"], "7-9": ["Zappia"], "5-9": ["Lefko"], "3-9": ["Castillo"],
    "9-2": ["Mckernin"], "4-2": ["Rosenbaum"], "8-2": ["Moy"], "6-2": ["Valfre"], "2-2": ["Burk Matt B."], "0-2": ["Lefko Dustin"], "1-2": ["Mastalski Carol N."], "7-2": ["Mora"], "5-2": ["Zappia"], "3-2": ["Winkoff"],
    "9-5": ["Nowicki"], "4-5": ["Mckernin"], "8-5": ["Rosenbaum"], "6-5": ["Moy"], "2-5": ["St. Clair"], "0-5": ["Burk Henry E."], "1-5": ["Lefko Steve"], "7-5": ["Mastalski Grant B."], "5-5": ["Mora"], "3-5": ["Zappia"],
    "9-0": ["Travis"], "4-0": ["Nowicki"], "8-0": ["Mckernin"], "6-0": ["Rosenbaum"], "2-0": ["Moy"], "0-0": ["Vanda"], "1-0": ["Burk"], "7-0": ["Lefko Drew"], "5-0": ["Mastalski Rita M."], "3-0": ["Mora"],
    "9-3": ["Winkoff"], "4-3": ["Sanders"], "8-3": ["Nowicki"], "6-3": ["Mckernin"], "2-3": ["Lefko Rob"], "0-3": ["Moy"], "1-3": ["St. Clair"], "7-3": ["Burk"], "5-3": ["Rosenbaum"], "3-3": ["Mastalski Grant B."]
  };

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const topDigit = opp[c];
      const leftDigit = bears[r];
      const key = `${topDigit}-${leftDigit}`;
      if (raw[key]) {
        grid[r * 10 + c] = raw[key];
      }
    }
  }
  return grid;
};

export const SAMPLE_BOARD: BoardData = {
  bearsAxis: [7, 1, 8, 4, 6, 9, 2, 5, 0, 3],
  oppAxis: [9, 4, 8, 6, 2, 0, 1, 7, 5, 3],
  squares: generateIndexedSquares(
    [9, 4, 8, 6, 2, 0, 1, 7, 5, 3],
    [7, 1, 8, 4, 6, 9, 2, 5, 0, 3]
  )
};
```

- [ ] **Step 2: Remove generateIndexedSquares and SAMPLE_BOARD from `constants.ts`**

Delete the `generateIndexedSquares` function body and the `SAMPLE_BOARD` export from `constants.ts`.

Add an import at the top of `constants.ts` (after the existing imports):
```ts
export { SAMPLE_BOARD } from './fixtures/sampleBoard.fixture';
```

This preserves the existing `SAMPLE_BOARD` export contract — any file importing from `constants.ts` continues to work without changes.

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no output.

- [ ] **Step 4: Verify tests pass**

```bash
npm run test -- --run
```
Expected: all pass.

- [ ] **Step 5: Verify no sbxpro remains anywhere in owned files**

```bash
grep -rn "sbxpro" hooks/ functions/ wrangler.toml constants.ts fixtures/
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add constants.ts fixtures/sampleBoard.fixture.ts
git commit -m "refactor: move sample board fixture out of constants into fixtures/"
```

---

## Post-flight

- [ ] **Final check: no sbxpro anywhere in Agent 1 scope**

```bash
grep -rn "sbxpro" hooks/useBoardActions.ts functions/api/pools.ts "functions/api/pools/[id].ts" wrangler.toml constants.ts fixtures/
```
Expected: no output.

- [ ] **Build and test green**

```bash
npm run build && npm run test -- --run
```
Expected: build succeeds, all tests pass.
