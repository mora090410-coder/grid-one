---
version: alpha
name: GridOne
description: Broadcast Glass — quiet, physical, few clicks. Dark spotlight for game day, warm cream for setup.
colors:
  primary: "#8F1D2C"
  primary-deep: "#6E1622"
  accent: "#FFC72C"
  accent-deep: "#E0A600"
  neutral: "#EFF0F1"
  neutral-quiet: "#DEE0E1"
  ink: "#0E0F12"
  surface-dark: "#282B32"
  ground-dark: "#14161D"
  ground-cream: "#F5F1EA"
  live: "#22C55E"
typography:
  display:
    fontFamily: Instrument Serif
    fontSize: 3.5rem
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.01em"
  heading:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: Geist
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
  surface: 20px
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
  button-primary-dark:
    backgroundColor: "{colors.accent}"
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

# GridOne Design System — Broadcast Glass

Normative contract. Implementation lives in `src/design/tokens.css` and `src/design/primitives/`. Mapping in `docs/DESIGN_TOKENS.md`. Full rationale in `docs/superpowers/specs/2026-09-01-broadcast-glass-redesign-design.md`.

## Thesis

Game day should feel like a broadcast graphic on a quiet phone: one number that matters, glass over a dark field, nothing to click twice. Setup should feel like a sheet of warm paper: everything editable in place, progress visible in one glance.

## Two bases, one palette

- **Dark** (viewer, homepage, article pages): ground `#14161D`, one spotlight behind the hero artifact, glass panels (white 7%, hairline white 12%, blur 20px). Gold is the only action color. Cardinal appears in the brand mark and destructive confirmations with explicit text. Marketing stages use the near-black `--g-stage` and a white stage light; see Marketing stage.
- **Cream** (organizer workspace, dashboard): ground `#F5F1EA`, cards white 70% with ink hairline 8%. Cardinal is the action color. Gold marks committed and settled states only.
- Live green means an in-progress NFL game and nothing else.
- No state relies on color alone.

**Ambient tone.** A long page may carry color as *light* rather than as chromatic UI: one large, soft, low-alpha ground tint per section, drawn from the same three brand colors, sitting on a section's vertical mid-edge. The public marketing homepage is one near-black stage with glass cards, without ambient section tints. Its real product excerpts are static; one optional GSAP sequence emphasizes score → last digits → matching square, with no pinning or scrubbing. All content is present before the animation loads; reduced motion renders the finished explanation. Tints are capped at 22% of their brand color so body text over one still meets AA; they are never a gradient, never a corner, and never carry meaning.

## Type

- Display: Instrument Serif. Hero headlines and board names only.
- Interface: Geist 400/500; 600 only for the single primary action.
- Data and eyebrow: Geist Mono, tabular. Large numerals dim their secondary segment.
- Essential text ≥ 14px. Grid-cell labels are the precision exception and carry accessible full labels.

## Shape

Controls 12px. Cards, sheets, glass 20px. Buttons, tags, chips, island: capsule. Grid cells 4px.

## Motion

State ease 200ms `cubic-bezier(0.2, 0, 0, 1)`. Soft spring ~450ms, no overshoot, for island, sheet, shared-element moves, and the draw. Reduced motion collapses both to a 120ms fade. Routes never hard-swap.

**Reveal is visible by default.** Scroll-entry reveals use `Reveal`, whose *resting* CSS state is finished content: no transform, no opacity change, no transition. The hidden start state is applied only from a `useLayoutEffect` — before paint, so nothing flashes — and only when JS is running, `IntersectionObserver` exists, and motion is allowed. A server render, a no-JS browser, a browser without an observer, and a reduced-motion reader all see the completed page immediately. Reveals animate opacity and `translateY` only, so they can never shift layout. Focusable regions may use `keepVisible`, which rises without dropping opacity.

**Page-load entrance and digits.** The homepage hero may run one staggered entrance. It never starts at `opacity: 0`, never uses `data-reveal` above the fold, and is skipped under reduced motion and without JavaScript. Changing scores, counts, and drawn numbers roll only the digits that changed. A matching square may take a brief inset emphasis. Board cells do not scale, and the 10×10 geometry stays fixed.

**Parallax is capped.** Scroll-driven parallax moves vertically only, never horizontally (horizontal transforms change page overflow), is clamped to 40px of travel, and is inert under reduced motion and below the `md` breakpoint.

## The Island

Viewer: the existing score capsule appears only after the main score leaves view. Its interaction remains unchanged.

Organizer: a dark, horizontally centered capsule sits in a reserved sticky top strip on phone and desktop. Its compact text follows the active task and explicitly labels assignment, payment, save, and game states. Tap/click or a cancellable touch hold expands the same surface; hover never opens it. Width and height use the soft state transition without scaling text; reduced motion uses a 120ms fade. Expansion preserves the strip height and is bounded by the viewport. Escape, outside activation, or focus leaving collapses it; actions restore focus to the trigger before opening another sheet. The outer section is named `Organizer status`; expanded `Board details` contains one primary next action and secondary shortcuts. Full private payment lists use the Payments sheet.

Payment counts always describe squares. Paid, Unpaid and Not asked yet remain separate; payment follow-up never blocks publishing. The organizer's cream workspace, square editing, and allocation flows retain their established controls.

Score freshness is information, not decoration: viewer updates arrive about every three minutes, and the island's expanded state always shows the source and the retrieved time. Never imply realtime delivery.

## Anti-slop rules

