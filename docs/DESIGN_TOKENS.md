# GridOne Design Tokens

**Status:** Production mapping reference
**Normative overlay:** root `DESIGN.md`
**Implementation:** `src/design/tokens.css`, exposed to Tailwind through `@theme inline` in `src/index.css`
**Primitives:** `src/design/primitives/`

`DESIGN.md` owns meaning. This file records the CSS variable and Tailwind utility for each token. If values disagree, fix the mapping.

## Fixed palette

| Meaning | CSS variable | Tailwind | Value |
|---|---|---|---|
| Brand, cream action, destructive | `--g-cardinal` | `cardinal` | `#8F1D2C` |
| Cardinal pressed | `--g-cardinal-deep` | `cardinal-deep` | `#6E1622` |
| Dark action, committed, settled | `--g-gold` | `gold` | `#FFC72C` |
| Gold pressed | `--g-gold-deep` | `gold-deep` | `#E0A600` |
| In-progress NFL game only | `--g-live` | `live` | `#22C55E` |
| Ink | `--g-ink` | `ink` | `#0E0F12` |
| Island and chyron ground | `--g-chyron` | `chyron` | `#282B32` |
| Broadcast white | `--g-white` | `broadcast-white` | `#EFF0F1` |
| Newsprint | `--g-newsprint` | `newsprint` | `#DEE0E1` |

## Semantic tokens (flip per `data-base`)

| Meaning | CSS variable | Tailwind | Dark | Cream |
|---|---|---|---|---|
| Page ground | `--g-ground` | `bg-ground` | `#14161D` | `#F5F1EA` |
| Panel fill | `--g-panel` | `bg-panel` | white 7% | white 70% |
| Panel hover | `--g-panel-hover` | `bg-panel-hover` | white 10% | white 85% |
| Hairline | `--g-hairline` | `border-hairline` | white 12% | ink 8% |
| Text primary | `--g-text` | `text-fg` | broadcast white | ink |
| Text secondary | `--g-text-2` | `text-fg-2` | 60% | 60% |
| Text muted | `--g-text-3` | `text-fg-3` | 64% | 62% |
| Action fill | `--g-action` | `bg-action` | gold | cardinal |
| Action hover | `--g-action-hover` | `bg-action-hover` | gold deep | cardinal deep |
| Action text | `--g-action-text` | `text-action-text` | ink | white |
| Shadow | `--g-shadow` | `shadow-[var(--g-shadow)]` | 45% black | 6% ink |
| Spotlight | `--g-glow` | used by `Spotlight` | cardinal 55% | gold 30% |

The base is set by `<Base kind="dark" | "cream">` from `src/design/Base.tsx`.

## Marketing stage (`:root`)

Near-black cinematic chrome for the public home page, the create preview, and the demo board. These do not replace `--g-ground`. No new hue: the light is white, and the action glow is a `color-mix` of `--g-gold`. Glass fill is opaque enough that square cells are not blurred; `.g-float` does not set `backdrop-filter`.

| Meaning | CSS variable | Used by | Value |
|---|---|---|---|
| Stage ground | `--g-stage` | `.marketing-stage`, `.demo-stage`, `.create-preview-stage` | `#07080B` |
| Glass wash | `--g-glass` | `.g-chip` | white 10% |
| Glass fill | `--g-glass-fill` | `.g-float`, `.g-pill` | lifted neutral 94% |
| Glass edge | `--g-glass-edge` | floating chrome | white 28% |
| Sheen | `--g-glass-sheen` | top highlight | white 16% |
| Stage light | `--g-stage-light` | one static radial behind the artifact | white 88% |
| Float shadow | `--g-shadow-float` | cards and frames | inset hairline, black shadow, soft white rim |
| Action glow | `--g-cta-glow` | `.g-cta` only | gold 55% |

`.g-cta`, `.g-float`, `.g-pill`, and `.g-chip` live in `src/design/tokens.css`. Reduced transparency swaps the translucent fills for `--g-chyron`. Reduced motion does not animate the light or the glow.

## Ambient tints (`:root`, base-independent)

Large, soft ground light for one section. Derived with `color-mix` from the locked palette (`transparent` first, so a downlevelled build falls back to no tint rather than a full-strength blob), so no new hue enters the system. Consumed only by `SectionTone`.

| Meaning | CSS variable | Tailwind | Value |
|---|---|---|---|
| Hero and pricing ambience | `--g-tint-cardinal` | `tint-cardinal` | cardinal 22% |
| Score-moment ambience | `--g-tint-live` | `tint-live` | live 22% |
| Organizer ambience | `--g-tint-gold` | `tint-gold` | gold 22% |

22% is a contrast cap, not a taste call, and it is a **hard ceiling** — the margin over AA is thin. Against the `#14161D` ground, the worst case is `--g-text-2` over a full-strength gold tint at **4.53:1**, which clears the 4.5:1 requirement by 0.03. `SectionTone` renders the tint at 0.75 layer opacity with radial falloff on top of that, so nothing on screen is ever this strong, but the token itself has no headroom left. Raising any tint past 22% puts secondary text below AA. `tests/design/contrast.test.ts` asserts both the cap and the composited ratio; `tests/design/docDrift.test.ts` asserts that this table and `DESIGN.md` still name the value `src/design/tokens.css` ships.

### Rim light

The former homepage device frames and their rim CSS were retired in the approved editorial redesign. The palette tokens `--g-rim`, `--g-rim-soft`, and `--g-rim-none` remain reserved; the homepage no longer consumes them. Product excerpts use the standard surface and cell borders.

## Type

| Role | CSS variable | Tailwind | Family |
|---|---|---|---|
| Display | `--g-font-display` | `font-display` | Instrument Serif |
| Interface | `--g-font-ui` | `font-ui` | Geist |
| Data, eyebrow | `--g-font-mono` | `font-mono` | Geist Mono |

## Shape

| Role | CSS variable | Tailwind | Value |
|---|---|---|---|
| Control | `--g-radius-control` | `rounded-control` | 12px |
| Card, sheet, glass | `--g-radius-card` | `rounded-card` | 20px |
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

The remaining `--gridone-*` variables in `src/index.css` back the unlayered cascade guards there: `--gridone-color-background`, `--gridone-color-brand-primary-deep` (button fill re-assertion), `--gridone-color-text-primary`, `--gridone-radius-surface`, `--gridone-radius-grid` (sharp board radius), and `--gridone-elevation-raised` (dialog elevation). The `Archivo` / `Chivo Mono` families and their `font-condensed` / `font-data` aliases are gone. Do not add new `--gridone-*` variables; use the `--g-*` tokens above.
