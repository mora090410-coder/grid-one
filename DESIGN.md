---
version: alpha
name: GridOne
description: Organizer-first GridOne with the approved matte midnight navy and muted-gold palette. One coherent material system across acquisition, organizing, selling and game day.
colors:
  primary: "#101B2A"
  primary-deep: "#101B2A"
  accent: "#B7A477"
  success: "#1E5A3C"
  neutral: "#F0EDE5"
  neutral-quiet: "#D9DDD8"
  ink: "#101B2A"
  stone: "#5B6670"
  surface-dark: "#223249"
  ground-dark: "#101B2A"
  ground-cream: "#101B2A"
  danger: "#8F1D2C"
  live: "#22C55E"
  editorial-paper: "#101B2A"
  editorial-raised: "#192638"
  editorial-ink: "#F0EDE5"
  editorial-muted: "#B4BDCA"
  editorial-action: "#B7A477"
  editorial-line: "#728198"
typography:
  display:
    fontFamily: Archivo
    fontSize: 3.5rem
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
  heading:
    fontFamily: Archivo
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  body:
    fontFamily: Archivo
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  label:
    fontFamily: Geist Mono
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1
    letterSpacing: 0.12em
  data:
    fontFamily: Geist Mono
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0em
rounded:
  control: 12px
  surface: 18px
  capsule: 999px
  grid: 4px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  editorial-canvas:
    backgroundColor: "{colors.editorial-paper}"
    textColor: "{colors.editorial-ink}"
    typography: "{typography.body}"
  editorial-sheet:
    backgroundColor: "{colors.editorial-raised}"
    textColor: "{colors.editorial-muted}"
    rounded: "{rounded.surface}"
    padding: 24px
  editorial-edge:
    backgroundColor: "{colors.editorial-line}"
    height: 1px
  editorial-primary:
    backgroundColor: "{colors.editorial-action}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: 14px
  button-primary-dark:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.capsule}"
    padding: 14px
  button-primary-cream:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.body}"
    rounded: "{rounded.capsule}"
    padding: 14px
  winning-square:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.grid}"
    padding: 4px
  glass-panel:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.surface}"
    padding: 20px
  island:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.capsule}"
    padding: 16px
  status-settled:
    backgroundColor: "{colors.success}"
    textColor: "{colors.neutral}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: 8px
  destructive-confirm:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.neutral}"
    typography: "{typography.body}"
    rounded: "{rounded.capsule}"
    padding: 14px
  status-live:
    backgroundColor: "{colors.live}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: 8px
  input:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.neutral}"
    typography: "{typography.body}"
    rounded: "{rounded.capsule}"
    padding: 14px
---

# GridOne Design System — Corner Square on Broadcast Glass

Normative current-production baseline. The Corner Square identity (adopted September 25, see below) supplies the logo, palette, and type; the Broadcast Glass structure supplies the surfaces, motion, and notch. Brand tokens live in `src/styles/tokens.css`; the semantic tokens built from them live in `src/design/tokens.css`, with primitives in `src/design/primitives/`. Mapping in `docs/DESIGN_TOKENS.md`. Original Broadcast Glass rationale in `docs/superpowers/specs/2026-09-01-broadcast-glass-redesign-design.md`.

## Corner Square identity — September 25

- **Logo:** Corner Square. A G drawn in one heavy stroke, with its top right corner broken off as a gold square. One `Logo` component (`src/design/primitives/Logo.tsx`) renders the kit's SVG files unchanged, in mark, horizontal, and stacked variants and color, reversed, black, and white tones. Its accessible name is always "GridOne".
- **Secondary pattern:** Square One. The 10 by 10 board with one gold square, for loading, empty states, and share images. Never the logo The `SquareOne` primitive renders the kit file (reversed on ink), hidden from assistive tech, with one opacity fade and no movement; reduced motion shows it at once.
- **Palette A adoption:** muted gold (`--g-gold`) marks actions and selection as well as result emphasis. A gold surface alone never establishes a winner: NOW/current matching, confirmed milestone labels, OPEN states and accessible names remain distinct. No metallic gradients, ambient gold glows or decorative status percentages.
- **Board:** open squares use the brand cell fill (`--g-cell`) with brand line edges (`--g-cell-edge`); claimed squares are text on surface with the same edges; axis digits are chalk on the raised chyron. Winning squares carry `gridone-winner` and a solid gold fill with ink text, and are the only gold on the board. A selected square takes an ink (chalk on the dark base) ring. NOW, C, and the accessible name separate the current match from past winners, never color alone.
- **Team colors:** a thin team-color stripe with a light hairline may sit beside a team's name (score and board key). It is decorative and never replaces the name. Gold and yellow team colors are never used, because gold means winner; a team whose only usable colors are gold and near-black gets no stripe. No NFL or club logos. Colors live in `src/features/viewer/teams/teamColors.ts`.
- **Name:** always GridOne. One word, capital G, capital O.

