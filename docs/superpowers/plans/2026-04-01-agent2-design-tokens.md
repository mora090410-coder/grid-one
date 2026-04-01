# Agent 2 — Design Token Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all raw hex/rgba color values in Agent 2-owned files with the established design token aliases from `src/index.css`. Document the token system.

**Architecture:** Audit and replace. No new tokens added unless a pattern appears 2+ times with no existing match. No structural changes — only color value replacement. Agent 3 owns `BoardView.tsx`, `CreateContest.tsx`, `Dashboard.tsx`, and `components/board/` — do NOT touch those files.

**Tech Stack:** React, TypeScript, Tailwind CSS v4

**Token reference (from `src/index.css`):**

| Token CSS variable | Tailwind alias | Value |
|---|---|---|
| `--gridone-color-background` | `bg-background` | `#0B0C0F` |
| `--gridone-color-surface` | `bg-surface` / `bg-[color:var(--color-surface)]` | `#1c1c1e` |
| `--gridone-color-surface-hover` | `bg-surface-hover` | `#2c2c2e` |
| `--gridone-color-surface-glass` | `bg-surface-glass` | `rgba(28,28,30,0.6)` |
| `--gridone-color-brand-primary` | `bg-cardinal` / `text-cardinal` / `border-cardinal` | `#8F1D2C` |
| `--gridone-color-brand-primary-hover` | `bg-cardinal-hover` | `#7A1622` |
| `--gridone-color-brand-primary-subtle` | `bg-cardinal-subtle` | `rgba(143,29,44,0.15)` |
| `--gridone-color-brand-accent` | `bg-gold` / `text-gold` | `#FFC72C` |
| `--gridone-color-brand-accent-dim` | `bg-gold-dim` | `rgba(255,199,44,0.3)` |
| `--gridone-color-brand-accent-glow` | `bg-gold-glow` | `rgba(255,199,44,0.4)` |
| `--gridone-color-text-primary` | `text-text-primary` | `#FFFFFF` |
| `--gridone-color-text-secondary` | `text-text-secondary` | `rgba(235,235,245,0.6)` |
| `--gridone-color-text-tertiary` | `text-text-tertiary` | `rgba(235,235,245,0.3)` |

**Note on Tailwind arbitrary values:** In Tailwind v4, `bg-[#8F1D2C]` and `bg-cardinal` both work at runtime. The goal is replacing arbitrary values with semantic aliases so the token system is the single source of truth. For gradient stops and shadow colors that have no direct alias, use CSS variable syntax: `from-[var(--gridone-color-brand-primary)]`.

---

## Pre-flight

- [ ] **Verify build and tests pass before starting**

```bash
cd /Users/amm13/00-Projects/GridOneApp && npm run build && npm run test -- --run
```

Expected: build succeeds, all tests pass.

---

## Task 1: Fix `components/loading/FullScreenLoading.tsx`

**Files:**
- Modify: `components/loading/FullScreenLoading.tsx`

Current raw colors:
- `bg-[#0B0C0F]` → `bg-background`
- `border-t-[#8F1D2C]` → `border-t-cardinal`
- `bg-[#FFC72C]` → `bg-gold`
- `shadow-[0_0_12px_rgba(255,199,44,0.4)]` → `shadow-[0_0_12px_var(--color-gold-glow)]`

- [ ] **Step 1: Read the full file**

Read `components/loading/FullScreenLoading.tsx` to see exact context before editing.

- [ ] **Step 2: Replace raw colors**

Replace:
```tsx
<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0B0C0F]">
```
With:
```tsx
<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
```

Replace:
```tsx
<div className="absolute inset-0 rounded-full border-4 border-t-[#8F1D2C] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
```
With:
```tsx
<div className="absolute inset-0 rounded-full border-4 border-t-cardinal border-r-transparent border-b-transparent border-l-transparent animate-spin" />
```

Replace:
```tsx
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#FFC72C] shadow-[0_0_12px_rgba(255,199,44,0.4)]" />
```
With:
```tsx
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gold shadow-[0_0_12px_var(--color-gold-glow)]" />
```

