# GridOne Design-System Governance

**Status:** Planning and implementation authority
**Date:** 2026-08-20

## Authority chain

1. `PRODUCT.md` and resolved journey contracts define behavior, hierarchy, permissions, and product truth.
2. `docs/universal-interface-foundation.md` defines product-agnostic quality, interaction, accessibility, responsive, and anti-slop rules.
3. Root `DESIGN.md` is the machine-readable GridOne project overlay: brand roles, phase semantics, typography, shapes, components, and deliberate exceptions.
4. `docs/DESIGN_TOKENS.md` maps the overlay to production CSS variables and Tailwind aliases.
5. `src/index.css` implements tokens and shared primitives.
6. Feature components consume semantic aliases and primitives; they do not invent design values.

Conflict order:

- Product correctness and safety
- Accessibility
- Universal foundation
- GridOne overlay
- Local component preference

A local component cannot override a higher layer silently.

## Foundation and overlay separation

The universal foundation contains no GridOne colors, board vocabulary, pricing, routes, or lifecycle phases.

`DESIGN.md` contains only GridOne-specific identity and product composition. It may extend the foundation but cannot weaken accessibility or product truth.

## Machine-readable contract

Root `DESIGN.md` uses Google’s DESIGN.md alpha token schema and must pass:

```bash
npx -y @google/design.md lint DESIGN.md
```

Current verified result on 2026-08-20:

- 0 errors
- 0 warnings
- 9 color tokens
- 5 typography scales
- 3 radius roles
- 6 spacing tokens
- 8 component contracts

A warning-free lint proves token structure and declared contrast relationships only. It does not prove production CSS or rendered surfaces conform.

## Canonical GridOne decisions

- Product world: Game-Day Horizon
- Working surfaces: broadcast white/newsprint/ink
- Identity: cardinal
- Commitment/settlement: gold
- Active NFL game only: live green
- Precision grid: sharp 0px geometry
- Controls: 8px
- Surfaces/dialogs: 12px
- One restrained raised elevation role
- Archivo for display/body/labels; Chivo Mono for data/instruments
- No gradients, blur, decorative glow, universal glass, pills, or multi-level shadow scale
- Phase and state remain understandable without color or motion

## Token rules

- Production components use semantic CSS variables or approved Tailwind aliases.
- Raw hex/RGB values are allowed only in canonical token definitions, generated artifacts, tests validating tokens, or unavoidable third-party API values.
- A persisted user/domain value is not silently changed during visual cleanup; move it behind a token when appropriate.
- Legacy alias names may remain temporarily for migration, but new code cannot consume names containing `glass` or `glow`.
- Component-specific arbitrary radii, shadows, colors, and blur utilities are prohibited.
- White/gray framework defaults are not accepted substitutes for GridOne semantic tokens.

## Known implementation violations

Verified on 2026-08-20:

1. `components/AdminPanel.tsx` contains hardcoded `accent-[#8F1D2C]`.
2. `components/AdminPanel.tsx` uses `backdrop-blur-sm` on the upgrade surface.
3. `components/AdminPanel.tsx` uses arbitrary `shadow-2xl` rather than the one elevation token.
4. `src/index.css` retains legacy aliases such as `surface-glass`, `gold-glow`, and pre-overlay text helpers using framework white/gray values.
5. `docs/DESIGN_TOKENS.md` previously disagreed with actual CSS values and roles; this governance pass replaces it.

These are migration tasks, not permission for new violations.

## Required deterministic audit

Implementation must add a zero-LLM `design:audit` script that fails on non-token production-source bypasses, including:

- raw hex/RGB/HSL outside approved token files;
- default framework color classes in production components;
- gradient, blur, glow, arbitrary shadow, and arbitrary radius utilities;
- forbidden `glass`/`glow` alias consumption in new code;
- touch targets or essential typography below contract where statically detectable.

Allowlist entries require file, exact pattern, reason, owner, and expiry/removal condition. No blanket directories.

Suggested package gate:

```text
npm run design:audit
npx -y @google/design.md lint DESIGN.md
npm run test:unit
npm run build
```

Rendered browser and accessibility checks remain separate gates.

## Component primitive posture

Create primitives only where behavior and styling are reused across feature boundaries:

- Button/action hierarchy
- Input/field/error
- Semantic dialog/sheet
- Status/authority label
- Save/conflict banner
- Disclosure
- Sticky instrument controls

Do not build a speculative component library. Feature-specific compositions stay inside their feature.

## State matrix

Each reusable control or surface defines applicable states:

- rest
- hover
- focus-visible
- pressed
- disabled
- loading
- success
- warning
- error
- stale/offline
- destructive/confirmation

State semantics use token roles and text/icon redundancy.

## Typography governance

- Display and heading roles use Archivo only where hierarchy benefits from its width/weight character.
- Body remains calm and readable; essential text is never below 14px.
- Chivo Mono is reserved for scores, digits, coordinates, dates, counts, prices, source/freshness, and compact operational data.
- Uppercase is limited to short cue/label roles.
- Font loading/fallback behavior must prevent invisible text and excessive layout shift.

## Motion governance

- Product routes use native scroll.
- Optional cinematic story runtime is isolated from product routes.
- Motion tokens/values are added only with named interaction purpose.
- Reduced-motion coverage is required in the same slice that introduces motion.
- One authored focal motion per major surface is a ceiling, not a quota.

## Review and change process

A token or foundation change requires:

1. Product/accessibility reason
2. Affected surface inventory
3. `DESIGN.md` change when normative
4. CSS mapping change
5. Deterministic audit/test update
6. Rendered comparison at phone/desktop and relevant states
7. Documented migration/removal of superseded aliases

Do not add tokens to solve one component without checking whether an existing semantic role already fits.

## Release evidence

Before a whole-app UI release:

- Formal DESIGN.md lint passes with zero errors/warnings.
- Deterministic design audit passes.
- Typecheck, unit/integration tests, production build, and browser suite pass.
- Representative signed-out, organizer phase, viewer unpersonalized/personalized, stale/offline/manual, dialog, empty, conflict, and Final states are inspected on phone and desktop.
- Diff review confirms no schema, permission, pricing, scoring, or unrelated copy drift.
- Staged content is checked for credentials and unintended generated artifacts.

## Definition of governed

The system is governed when:

- there is one product overlay;
- CSS tokens match it;
- components consume semantic roles;
- bypasses fail deterministically;
- rendered states meet the foundation;
- legacy aliases have a documented removal path;
- design changes can be explained by product outcome rather than taste alone.
