# GridOne Design Tokens

**Status:** Production mapping reference
**Normative overlay:** root `DESIGN.md`
**Implementation:** `src/index.css` under `@theme`
**Governance:** `docs/design-system-governance.md`

Root `DESIGN.md` owns token meaning. This file records the current CSS/Tailwind mapping. If values disagree, fix the mapping rather than creating another source of truth.

## Canonical colors

| Meaning | DESIGN.md token | CSS variable | Tailwind alias | Value |
|---|---|---|---|---|
| Brand identity/action | `colors.primary` | `--gridone-color-brand-primary` | `cardinal` | `#8F1D2C` |
| Brand pressed/depth | `colors.primary-deep` | `--gridone-color-brand-primary-deep` | `cardinal-deep` | `#6E1622` |
| Commitment/settled result | `colors.accent` | `--gridone-color-brand-accent` | `gold` | `#FFC72C` |
| Accent pressed/text support | `colors.accent-deep` | `--gridone-color-brand-accent-deep` | `gold-deep` | `#E0A600` |
| Working neutral | `colors.neutral` | `--gridone-color-broadcast-white` | `broadcast-white` | `#EFF0F1` |
| Quiet structure | `colors.neutral-quiet` | `--gridone-color-newsprint` | `newsprint` | `#DEE0E1` |
| Ink/page dark | `colors.ink` | `--gridone-color-ink` | `ink` | `#0E0F12` |
| Dark instrument surface | `colors.surface-dark` | `--gridone-color-chyron` | `chyron` | `#16181D` |
| Active NFL game only | `colors.live` | `--gridone-color-live` | `live` | `#22C55E` |

### Semantic restrictions

- Live green means only an actively in-progress NFL game.
- Gold means commitment or settled result—not generic emphasis.
- Cardinal carries brand identity and error/destructive meaning with explicit text/icon context.
- Paid/unpaid, selected, successful, stale, and corrected states never rely on color alone.
- New colors require a normative `DESIGN.md` change and rendered contrast evidence.

## Typography

| Role | Family | Key behavior |
|---|---|---|
| Display/heading/body/label | Archivo | Width/weight hierarchy; body remains readable |
| Data/instrument | Chivo Mono | Tabular scores, digits, coordinates, dates, counts, prices, source/freshness |

CSS mappings:

- `--gridone-font-condensed` → Tailwind `font-condensed`
- `--gridone-font-data` → Tailwind `font-data`
- `--gridone-font-sans` is legacy compatibility and should not define new product typography

Essential interface text is at least 14px. Ordinary body text targets 16px or larger. Tiny grid labels are a precision-instrument exception and require accessible full labels.

## Shape

| Role | DESIGN.md token | CSS variable | Alias | Value |
|---|---|---|---|---|
| Control | `rounded.control` | `--gridone-radius-control` | `rounded-control` | `8px` |
| Surface/dialog | `rounded.surface` | `--gridone-radius-surface` | `rounded-surface` | `12px` |
| Grid/instrument | `rounded.grid` | `--gridone-radius-grid` | `rounded-grid` | `0px` |

Pills and arbitrary radii are prohibited unless the component is literally a status, filter, tag, or segmented control and the overlay documents the exception.

## Spacing

Normative scale:

| Token | Value |
|---|---:|
| `spacing.xs` | `4px` |
| `spacing.sm` | `8px` |
| `spacing.md` | `16px` |
| `spacing.lg` | `24px` |
| `spacing.xl` | `32px` |
| `spacing.2xl` | `48px` |

Current CSS retains `--gridone-spacing-18` and `--gridone-spacing-22` as legacy layout aliases. New feature work uses the normative scale or explicit layout tokens added through governance.

## Elevation

`--gridone-elevation-raised` is the only elevation role.

Allowed:

- Semantic dialogs/sheets
- Sticky organizer context
- Floating board controls

Not allowed:

- Normal-flow cards
- The board/grid
- Phase fields
- Arbitrary Tailwind shadow utilities
- Multi-level shadow scales

## Components

Machine-readable contracts in root `DESIGN.md` currently cover:

- primary gold action and hover
- cardinal action and hover
- quiet neutral surface
- dark instrument surface
- live status role
- input

Production primitives must map to these roles and the universal state matrix. Component values are not copied into feature files.

## Legacy aliases pending removal

Current CSS includes compatibility aliases that do not represent approved new semantics:

- `--gridone-color-surface-glass` / `surface-glass`
- `--gridone-color-brand-accent-glow` / `gold-glow`
- `--gridone-color-brand-accent-dim` / `gold-dim`
- legacy `text-primary`, `text-secondary`, `text-tertiary`
- generic `background`, `surface`, and `surface-hover` roles from the earlier dark system

Rules:

- Existing consumers are inventoried before removal.
- New code cannot consume `glass` or `glow` aliases.
- Migration happens slice-by-slice with rendered comparison.
- Alias removal is complete only when deterministic design audit and full verification pass.

## Prohibited bypasses

Outside canonical token definitions and approved tests/generated artifacts:

- raw hex/RGB/HSL values;
- framework default colors such as `white`, `gray-*`, `neutral-*`, `emerald-*`;
- gradients, backdrop blur, decorative glow;
- arbitrary shadows or radii;
- hardcoded transition/easing values without a named interaction role;
- color-only semantic state.

Known violations are tracked in `docs/design-system-governance.md`; they are migration debt, not precedent.

## Verification

Formal overlay:

```bash
npx -y @google/design.md lint DESIGN.md
```

Current verified result on 2026-08-20: 0 errors, 0 warnings.

Implementation must add and pass a deterministic `npm run design:audit` gate, then run unit tests, build, browser tests, and rendered phone/desktop inspection.