- [ ] **Step 3: Verify no raw hex remains**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}\|rgba(" components/loading/FullScreenLoading.tsx
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/loading/FullScreenLoading.tsx
git commit -m "refactor(tokens): replace raw colors in FullScreenLoading with design tokens"
```

---

## Task 2: Fix `components/layout/Layout.tsx`

**Files:**
- Modify: `components/layout/Layout.tsx`

Current raw color: `bg-[#060607]`

The background token is `#0B0C0F`. The value `#060607` is slightly darker — this is a near-match; replace with `bg-background` as the canonical background.

- [ ] **Step 1: Read the full file**

Read `components/layout/Layout.tsx`.

- [ ] **Step 2: Replace**

Replace:
```tsx
<div className="min-h-screen bg-[#060607] text-white flex flex-col">
```
With:
```tsx
<div className="min-h-screen bg-background text-white flex flex-col">
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/Layout.tsx
git commit -m "refactor(tokens): replace raw bg color in Layout with bg-background token"
```

---

## Task 3: Fix `components/layout/Header.tsx`

**Files:**
- Modify: `components/layout/Header.tsx`

Raw colors found:
- `bg-[#0B0C0F]/95` → `bg-background/95`
- `shadow-[#8F1D2C]/20` → `shadow-cardinal/20`
- `ring-[#FFC72C]/50` → `ring-gold/50`
- `border-b-2 border-[#8F1D2C]` → `border-b-2 border-cardinal`
- `text-[#8F1D2C]` → `text-cardinal`
- `hover:text-[#ff2e4d]` → no exact token; replace with `hover:text-cardinal-hover`
- `border-l-2 border-[#8F1D2C]` → `border-l-2 border-cardinal`

- [ ] **Step 1: Read the full file**

Read `components/layout/Header.tsx`.

- [ ] **Step 2: Replace all raw colors**

Apply these replacements (use replace_all where pattern is repeated):

- `bg-[#0B0C0F]/95` → `bg-background/95`
- `bg-[#0B0C0F]` → `bg-background` (mobile menu background)
- `shadow-[#8F1D2C]/20` → `shadow-cardinal/20`
- `ring-[#FFC72C]/50` → `ring-gold/50`
- `border-[#8F1D2C]` → `border-cardinal` (all occurrences)
- `text-[#8F1D2C]` → `text-cardinal` (all occurrences)
- `hover:text-[#ff2e4d]` → `hover:text-cardinal` (close enough semantically; no separate hover token)

- [ ] **Step 3: Verify**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" components/layout/Header.tsx
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Header.tsx
git commit -m "refactor(tokens): replace raw colors in Header with design token aliases"
```

---

## Task 4: Fix `components/PlayerFilter.tsx`

**Files:**
- Modify: `components/PlayerFilter.tsx`

Raw colors found:
- `style={{ color: selected ? '#FFC72C' : 'white' }}` → replace inline style with conditional class
- `bg-[#9D2235]/30` — this is a slightly different shade of cardinal; replace with `bg-cardinal-subtle`

- [ ] **Step 1: Read the full file**

Read `components/PlayerFilter.tsx`.

- [ ] **Step 2: Replace inline style**

Find:
```tsx
style={{ color: selected ? '#FFC72C' : 'white' }}
```
Replace with className logic (remove the style prop and add conditional class):
```tsx
className={`... ${selected ? 'text-gold' : 'text-white'}`}
```
Merge with any existing className on that element. If the element has no className, add: `className={selected ? 'text-gold' : 'text-white'}`.

- [ ] **Step 3: Replace bg-[#9D2235]/30**

Replace:
```tsx
className="flex items-center gap-3 bg-[#9D2235]/30 px-3 py-1 rounded-full border border-gold-glass">
```
With:
```tsx
className="flex items-center gap-3 bg-cardinal-subtle px-3 py-1 rounded-full border border-gold-glass">
```

- [ ] **Step 4: Verify**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}\|rgba(" components/PlayerFilter.tsx
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/PlayerFilter.tsx
git commit -m "refactor(tokens): replace raw colors in PlayerFilter with design tokens"
```

---

## Task 5: Fix `components/InfoCards.tsx`

**Files:**
- Modify: `components/InfoCards.tsx`

Raw colors found:
- `text-[#FFC72C]` (2 occurrences around lines 395, 617) → `text-gold`

- [ ] **Step 1: Read the relevant sections**

Read `components/InfoCards.tsx` lines 385–630.

- [ ] **Step 2: Replace**

Replace all occurrences of `text-[#FFC72C]` in `InfoCards.tsx` with `text-gold`.

```bash
grep -n "text-\[#FFC72C\]" components/InfoCards.tsx
```
Use replace_all to swap every instance.

- [ ] **Step 3: Verify**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" components/InfoCards.tsx
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/InfoCards.tsx
git commit -m "refactor(tokens): replace raw gold hex in InfoCards with text-gold token"
```

---

## Task 6: Fix `components/AdminPanel.tsx`

**Files:**
- Modify: `components/AdminPanel.tsx`

Raw colors found (multiple occurrences):
- `ring-[#FFC72C]/50` → `ring-gold/50`
- `bg-[#1c1c1e]` (multiple) → `bg-surface`
- `bg-[#1c1c1e]/95` → `bg-surface/95`
- `bg-[#09090b]` → `bg-background` (very close to `#0B0C0F`)

- [ ] **Step 1: Read the full file**

Read `components/AdminPanel.tsx` (it's a large file — read in sections if needed).

- [ ] **Step 2: Replace bg-[#1c1c1e] occurrences**

Use replace_all to replace every instance of `bg-[#1c1c1e]` with `bg-surface`. Verify count before and after:

```bash
grep -c "bg-\[#1c1c1e\]" components/AdminPanel.tsx
```

- [ ] **Step 3: Replace bg-[#1c1c1e]/95**

Replace `bg-[#1c1c1e]/95` with `bg-surface/95`.

- [ ] **Step 4: Replace ring-[#FFC72C]/50**

Replace `ring-[#FFC72C]/50` with `ring-gold/50`.

- [ ] **Step 5: Replace bg-[#09090b]**

Replace `bg-[#09090b]` with `bg-background`.

- [ ] **Step 6: Check for any remaining raw hex**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" components/AdminPanel.tsx
```

For any remaining occurrences: if they map to an existing token, replace them. If they are unique one-off values (e.g., team color swatches rendered dynamically), leave them — those are data values, not design tokens.

- [ ] **Step 7: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add components/AdminPanel.tsx
git commit -m "refactor(tokens): replace raw surface/accent colors in AdminPanel with design tokens"
```

---

## Task 7: Fix `components/BoardWizard/WizardModal.tsx`

**Files:**
- Modify: `components/BoardWizard/WizardModal.tsx`

Raw colors found:
- `bg-[#1c1c1e]` (2 occurrences in select elements) → `bg-surface`

- [ ] **Step 1: Read the relevant section**

Read `components/BoardWizard/WizardModal.tsx` lines 170–195.

- [ ] **Step 2: Replace**

Replace both occurrences of `bg-[#1c1c1e]` in `WizardModal.tsx` with `bg-surface`.

- [ ] **Step 3: Verify**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" components/BoardWizard/WizardModal.tsx
```
Expected: no output (or only team color data values).

- [ ] **Step 4: Commit**

```bash
git add components/BoardWizard/WizardModal.tsx
git commit -m "refactor(tokens): replace raw surface color in WizardModal selects with bg-surface"
```

---

## Task 8: Fix `components/LandingPage.tsx`

**Files:**
- Modify: `components/LandingPage.tsx`

This file has the most raw color usage. Audit and replace systematically.

Raw colors found:
- `bg-[#060607]` → `bg-background`
- `bg-[#8F1D2C]/25` → `bg-cardinal/25`
- `bg-[#FFC72C]/14` → `bg-gold/14`
- `selection:bg-[#FFC72C]/30` → `selection:bg-gold/30`
- `shadow-[#8F1D2C]/10` → `shadow-cardinal/10`
- `ring-[#FFC72C]/50` → `ring-gold/50`
- `bg-[#FFC72C]` → `bg-gold`
- `shadow-[#FFC72C]/20` → `shadow-gold/20`
- `text-[#FFC72C]` → `text-gold`
- `bg-[#8F1D2C]` → `bg-cardinal`
- `hover:shadow-[#8F1D2C]/20` → `hover:shadow-cardinal/20`
- `bg-[#8F1D2C]/90` → `bg-cardinal/90`
- `from-[#8F1D2C]/25` → `from-cardinal/25`
- `via-white/5` — already uses white/opacity, keep as-is
- `to-[#FFC72C]/20` → `to-gold/20`
- `bg-gradient-to-br from-[#8F1D2C]/20 to-[#FFC72C]/10` → `bg-gradient-to-br from-cardinal/20 to-gold/10`
- `text-[#22C55E]` — this is a success/live indicator green; add token `--gridone-color-live: #22C55E` to `src/index.css` and alias `text-live`, since it appears twice

- [ ] **Step 1: Read the full file**

Read `components/LandingPage.tsx`.

- [ ] **Step 2: Add live color token to `src/index.css`**

In `src/index.css` under `@theme`, add after the existing accent tokens:
```css
--gridone-color-live: #22C55E;
```

And add an alias in the aliases block:
```css
--color-live: var(--gridone-color-live);
```

- [ ] **Step 3: Replace all raw colors in LandingPage.tsx**

Work through the list above systematically. For gradient stops, use the Tailwind alias directly (e.g., `from-cardinal/25` works in Tailwind v4).

For `bg-[#22C55E]` / `text-[#22C55E]` → `bg-live` / `text-live`.

- [ ] **Step 4: Verify**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" components/LandingPage.tsx
```
Expected: no output.

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/index.css components/LandingPage.tsx
git commit -m "refactor(tokens): add live color token and replace all raw colors in LandingPage"
```

---

## Task 9: Audit remaining pages

**Files to audit:** `pages/Login.tsx`, `pages/Paid.tsx`, `pages/Privacy.tsx`, `pages/Terms.tsx`, `pages/RunYourPoolAlternative.tsx`

- [ ] **Step 1: Grep for raw colors across all remaining pages**

```bash
grep -n "bg-\[#\|text-\[#\|border-\[#\|rgba(\|#[0-9a-fA-F]\{3,6\}" pages/Login.tsx pages/Paid.tsx pages/Privacy.tsx pages/Terms.tsx pages/RunYourPoolAlternative.tsx
```

- [ ] **Step 2: For each raw color found**, replace with the appropriate token alias following the same mapping used in Tasks 1–8. If a value has no token equivalent and appears only once, leave it and note it in the commit message.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no output.

- [ ] **Step 4: Commit any changes**

```bash
git add pages/Login.tsx pages/Paid.tsx pages/Privacy.tsx pages/Terms.tsx pages/RunYourPoolAlternative.tsx
git commit -m "refactor(tokens): replace raw colors in remaining pages with design token aliases"
```

If no raw colors were found, skip this commit.

---

## Task 10: Write `docs/DESIGN_TOKENS.md`

**Files:**
- Create: `docs/DESIGN_TOKENS.md`

- [ ] **Step 1: Create the token reference document**

Create `docs/DESIGN_TOKENS.md`:

```markdown
# GridOne Design Tokens

Tokens are defined in `src/index.css` under `@theme` and consumed via Tailwind utility aliases.
Add new tokens to `src/index.css` — never hardcode colors in components.

## Color Tokens

| Token (CSS variable) | Tailwind alias | Value | Usage |
|---|---|---|---|
| `--gridone-color-background` | `bg-background` | `#0B0C0F` | Page background |
| `--gridone-color-surface` | `bg-surface` | `#1c1c1e` | Card, panel, input backgrounds |
| `--gridone-color-surface-hover` | `bg-surface-hover` | `#2c2c2e` | Surface hover states |
| `--gridone-color-surface-glass` | `bg-surface-glass` | `rgba(28,28,30,0.6)` | Glassmorphism overlays |
| `--gridone-color-brand-primary` | `bg-cardinal` / `text-cardinal` / `border-cardinal` | `#8F1D2C` | Primary brand color, CTAs |
| `--gridone-color-brand-primary-hover` | `bg-cardinal-hover` | `#7A1622` | Cardinal hover state |
| `--gridone-color-brand-primary-subtle` | `bg-cardinal-subtle` | `rgba(143,29,44,0.15)` | Cardinal tint backgrounds |
| `--gridone-color-brand-accent` | `bg-gold` / `text-gold` | `#FFC72C` | Accent, highlights, active states |
| `--gridone-color-brand-accent-dim` | `bg-gold-dim` | `rgba(255,199,44,0.3)` | Gold tint backgrounds |
| `--gridone-color-brand-accent-glow` | `bg-gold-glow` | `rgba(255,199,44,0.4)` | Glow shadows |
| `--gridone-color-text-primary` | `text-text-primary` | `#FFFFFF` | Primary text |
| `--gridone-color-text-secondary` | `text-text-secondary` | `rgba(235,235,245,0.6)` | Secondary/muted text |
| `--gridone-color-text-tertiary` | `text-text-tertiary` | `rgba(235,235,245,0.3)` | Placeholder, disabled text |
| `--gridone-color-live` | `text-live` / `bg-live` | `#22C55E` | Live game indicator |

## Spacing Tokens

| Token | Value | Usage |
|---|---|---|
| `--gridone-spacing-18` | `4.5rem` | `spacing-18` |
| `--gridone-spacing-22` | `5.5rem` | `spacing-22` |

## Border Radius Tokens

| Token | Value | Tailwind alias |
|---|---|---|
| `--gridone-radius-xl` | `12px` | `rounded-xl` (override) |
| `--gridone-radius-2xl` | `16px` | `rounded-2xl` (override) |
| `--gridone-radius-3xl` | `24px` | `rounded-3xl` (override) |

## Typography

Font family token: `--gridone-font-sans` → Inter, -apple-system, SF Pro Text fallback chain.
Applied globally via `body { font-family: var(--font-sans); }`.

## Component Classes (in `src/index.css`)

| Class | Usage |
|---|---|
| `.btn-cardinal` | Primary CTA button |
| `.text-display` | Hero/display headings |
| `.text-heading` | Section headings |
| `.text-subheading` | Sub-section headings |
| `.text-body` | Body text |
| `.text-body-secondary` | Secondary/caption text |

## Rules

- Never use raw hex or rgba values in component files
- Use semantic token names, not value-based names (`bg-cardinal` not `bg-dark-red`)
- For shadow and gradient stops, use `var(--color-*)` syntax: `shadow-[0_0_12px_var(--color-gold-glow)]`
- Opacity modifiers work with all aliases: `bg-cardinal/20`, `text-gold/50`
```

- [ ] **Step 2: Commit**

```bash
git add docs/DESIGN_TOKENS.md
git commit -m "docs: add DESIGN_TOKENS.md token reference"
```

---

## Post-flight

- [ ] **Final raw color audit across Agent 2 scope**

```bash
grep -rn "bg-\[#\|text-\[#\|border-\[#" \
  components/loading/ components/layout/ components/PlayerFilter.tsx \
  components/InfoCards.tsx components/AdminPanel.tsx \
  components/BoardWizard/ components/LandingPage.tsx \
  pages/Login.tsx pages/Paid.tsx pages/Privacy.tsx pages/Terms.tsx pages/RunYourPoolAlternative.tsx
```
Expected: no output (or only team color data values that are legitimately not design tokens).

- [ ] **Full build and test**

```bash
npm run build && npm run test -- --run
```
Expected: build succeeds, all tests pass.
