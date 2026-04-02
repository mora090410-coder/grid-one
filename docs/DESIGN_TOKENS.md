# GridOne Design Tokens

Tokens are defined in `src/index.css` under `@theme` and consumed via Tailwind utility aliases.
Add new tokens to `src/index.css` — never hardcode colors in components.

## Color Tokens

| Token (CSS variable) | Tailwind alias | Value | Usage |
|---|---|---|---|
| `--gridone-color-background` | `bg-background` / `text-background` | `#0B0C0F` | Page background |
| `--gridone-color-surface` | `bg-surface` | `#1c1c1e` | Card, panel, input backgrounds |
| `--gridone-color-surface-hover` | `bg-surface-hover` | `#2c2c2e` | Surface hover states |
| `--gridone-color-surface-glass` | `bg-surface-glass` | `rgba(28,28,30,0.6)` | Glassmorphism overlays |
| `--gridone-color-brand-primary` | `bg-cardinal` / `text-cardinal` / `border-cardinal` | `#8F1D2C` | Primary brand color, CTAs |
| `--gridone-color-brand-primary-hover` | `bg-cardinal-hover` | `#7A1622` | Cardinal hover state |
| `--gridone-color-brand-primary-subtle` | `bg-cardinal-subtle` | `rgba(143,29,44,0.15)` | Cardinal tint backgrounds |
| `--gridone-color-brand-accent` | `bg-gold` / `text-gold` | `#FFC72C` | Accent, highlights, active states |
| `--gridone-color-brand-accent-dim` | `bg-gold-dim` | `rgba(255,199,44,0.3)` | Gold tint backgrounds |
| `--gridone-color-brand-accent-glow` | `bg-gold-glow` | `rgba(255,199,44,0.4)` | Glow shadows |
| `--gridone-color-live` | `bg-live` / `text-live` | `#22C55E` | Live game indicator |
| `--gridone-color-text-primary` | `text-text-primary` | `#FFFFFF` | Primary text |
| `--gridone-color-text-secondary` | `text-text-secondary` | `rgba(235,235,245,0.6)` | Secondary/muted text |
| `--gridone-color-text-tertiary` | `text-text-tertiary` | `rgba(235,235,245,0.3)` | Placeholder, disabled text |

## Spacing Tokens

| Token | Value | Tailwind alias |
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
| `.glass-panel` | Glassmorphism card/panel |
| `.text-display` | Hero/display headings |
| `.text-heading` | Section headings |
| `.text-subheading` | Sub-section headings |
| `.text-body` | Body text |
| `.text-body-secondary` | Secondary/caption text |

## Rules

- Never use raw hex or rgba values in component files
- Use semantic token names, not value-based names (`bg-cardinal` not `bg-dark-red`)
- For shadow and gradient stops that cannot use a Tailwind alias directly, use CSS variable syntax: `shadow-[0_0_12px_var(--color-gold-glow)]`
- Opacity modifiers work with all aliases: `bg-cardinal/20`, `text-gold/50`
- Near-black backgrounds (`#050505`, `#060607`, `#09090b`) all map to `bg-background` — use a single canonical value
- `#9D2235` (slightly brighter cardinal) maps to `bg-cardinal-subtle` when used at low opacity for tint backgrounds
