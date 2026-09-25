# GridOne Design Tokens

**Status:** Production mapping reference
**Normative overlay:** root `DESIGN.md`
**Implementation:** `src/design/tokens.css`, exposed to Tailwind through `@theme inline` in `src/index.css`
**Primitives:** `src/design/primitives/`

`DESIGN.md` owns meaning. This file records the CSS variable and Tailwind utility for each token. If values disagree, fix the mapping.

## Brand tokens

`src/styles/tokens.css` holds the Corner Square kit values as `--g1-*` tokens, imported once from `src/index.css` before the semantic tokens. Components never read them directly. The kit's remote font stylesheet is replaced by the self-hosted Archivo faces, and its OS dark-mode set is named `--g1-dark-*` so the dark base reads it directly.

| Kit token | Value | Meaning |
|---|---|---|
| `--g1-ink` | `#13212E` | Primary text, logo, dark surfaces |
| `--g1-chalk` | `#F6F7F5` | Page background, text on ink |
| `--g1-gold` | `#E3A91C` | Winner only |
| `--g1-turf` | `#1E5A3C` | Success, sparingly |
| `--g1-stone` | `#5B6670` | Secondary text on chalk |
| `--g1-line` | `#D9DDD8` | Borders, board cell edges |
| `--g1-cell` | ink 8% | Empty square fill |
| `--g1-surface` | `#FFFFFF` | Cards on chalk |
| `--g1-dark-bg` | `#0C151E` | Deepest ink (pressed ink action) |
| `--g1-dark-text` | `#EEF1EE` | Text on ink |
| `--g1-dark-stone` | `#9AA7B2` | Secondary text on ink |
| `--g1-dark-line` | `#24374A` | Borders on ink |
| `--g1-dark-cell` | chalk 10% | Empty square fill on ink |

## Fixed palette

| Meaning | CSS variable | Tailwind | Value |
|---|---|---|---|
| Winner only (logo corner, winning squares) | `--g-gold` | `gold` | `--g1-gold` |
| Winner pressed | `--g-gold-deep` | `gold-deep` | `#C08A0E` |
| Settled and success | `--g-turf` | `turf` | `--g1-turf` |
| Errors and destructive only | `--g-cardinal` | `cardinal` | `#8F1D2C` |
| Cardinal pressed | `--g-cardinal-deep` | `cardinal-deep` | `#6E1622` |
| In-progress NFL game only | `--g-live` | `live` | `#22C55E` |
| Ink | `--g-ink` | `ink` | `--g1-ink` |
| Island and chyron ground | `--g-chyron` | `chyron` | `#213549` |
| Chalk | `--g-white` | `broadcast-white` | `--g1-chalk` |
| Line | `--g-newsprint` | `newsprint` | `--g1-line` |

## Semantic tokens (flip per `data-base`)

| Meaning | CSS variable | Tailwind | Dark | Cream |
|---|---|---|---|---|
| Page ground | `--g-ground` | `bg-ground` | `#13212E` | `#F6F7F5` |
| Panel fill | `--g-panel` | `bg-panel` | white 7% | white card |
| Panel hover | `--g-panel-hover` | `bg-panel-hover` | white 10% | ink 4% on white |
| Hairline | `--g-hairline` | `border-hairline` | white 12% | brand line |
| Text primary | `--g-text` | `text-fg` | `--g1-dark-text` | ink |
| Text secondary | `--g-text-2` | `text-fg-2` | `--g1-dark-stone` | `--g1-stone` |
| Text muted | `--g-text-3` | `text-fg-3` | `--g1-dark-stone` | `--g1-stone` |
| Action fill | `--g-action` | `bg-action` | chalk | ink |
| Action hover | `--g-action-hover` | `bg-action-hover` | line | deepest ink |
| Action text | `--g-action-text` | `text-action-text` | ink | chalk |
| Settled tag | `--g-tone-turf` | `text-tone-turf` | `#8CCBA6` | turf |
| Shadow | `--g-shadow` | `shadow-[var(--g-shadow)]` | 45% deep ink | 6% ink |
| Spotlight | `--g-glow` | used by `Spotlight` | chalk 14% | ink 6% |

The base is set by `<Base kind="dark" | "cream">` from `src/design/Base.tsx`.

## Marketing stage (`:root`)

Brand-ink chrome for the public home page, the create preview, and the demo board. No new hue: the glass is ink lifted in its own hue, the light is white, and the action glow is a `color-mix` of chalk. Never gold. Glass fill is opaque enough that square cells are not blurred; `.g-float` does not set `backdrop-filter`.

