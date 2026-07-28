---
name: GridOne
description: Live football squares boards under stadium lights — cardinal, gold, and a grid that scores itself.
colors:
  background: "#0B0C0F"
  surface: "#1c1c1e"
  surface-hover: "#2c2c2e"
  surface-glass: "rgba(28, 28, 30, 0.6)"
  cardinal: "#8F1D2C"
  cardinal-hover: "#7A1622"
  cardinal-subtle: "rgba(143, 29, 44, 0.15)"
  gold: "#FFC72C"
  gold-dim: "rgba(255, 199, 44, 0.3)"
  gold-glow: "rgba(255, 199, 44, 0.4)"
  live: "#22C55E"
  text-primary: "#FFFFFF"
  text-secondary: "rgba(235, 235, 245, 0.6)"
  text-tertiary: "rgba(235, 235, 245, 0.3)"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3rem)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "clamp(1.25rem, 3vw, 1.5rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.1em"
rounded:
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  18: "4.5rem"
  22: "5.5rem"
components:
  button-primary:
    backgroundColor: "{colors.cardinal}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    padding: "8px 24px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.cardinal-hover}"
  card-glass:
    backgroundColor: "{colors.surface-glass}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  nav-header:
    backgroundColor: "{colors.background}"
    height: "64px"
  board-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "0px"
---

# Design System: GridOne

## Overview

**Creative North Star: "The Stadium Night Broadcast"**