## Exploration and intentional adoption

Broadcast Glass is the maintained implementation, not a ceiling on creative judgment. The palette, type, layout, geometry, iconography, materials, and motion mechanisms below describe current choices. Propose stronger alternatives when they improve organizer success, viewer comprehension, trust, or maintainability; do not reject them solely for departing from this style. Label concepts and unverified assumptions.

Exploration is not production authorization. A selected alternative requires approved scope, coordinated token/design/journey/test updates, reversible implementation, and relevant rendered, accessibility, integrity, and release evidence. Keep the exact token values above and current contracts for unchanged surfaces until intentional adoption. Truthful claims, pricing, permissions, privacy, payment boundaries, score authority, and accessibility outcomes are not aesthetic options.

## Current production thesis

Game day should feel like a broadcast graphic on a quiet phone: one number that matters, glass over a dark field, nothing to click twice. Setup should feel like a sheet of warm paper: everything editable in place, progress visible in one glance.

## Current bases and palette

- **Dark** (viewer and article pages): ground `#101B2A`, matte raised panels `#192638`, square/axis depth `#223249`, warm foreground `#F0EDE5`, muted text `#B4BDCA`, essential edges `#728198`. The primary action is muted gold with navy text.
- **Cream** (organizer workspace, dashboard; historical attribute retained): the same approved midnight palette, not a light theme. The component API remains compatible while surfaces share one coherent identity.
- Current matching is not a confirmed winner. Result labels, milestones and accessible names remain the authority; color is supporting feedback.
- Turf `#1E5A3C` marks settled and success states (Drawn, Published, Paid), sparingly. On the dark base the tag uses a light turf for contrast.
- Cardinal `#8F1D2C` is kept for errors and destructive confirmations only, always with explicit text. It is not a brand or action color.
- Live green means an in-progress NFL game and nothing else.
- No state relies on color alone.

**Ambient tone.** A long page may carry color as *light* rather than as chromatic UI: one large, soft, low-alpha ground tint per section, drawn from cardinal, live, or turf (never gold), sitting on a section's vertical mid-edge. The older marketing stage used brand ink; the November organizer-first adoption below supersedes it on the homepage and create entrance. Explanatory content remains static; one optional GSAP sequence emphasizes score → last digits → matching square, with no pinning or scrubbing. All content is present before the animation loads; reduced motion renders the finished explanation. Tints are capped at 20% of their brand color so body text over one still meets AA; they are never a gradient, never a corner, and never carry meaning.

## Current type

- Display and interface: Archivo, one brand face, self-hosted as a variable font. Display headings and board names are bold (700, 800 for the hero) with the brand's tight `-0.03em` tracking; headings `h1`–`h3` take the same tracking. Interface text is 400/500; 600 only for the single primary action.
- Data and eyebrow: Geist Mono, tabular. Large numerals dim their secondary segment.
- Essential text ≥ 14px. Grid-cell labels are the precision exception and carry accessible full labels.

## Current shape

Controls 12px. Cards, sheets, glass 18px. Buttons, tags, chips, island: capsule. Grid cells 4px.

## Current motion

State ease 200ms `cubic-bezier(0.2, 0, 0, 1)`. Soft spring ~450ms, no overshoot, for island, sheet, shared-element moves, and the draw. Reduced motion collapses both to a 120ms fade. Routes never hard-swap.

**Reveal is visible by default.** Scroll-entry reveals use `Reveal`, whose *resting* CSS state is finished content: no transform, no opacity change, no transition. The hidden start state is applied only from a `useLayoutEffect` — before paint, so nothing flashes — and only when JS is running, `IntersectionObserver` exists, and motion is allowed. A server render, a no-JS browser, a browser without an observer, and a reduced-motion reader all see the completed page immediately. Reveals animate opacity and `translateY` only, so they can never shift layout. Focusable regions may use `keepVisible`, which rises without dropping opacity.

**Page-load entrance and digits.** The homepage hero may run one staggered entrance. It never starts at `opacity: 0`, never uses `data-reveal` above the fold, and is skipped under reduced motion and without JavaScript. Changing scores, counts, and drawn numbers roll only the digits that changed. A matching square may take a brief inset emphasis. Board cells do not scale, and the 10×10 geometry stays fixed.

**Parallax is capped.** Scroll-driven parallax moves vertically only, never horizontally (horizontal transforms change page overflow), is clamped to 40px of travel, and is inert under reduced motion and below the `md` breakpoint.

## Current Island mechanisms

Viewer: the existing score capsule appears only after the main score leaves view. Its interaction remains unchanged.