| Meaning | CSS variable | Used by | Value |
|---|---|---|---|
| Stage ground | `--g-stage` | `.marketing-stage`, `.demo-stage`, `.create-preview-stage` | `--g1-ink` |
| Glass wash | `--g-glass` | `.g-chip` | white 10% |
| Glass fill | `--g-glass-fill` | `.g-float`, `.g-pill` | lifted ink 94% |
| Glass edge | `--g-glass-edge` | floating chrome | white 22% |
| Sheen | `--g-glass-sheen` | top highlight | white 10% |
| Stage light | `--g-stage-light` | one static radial behind the artifact | white 32% |
| Float shadow | `--g-shadow-float` | cards and frames | inset hairline, deep ink shadow, soft white rim |
| Action glow | `--g-cta-glow` | `.g-cta` only | chalk 22% |

`.g-cta`, `.g-float`, `.g-pill`, and `.g-chip` live in `src/design/tokens.css`. Reduced transparency swaps the translucent fills for `--g-chyron`. Reduced motion does not animate the light or the glow.

## Ambient tints (`:root`, base-independent)

Large, soft ground light for one section. Derived with `color-mix` from the palette (`transparent` first, so a downlevelled build falls back to no tint rather than a full-strength blob), so no new hue enters the system. Never gold. Consumed only by `SectionTone`.

| Meaning | CSS variable | Tailwind | Value |
|---|---|---|---|
| Hero and pricing ambience | `--g-tint-cardinal` | `tint-cardinal` | cardinal 20% |
| Score-moment ambience | `--g-tint-live` | `tint-live` | live 20% |
| Organizer ambience | `--g-tint-turf` | `tint-turf` | turf 20% |

20% is a contrast cap, not a taste call, and it is a **hard ceiling**. Against the `#13212E` ink ground, the worst case is `--g-text-2` (brand dark stone) over a full-strength live tint at **4.58:1**, which clears the 4.5:1 requirement by 0.08. `SectionTone` renders the tint at 0.75 layer opacity with radial falloff on top of that, so nothing on screen is ever this strong, but the token itself has little headroom. Raising any tint past 20% puts secondary text below AA. `tests/design/contrast.test.ts` asserts both the cap and the composited ratio; `tests/design/docDrift.test.ts` asserts that this table and `DESIGN.md` still name the value `src/design/tokens.css` ships.

### Rim light

The former homepage device frames and their rim CSS were retired in the approved editorial redesign. The palette tokens `--g-rim`, `--g-rim-soft`, and `--g-rim-none` remain reserved; the homepage no longer consumes them. Product excerpts use the standard surface and cell borders.

## Type

| Role | CSS variable | Tailwind | Family |
|---|---|---|---|
| Display | `--g-font-display` | `font-display` | Archivo (`--g1-font`), bold, tight |
| Interface | `--g-font-ui` | `font-ui` | Archivo (`--g1-font`) |
| Data, eyebrow | `--g-font-mono` | `font-mono` | Geist Mono |
| Heading tracking | `--g-tracking-display` | applied to `h1`–`h3` and `.font-display` | `--g1-tracking-tight` (-0.03em) |

## Shape

| Role | CSS variable | Tailwind | Value |
|---|---|---|---|
| Control | `--g-radius-control` | `rounded-control` | 12px (`--g1-radius`) |
| Card, sheet, glass | `--g-radius-card` | `rounded-card` | 18px (`--g1-radius-lg`) |
| Button, tag, input, island | `--g-radius-capsule` | `rounded-capsule` | 999px |
| Grid cell | `--g-radius-cell` | `rounded-cell` | 4px |

## Motion

| Role | CSS variable | Value |
|---|---|---|
| State ease | `--g-ease-state` | `cubic-bezier(0.2, 0, 0, 1)` |
| State duration | `--g-dur-state` | 200ms |
| Spring duration | `--g-dur-spring` | 450ms |
| Reduced motion | `--g-dur-reduced` | 120ms, replaces both under `prefers-reduced-motion` |

| Reveal state | `[data-reveal]` in `tokens.css` | `pending` = opacity 0 + `translateY(20px)`; `in` = opacity 1 + no transform; **no attribute = visible, untransitioned resting state** |

JS constants and `useReducedMotion()` live in `src/design/primitives/motion.ts`. `Reveal`, `SectionTone`, and `Grain` live in `src/design/primitives/`. The `@media (prefers-reduced-motion: reduce)` block in `tokens.css` neutralizes the reveal transition and the `pending` state, so the attribute can never hide content from a reduced-motion reader.

## Legacy

The remaining `--gridone-*` variables in `src/index.css` back the unlayered cascade guards there: `--gridone-color-background`, `--gridone-color-brand-primary-deep` (button fill re-assertion), `--gridone-color-text-primary`, `--gridone-radius-surface`, `--gridone-radius-grid` (sharp board radius), and `--gridone-elevation-raised` (dialog elevation). The old `font-condensed` / `font-data` aliases are gone; Archivo returned as the brand face through `--g-font-display` and `--g-font-ui`. Do not add new `--gridone-*` variables; use the `--g-*` tokens above, built from the `--g1-*` brand tokens.