GridOne is meant to look like a game being broadcast after dark: a deep near-black field, team colors carrying the identity, and a single live-green pulse that says the game is happening right now. Cardinal (#8F1D2C) and gold (#FFC72C) are not decorative accent picks — they are school-and-team colors, the palette a booster club or church league would recognize as its own. That instinct is the strongest thing in the system and it is what the redesign protects.

The implemented system only partly delivers that broadcast intent. Where the North Star calls for the confident, high-contrast clarity of an on-air graphics package, the execution frequently reaches for a translucent, blurred surface treatment instead — `.glass-panel` (a 60%-opacity charcoal fill behind a 24px backdrop blur, hairline white border, 16px radius) is applied to cards, panels, modals, and toolbars alike. Depth is therefore communicated by haze rather than by the crisp tonal separation a broadcast package would use. The board itself layers further translucency on top: sticky axis headers at `#232327` / 95% with their own backdrop blur, and cell fills built from white at 3–8% opacity.

Typography is a single family (Inter) run across a weight range from 400 to 900, with hierarchy carried almost entirely by weight and size rather than by any contrast of form. Text color is expressed as white at descending opacities (95%, 80%, 60%, 40%, 30%) rather than as distinct values, which keeps everything on one tonal axis. The result reads as competent and quiet — the "stadium night" is present in the palette and the darkness, but not yet in the structure, the type, or the light.

One genuinely distinctive element exists: the landing page's scroll-scrubbed hero, in which a paper squares board creases, crumples, and is tossed away while the digital GridOne board assembles itself. It is the product's actual story — OCR a paper grid into a live board — told visually, and it is built from real GPU-friendly transforms rather than stock motion.

**Key Characteristics:**
- Near-black canvas (#0B0C0F) with charcoal surfaces (#1c1c1e)
- Cardinal and gold as team-identity colors, not generic accents
- Live green (#22C55E) reserved exclusively for game-is-happening state
- Single-family typography (Inter, 400–900) with weight-driven hierarchy
- Translucent, blurred surfaces as the dominant depth device — the system's confirmed anti-reference
- A 10x10 board as the recurring hero object, with sticky axis headers and quarter switching
- Text as white-at-opacity rather than discrete tonal values

## Colors

A dark, team-derived palette: two saturated identity colors held against a near-black field, with a single functional green reserved for live state.

### Primary
- **Cardinal** (#8F1D2C): The brand's load-bearing color. Primary CTAs (`.btn-cardinal`), the logo ring, destructive-adjacent emphasis, and any moment that needs to read as GridOne rather than as chrome. Deepened to #7A1622 on hover. At 15% opacity it becomes a tint background for selected and highlighted states.
- **Gold** (#FFC72C): The counter-identity color. Active states, highlights, winner emphasis, and accent details. Used at 30% opacity for tint fields and at 40% for glow shadows.

### Tertiary
- **Live Green** (#22C55E): Strictly functional. Marks a game in progress and nothing else. It is the only color in the system with a single, non-negotiable meaning.

### Neutral
- **Field Black** (#0B0C0F): The page canvas. The single canonical near-black; several near-black variants (#050505, #060607, #09090b) were consolidated into this value.
- **Charcoal Surface** (#1c1c1e): Cards, panels, and input backgrounds. Lifts to #2c2c2e on hover.
- **Glass Charcoal** (rgba(28,28,30,0.6)): The translucent panel fill. Documented because it is pervasive, not because it should persist.
- **White** (#FFFFFF) and the cool-white opacity ladder (rgba(235,235,245,·) at 60% and 30%): primary, secondary, and tertiary text.

### Named Rules
**The Team Colors Rule.** Cardinal and gold are inherited identity, not styling choices. They may be re-expressed — different weights, surfaces, proportions, or materials — but they are not replaced. Any future direction that discards them has changed the brand, not the design.

**The Live Green Rule.** #22C55E means the game is happening. It never becomes a success toast, a valid-input state, or a positive-delta indicator. Its meaning survives only if it is never spent elsewhere.

**The No Raw Values Rule.** Components never carry hex or rgba literals. Every color resolves through a `--gridone-color-*` token aliased into Tailwind. This rule is enforced in `docs/DESIGN_TOKENS.md` and holds regardless of what the visual world becomes.

## Typography

**Display Font:** Inter (with -apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, Roboto fallbacks)
**Body Font:** Inter — the same family
**Label/Mono Font:** none distinct

**Character:** One neutral grotesque doing every job, separated only by weight and size. It is legible and unopinionated; it contributes no voice of its own, which leaves the palette to carry the entire identity.

### Hierarchy
- **Display** (900, `text-4xl` → `text-5xl` / 2.25–3rem, tracking-tight): Hero and page-defining headlines. Pure white.
- **Headline** (700, `text-xl` → `text-2xl` / 1.25–1.5rem, tracking-tight): Section headings. Pure white.
- **Title** (700, 1.125rem): Sub-section headings, at 90% white.
- **Body** (400, 1rem, leading-relaxed / 1.625): Running text, rendered in a light gray rather than a token value.
- **Label** (700, 0.75rem, uppercase, tracking-widest / 0.1em): Buttons, axis labels, eyebrow text, and metadata. The most characterful role in the system.
- **Caption** (500, 0.75rem): Secondary metadata and helper text.

Board numerals are a special case: sized with viewport-relative `clamp()` (axis digits `clamp(0.85rem, 2vh, 1.5rem)`, team labels `clamp(0.65rem, 1.5vh, 1.2rem)`) so the grid stays readable as it scales rather than tracking the document type scale.

### Named Rules
**The Weight-Only Hierarchy Rule.** Every level of the current hierarchy is one family separated by weight and size alone. Documented as an observation: there is no second typographic voice anywhere in the system, which is why the type never reads as broadcast.

**The Clamp-the-Grid Rule.** Board typography scales to the viewport, not to the type scale. The grid must stay glanceable at arm's length on a phone mid-game; document type ramps do not serve that.

## Layout

A centered `max-w-7xl` content column with `px-4` → `px-6` gutters, beneath a fixed 64px header that offsets page content. Tailwind's default breakpoints apply, with `md` (768px) carrying nearly all responsive change — type steps up, board cells switch from percentage to auto height, and the desktop nav replaces its mobile form.

The board is the layout's anchor: a `max-w-[920px]`, forced `aspect-square` table with `table-fixed` columns — roughly 5–7% for the two axis-label columns and ~9% for each of the ten data columns. Axis headers are `sticky` at `top-0` and `top-8`/`top-10` with `z-40`, so the digits stay visible while the grid scrolls. The left team label is rotated vertically inside a `rowSpan={10}` header.

Spacing follows Tailwind's default 4px-based scale, extended with two custom steps (`spacing-18` = 4.5rem, `spacing-22` = 5.5rem) for larger section rhythm. Density is comfortable rather than tight — `gap-3`/`gap-4` between board controls, 16px internal panel padding.

## Elevation & Depth

The system is **translucency-led**. Depth comes primarily from stacked semi-transparent fills over a backdrop blur, not from a shadow scale or from tonal steps. `.glass-panel` combines a 60%-opacity charcoal fill, `backdrop-blur-xl`, a `border-white/10` hairline, and a generic large shadow. The header repeats the pattern at `bg-background/95` with `backdrop-blur-md`; board axis headers repeat it again at `#232327/95` with `backdrop-blur-sm`.

Shadows, where present, are mostly colored and atmospheric rather than structural — `shadow-cardinal/20` under the logo and primary button, `ring-gold/50` around the mark, and a `gold-glow` token (rgba(255,199,44,0.4)) that exists specifically to emit light from accent elements.

**This is the system's confirmed anti-reference.** The blur-and-tint approach is what the redesign is being undertaken to remove.

### Shadow Vocabulary
- **Brand ambient** (`box-shadow: 0 10px 15px -3px rgba(143,29,44,0.2)`): Under the primary button and logo mark. Tints the shadow with the brand color rather than describing a light source.
- **Accent glow** (`--gridone-color-brand-accent-glow`, rgba(255,199,44,0.4)): Emitted from gold elements to suggest illumination.
- **Panel lift** (`shadow-lg`): The undifferentiated default beneath glass panels and floating toolbars.

### Named Rules
**The Blur-Is-Not-Depth Rule.** Translucency plus backdrop blur is the incumbent depth device and is rejected going forward. Depth must be re-established through material, tonal separation, edge, or genuine light logic — not by letting the background show through.

## Shapes

Uniformly soft and rectangular. A three-step radius scale (12px / 16px / 24px) covers cards, panels, and containers; smaller controls fall back to Tailwind's 8px. The primary button is the single exception, fully rounded (`rounded-full`) into a pill.

Borders are almost always white at very low opacity — `border-white/10` for panels and inputs, `border-white/[0.08]` for board cell divisions, `border-white/5` for the header rule. There is no visible border color of its own anywhere in the system; edges are made of light leaking through.

The one hard-cornered surface is the board grid itself: cells are true rectangles with hairline dividers, clipped inside a 16px-radius container. That contrast — sharp grid inside soft chrome — is the most structurally interesting shape decision present.

### Named Rules
**The Grid Stays Square Rule.** Board cells are never rounded. The 10x10 grid is a ledger and reads as one; softening the cells would cost the scanability that the mid-game glance depends on.

## Components

### Buttons
- **Shape:** Fully rounded pill (`rounded-full`)
- **Primary** (`.btn-cardinal`): Cardinal fill, white bold text, 8px/24px padding, brand-tinted ambient shadow at 20% opacity.
- **Hover / Focus:** Scales to 1.05 on hover and 0.95 on active, via `transition-transform`. The `cardinal-hover` token (#7A1622) exists for color-shift hover but the primary button uses transform instead.
- **Secondary / Ghost:** Icon buttons use a 36px circle with a 6% white fill, `border-white/10`, and a `focus:ring-2 focus:ring-white/20` focus ring. Text buttons are uppercase, bold, `text-xs`, `tracking-wider`, in cardinal or 70% white.

### Cards / Containers
- **Corner Style:** 16px (`.glass-panel`), with 12px and 24px available
- **Background:** Glass charcoal (rgba(28,28,30,0.6)) over a 24px backdrop blur
- **Shadow Strategy:** Undifferentiated `shadow-lg`; see Elevation & Depth
- **Border:** `border-white/10` hairline
- **Internal Padding:** 16px typical

### Inputs / Fields
- **Style:** Charcoal surface fill, `border-white/10`, 8px radius, 12px/8px padding, `text-sm`. Some fields use `bg-black/20` or `bg-black/40` instead of the surface token.
- **Focus:** Border brightens to `border-white/30` (or `/40`) with `outline-none`. **Inconsistency worth noting:** at least one field focuses to `border-indigo-500` — an off-system color that belongs to neither the palette nor the token set.
- **Disabled:** 40% opacity.

### Navigation
- **Style:** Fixed 64px header, `bg-background/95` with `backdrop-blur-md`, `border-b border-white/5`.
- **Brand lock-up:** 32px rounded-lg mark with a cardinal-tinted shadow and a `ring-1 ring-gold/50`, scaling to 1.05 on group hover. Wordmark "GridOne" in bold `text-sm`, with "SQUARES" beneath at 10px, 50% white, `tracking-widest` uppercase.
- **Links:** `text-sm`, 70% white, brightening to full white; separated by a `h-4 w-px bg-white/10` divider.
- **Mobile:** Desktop nav is hidden below `md`.

### Board Grid (signature component)
The product's hero object. A 10x10 table inside a 16px-radius, `aspect-square`, `max-w-[920px]` container. Axis digit headers are sticky with backdrop blur and hover to `bg-white/[0.08]`. Row and column team labels sit in `rowSpan`/`colSpan` headers, the left one rotated vertically. Cell fills are white at 3–4% opacity with `border-white/[0.08]` hairline dividers. A quarter selector (Q1–Q4/OT) sits above the grid as a pill-shaped segmented control on a 90%-opacity surface, the active segment filled and the rest transparent.

### Paper Crumple Hero (signature component)
A scroll-scrubbed landing sequence (GSAP + Lenis) staged across four beats — hold, crumple (0.4), toss (0.7), winner (0.9). A paper board with `mix-blend-mode: multiply` creases displaces via SVG turbulence (frequency 0.012 → 0.018, displacement 34), then becomes a `clip-path` paper ball with layered cream-to-tan gradients that flies offscreen as the digital board builds itself. Labeled in three beats: "01 — The old paper way", "02 — Crumple the paper", "03 — We have a winner". Animated on GPU-friendly transform and opacity only.

## Do's and Don'ts

### Do:
- **Do** keep cardinal (#8F1D2C) and gold (#FFC72C) as the identity pair. They are inherited team-and-school colors and survive the redesign per **The Team Colors Rule**.
- **Do** reserve live green (#22C55E) exclusively for game-in-progress state.
- **Do** resolve every color through a `--gridone-color-*` token; never write a hex or rgba literal in a component.
- **Do** keep board cells square and hairline-divided, per **The Grid Stays Square Rule**.
- **Do** size board typography with viewport-relative `clamp()` so the grid stays glanceable on a phone mid-game.
- **Do** design the pre-game, stale, and failed live-scoring states as first-class views — they are normal operating conditions, not errors.

### Don't:
- **Don't** use glassmorphism: translucent panel fills over `backdrop-blur`, with white hairline borders, are the confirmed anti-reference. This covers `.glass-panel`, `surface-glass`, and the blurred header and axis treatments. Re-establish depth through material, tone, edge, or real light logic instead.
- **Don't** let the background show through a surface as the primary means of expressing elevation, per **The Blur-Is-Not-Depth Rule**.
- **Don't** spend live green on success, validation, or positive-delta meanings.
- **Don't** introduce off-system colors. The `border-indigo-500` focus state in the codebase is a defect, not a precedent.
- **Don't** round the board cells.
- **Don't** fabricate social proof anywhere in the interface. The product is pre-launch with no customers, testimonials, or usage figures (see PRODUCT.md).