Organizer: a dark, horizontally centered capsule sits in a reserved sticky top strip on phone and desktop. Its compact text follows the active task and explicitly labels assignment, payment, save, and game states. Tap/click or a cancellable touch hold expands the same surface; hover never opens it. Width and height use the soft state transition without scaling text; reduced motion uses a 120ms fade. Expansion preserves the strip height and is bounded by the viewport. Escape, outside activation, or focus leaving collapses it; actions restore focus to the trigger before opening another sheet. The outer section is named `Organizer status`; expanded `Board details` contains one primary next action and secondary shortcuts. Full private payment lists use the Payments sheet.

Payment counts always describe squares. Paid, Unpaid and Not asked yet remain separate; payment follow-up never blocks publishing. The organizer's cream workspace, square editing, and allocation flows retain their established controls.

Score freshness is information, not decoration: viewer updates arrive about every three minutes, and the island's expanded state always shows the source and the retrieved time. Never imply realtime delivery.

## Current editorial direction

1. Current hero imagery uses the product. Illustrations, photography, or other treatments may be explored when they better explain the outcome without implying nonexistent features or customer evidence.
2. Current desktop layouts are asymmetric and left-anchored; phone layouts may center. Evaluate alternatives by comprehension and task completion, not alignment alone.
3. Current lighting uses one artifact spotlight with optional soft, edge-anchored `SectionTone` ground light. Different treatments require intentional adoption and rendered contrast verification.
4. Current hierarchy relies on scale contrast rather than repeated feature cards. Alternative grouping is valid when it improves scanning and understanding.
5. Use verified actual values when available; otherwise show truthful empty or unknown states. Clearly label demo fixtures and example matchups. Never imply real customers, usage, scores, payments, or fundraising results from fixtures.
6. Current icon use is restrained and visually coherent. Use icons when they help recognition; preserve accessible names and never make meaning icon-only.
7. Choose voice and length for the audience and action. Prefer specific, natural copy over filler; there is no universal word blacklist. Use truthful requested Beta labeling and explain review or other limitations, without exact-sentence exemptions.
8. Current palette, lighting, and varied radii remain the unchanged-production baseline. Other colors, gradients, geometry, and materials may be proposed and intentionally adopted with coherent tokens and accessibility evidence.

## Accessibility

- Text contrast meets WCAG AA at rendered size on both bases; glass panels are checked against their real blurred backdrop, not a flat swatch.
- Every tap target is at least 44×44px. Grid cells are the precision exception and expose a full accessible label.
- Everything works with keyboard alone: island, sheet, capsule inputs, board navigation. Escape closes the topmost layer and returns focus.
- Live score changes and phase changes are announced through a polite live region; nothing critical is conveyed by color, motion, or hover alone.
- Reduced motion is honored everywhere (see Motion).

## Marketing stage — September 22

Historical September direction: Anthony chose a full dark premium for the public home page, the create-page preview frame, and the demo board chrome. The November adoption below supersedes home and create only; demo chrome retains this treatment. Those surfaces use `--g-stage` (brand ink since the Corner Square rebrand), frosted `--g-glass-fill` / `--g-glass-edge` chrome, and `--g-shadow-float`. One soft white stage light (`--g-stage-light`) sits behind the hero artifact, the create preview, and the demo board. It does not pulse, and it is not a filter on the squares. Primary actions carry a soft static chalk glow through `--g-cta-glow`; gold stays off actions, status, and prices. The matching square keeps the board's solid gold winner fill. Square grids stay opaque and unfiltered; open cells use a solid fill. `prefers-reduced-motion: reduce` leaves the glass, the light, and the action glow in place and runs no entrance or pulse — the existing one-shot hero entrance, score explanation, and digit motion already collapse. `prefers-reduced-transparency: reduce` replaces translucent chrome with the solid chyron surface. The cream organizer workspace and the lifted viewer ground are unchanged.

## Truth, access, and integrity requirements

- No invented payout, customer, fundraising, or guarantee claims. GridOne never collects square money, holds a pot, or pays winners, and every surface that mentions money says so.
- Use audience-familiar terms consistently and literally, following `PRODUCT.md`. Do not imply betting, funds custody, payout processing, or unavailable capabilities; a word alone is not a violation.
- Score source and retrieved time are never hidden while a score is shown.
- No hover-only meaning. No color-only state.
- Phone viewers must be able to find their squares and read full details without deciphering tiny grid labels. The current personal summary and Find My Squares satisfy that outcome; an approved alternative must preserve it.

## Current material conventions

- The island renders dark on the cream base; it is a broadcast object.
- Pills are the default for actions, tags, and inputs. The former pill prohibition is withdrawn.

## Authorized replacement notch — September 16