1. The product is the hero image. No illustrations, stock, or abstract 3D.
2. Asymmetric, left-anchored layouts on desktop. Centered only on single-column phone.
3. One spotlight per page, focused behind the artifact. A section may additionally carry one ambient ground tint (`SectionTone`) — light in the room, not a second spotlight: far larger, far softer, edge-anchored, and never focused on anything. A section may hold both.
4. Hierarchy from scale contrast, not card count. No three-up feature rows.
5. Real numbers and real team names everywhere, including empty states.
6. Icons almost never. When required: one set, one stroke weight, 16px, muted.
7. Copy is short, specific, occasionally dry. Banned: seamless, effortless, unlock, supercharge, elevate, powerful, robust.
8. No purple, no multi-color gradients, no corner glows, no uniform radius on every element.

## Accessibility

- Text contrast meets WCAG AA at rendered size on both bases; glass panels are checked against their real blurred backdrop, not a flat swatch.
- Every tap target is at least 44×44px. Grid cells are the precision exception and expose a full accessible label.
- Everything works with keyboard alone: island, sheet, capsule inputs, board navigation. Escape closes the topmost layer and returns focus.
- Live score changes and phase changes are announced through a polite live region; nothing critical is conveyed by color, motion, or hover alone.
- Reduced motion is honored everywhere (see Motion).

## Marketing stage — September 22

Anthony chose a full dark premium for the public home page, the create-page preview frame, and the demo board chrome. Those surfaces use `--g-stage`, frosted `--g-glass-fill` / `--g-glass-edge` chrome, and `--g-shadow-float`. One soft white stage light (`--g-stage-light`) sits behind the hero artifact, the create preview, and the demo board. It does not pulse, and it is not a filter on the squares. Gold appears on primary actions through `--g-cta-glow` and stays off status, prices, and matching squares on these surfaces. Matching emphasis there is white with a static outer glow. Square grids stay opaque and unfiltered; open cells use a solid fill. `prefers-reduced-motion: reduce` leaves the glass, the light, and the action glow in place and runs no entrance or pulse — the existing one-shot hero entrance, score explanation, and digit motion already collapse. `prefers-reduced-transparency: reduce` replaces translucent chrome with the solid chyron surface. The cream organizer workspace and the lifted viewer ground are unchanged.

## Absolute bans

- No invented payout, customer, fundraising, or guarantee claims. GridOne never collects square money, holds a pot, or pays winners, and every surface that mentions money says so.
- One vocabulary: board, square, organizer, viewer, participant. Never pool, contest, player, or guest in product copy.
- Score source and retrieved time are never hidden while a score is shown.
- No hover-only meaning. No color-only state.
- No tiny full-name cells as the primary phone board; the personal summary and Find My Squares come first.

## Deliberate exceptions

- The island renders dark on the cream base; it is a broadcast object.
- Pills are the default for actions, tags, and inputs. The former pill prohibition is withdrawn.

## Authorized replacement notch — September 16

The organizer and finalized-viewer islands now share ContextNotch, replacing (not supplementing) their former disclosure surfaces. This section supersedes the island-specific hover, capsule and motion descriptions above; unchanged surfaces retain their baseline.

One dark surface attaches to the top of the web shell with inverse shoulders. It reveals a three-cell rail and one attached selected detail, without scaling text. Viewer modules are Game / Find squares (Your squares after identity) / Results; organizer preparation is Board / Payments / Share, and publication changes this to Game / Results / Share. Only assigned-square fraction has a ring. Main score, identity, personal summary, exact board, payment workspace and confirmation flows remain canonical.

Fine-pointer hover previews; clicking a preview pins. Tap/Enter/Space opens; Keep open, Unpin, Close and Escape are explicit. Existing cancellable organizer touch hold remains optional. Hidden contents are inert. Action invocation closes synchronously and focuses the persistent toggle before the existing callback. The viewer retains this target through dialog interactions, and hides when the main score returns and focus safely leaves. It yields while the main Find entry passes beneath the attachment.

Motion uses sampled damped spring unit-step responses: unfold .42/.78, contents .36/.82, detail glide/resize .5/.86, reading .9/.9 (response/damping). Contents trail by 45ms capped at 180ms. Detail crossfade is 160ms ease-in-out; retraction is 200ms ease-in with no exit delay. Reduced motion is instant, not a shortened spring. This is an explicit web translation, not native SwiftUI glass or hardware integration; attribution is in THIRD_PARTY_NOTICES.md. Geometry tokens retain the --g-* namespace. Execution and browser evidence live under .hermes/notch-implementation/.

### Notch refinement 1

The shell is explicitly near-black `--g-ink` with concave shoulders and a discreet rim. Module controls are circular medallions with original simple SVG symbols and readable labels beneath, not bordered rectangular tabs. Only Board assignment uses a measured progress ring. One attached detail card uses a visible connector aligned to the selected cell's measured center; wide layouts bound and move the card, narrow layouts use the available width. Both remain the same DOM objects during selection. Contents keep their destination layout while the shell unfolds; unchanged observer measurements do not restart motion. Interrupted geometry is sampled before cancellation, and a reduced-motion preference change cancels every active notch animation, including independent reading rings. Refinement evidence uses the `pass-refine1` files under `.hermes/notch-implementation/`; visual acceptance still belongs to review, not this specification alone.


## Inline notch quick views — September 21

Game shows the score and period alongside authority and freshness. Results shows Q1, Halftime, Q3, and Final in place, including canonical published names or OPEN, scores, digits, and correction indicators; pending and unconfirmed results never imply a winner. An empty history explicitly says no results are published. Reading this summary requires no navigation. The viewer keeps its name selector and Your squares summary. Organizer sharing actions belong to Share; an explicit correction action appears only when a published result exists. Existing disclosure keyboard, focus, reduced-motion and scroll behavior remains authoritative.