The organizer and finalized-viewer islands now share ContextNotch, replacing (not supplementing) their former disclosure surfaces. This section supersedes the island-specific hover, capsule and motion descriptions above; unchanged surfaces retain their baseline.

One dark surface attaches to the top of the web shell with inverse shoulders. It reveals a three-cell rail and one attached selected detail, without scaling text. Viewer modules are Game / Find squares (Your squares after identity) / Results; organizer preparation is Board / Payments / Share, and publication changes this to Game / Results / Share. Only assigned-square fraction has a ring. Main score, identity, personal summary, exact board, payment workspace and confirmation flows remain canonical.

Fine-pointer hover previews; clicking a preview pins. Tap/Enter/Space opens; Keep open, Unpin, Close and Escape are explicit. Existing cancellable organizer touch hold remains optional. Hidden contents are inert. Action invocation closes synchronously and focuses the persistent toggle before the existing callback. The viewer retains this target through dialog interactions, and hides when the main score returns and focus safely leaves. It yields while the main Find entry passes beneath the attachment.

Motion uses sampled damped spring unit-step responses: unfold .42/.78, contents .36/.82, detail glide/resize .5/.86, reading .9/.9 (response/damping). Contents trail by 45ms capped at 180ms. Detail crossfade is 160ms ease-in-out; retraction is 200ms ease-in with no exit delay. Reduced motion is instant, not a shortened spring. This is an explicit web translation, not native SwiftUI glass or hardware integration; attribution is in THIRD_PARTY_NOTICES.md. Geometry tokens retain the --g-* namespace. Execution and browser evidence live under .hermes/notch-implementation/.

### Notch refinement 1

The shell is explicitly brand ink `--g-ink` with concave shoulders and a discreet rim. Module controls are circular medallions with original simple SVG symbols and readable labels beneath, not bordered rectangular tabs. Only Board assignment uses a measured progress ring. One attached detail card uses a visible connector aligned to the selected cell's measured center; wide layouts bound and move the card, narrow layouts use the available width. Both remain the same DOM objects during selection. Contents keep their destination layout while the shell unfolds; unchanged observer measurements do not restart motion. Interrupted geometry is sampled before cancellation, and a reduced-motion preference change cancels every active notch animation, including independent reading rings. Refinement evidence uses the `pass-refine1` files under `.hermes/notch-implementation/`; visual acceptance still belongs to review, not this specification alone.


## Inline notch quick views — September 21

Game shows the score and period alongside authority and freshness. Results shows Q1, Halftime, Q3, and Final in place, including canonical published names or OPEN, scores, digits, and correction indicators; pending and unconfirmed results never imply a winner. An empty history explicitly says no results are published. Reading this summary requires no navigation. The viewer keeps its name selector and Your squares summary. Organizer sharing actions belong to Share; an explicit correction action appears only when a published result exists. Existing disclosure keyboard, focus, reduced-motion and scroll behavior remains authoritative.


## Organizer-first editorial adoption — November 5, 2026

Authorized local implementation; release acceptance remains pending rendered browser evidence.
The homepage and `/create` use `.g-editorial` on the cream base. The scoped semantic
map in `src/design/tokens.css` now uses matte midnight `#101B2A`, raised navy `#192638`,
warm foreground `#F0EDE5`, secondary text `#B4BDCA`, and muted-gold actions `#B7A477`.
Existing error cardinal is unchanged. Essential edges use `#728198`; token contrast
tests require 4.5:1 for text and 3:1 for edges. Colors, shadow, type scale, gutters,
and section spacing belong to the `--g-*` layer. No parallel token namespace.

The acquisition hierarchy is organizer promise → real create/demo actions → a
100-square interactive illustration → organizer mechanics → honest scoring →
existing seasonal pricing → questions and guides. The sample has three explicit
stages, a single keyboard grid entry, arrow/Home/End navigation, and an adjacent
persistent selected-square detail. Names stay in place. Setup axes are undrawn;
game-day axes use the existing demo fixture. Illustrative current matching never
claims a confirmed quarter result. Share explains viewer and seller capabilities
and opens the real demo instead of pretending to copy a production link.

Motion is a short, interruptible opacity/translation transition on stage text,
plus the existing optional score explanation. Controls and content are available
immediately. Reduced motion gets no sample animation. No scroll capture,
autoplay, staggered cell effects, or obligatory animation waits. The create preview
retains recovery/auth/save/import behavior; next-step text follows actual field
readiness. The established Corner Square logo geometry remains intact; white
variants are used on the adopted midnight ground. Viewer, demo, organizer workspace,
dashboard, guides and legal surfaces now share palette A. This visual adoption does not change
business logic, security boundaries, pricing, or the eight organizer phases.
