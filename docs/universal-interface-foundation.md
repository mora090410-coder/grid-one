# Universal Interface Foundation

**Status:** Product-agnostic interface authority
**Date:** 2026-08-20
**Applies to:** GridOne product surfaces; reusable beyond GridOne
**Project overlay:** root `DESIGN.md`

## Purpose

This foundation defines how a production interface behaves and is judged. It contains no GridOne colors, feature names, routes, or business rules. The project overlay defines product identity and deliberate exceptions.

If rules conflict, preserve product correctness and accessibility first, then apply the stricter craft rule.

## Hierarchy

- The first viewport answers the user’s primary question or enables the primary task.
- Each surface has one dominant artifact and one primary action.
- Use whitespace, alignment, separators, and tonal grouping before containers.
- Cards group coherent objects or decisions; they are not universal page scaffolding.
- Nested cards and equal-weight feature grids are rejected by default.
- Progressive disclosure hides secondary complexity without hiding state or recovery.

## Typography

- Essential interface text is at least 14 CSS pixels; ordinary body text targets 16 pixels or larger.
- Prose measure stays approximately 45–75 characters.
- Sentence case is the default. Uppercase is reserved for short operational labels.
- Data, scores, coordinates, dates, counts, and money use tabular numerals.
- Hierarchy uses meaningful differences in size, weight, spacing, and role—not a pile of near-identical styles.
- Long names, localization expansion, fallback fonts, 200% zoom, and text scaling must remain usable.

## Color and semantics

- Neutral surfaces establish calm; accents carry function.
- One dominant semantic accent per region is normally sufficient.
- Success, warning, error, live, selected, and destructive states require text/icon/state semantics in addition to color.
- Red is reserved for actual destructive/error meaning unless a project overlay explicitly assigns it a brand role without compromising semantics.
- Gradients, glow clouds, and decorative multicolor are prohibited without documented product meaning.
- Rendered contrast meets WCAG AA at the actual text size and state.

## Shape and depth

- Controls, normal surfaces, overlays, and precision instruments use distinct shape roles.
- Pills are limited to statuses, filters, tags, and segmented controls.
- Base content is mostly flat.
- Elevation is reserved for overlays, sticky controls, and genuinely separate task layers.
- Choose one primary edge treatment per surface: border, tonal separation, or restrained shadow.
- Translucency is functional for contextual overlays only; never stack translucent content panels.

## Controls and state

- Touch/click targets are at least 44×44 CSS pixels where practical.
- Every interactive control has hover, focus-visible, pressed, disabled, loading, success, warning, and error behavior as applicable.
- Focus is visible on every background and restored after dialogs/overlays close.
- Controls acknowledge input immediately.
- Destructive actions explain consequence and recovery before commitment.
- Loading never replaces known useful content unnecessarily; stale states preserve valid prior data with explicit labeling.

## Motion

- Motion explains change, confirms input, or preserves spatial continuity.
- Immediate feedback: approximately 100–150ms.
- Routine state change: approximately 150–300ms.
- Overlay/layout transition: approximately 300–500ms.
- Motion is interruptible and begins from the currently rendered state.
- Bounce, elastic motion, decorative idle animation, universal scroll choreography, and motion-dependent comprehension are prohibited.
- Reduced motion preserves every fact and replaces large movement with discrete cuts or short fades.

## Responsive behavior

- Mobile is a deliberate composition, not a compressed desktop layout.
- Design and test at 320px width, representative 390×844 phone, desktop, and 200% zoom.
- Horizontal overflow is contained inside intentional instruments such as boards or tables—not the page.
- Touch, pointer, and keyboard behavior remain equivalent.
- Hover-only meaning is prohibited.

## Accessibility

- Semantic landmarks and heading order reflect visual hierarchy.
- Inputs retain visible labels and associated error text.
- Dialogs have name/description, initial focus, containment, Escape, and focus return.
- State changes use restrained live-region announcements.
- Color, position, motion, and iconography are never the only carriers of meaning.
- Forced colors, reduced transparency, reduced motion, keyboard-only use, and screen-reader naming are verified.

## Performance

- Product actions and critical content render before optional brand media.
- Animation, analytics, and optional integrations cannot block the primary task.
- Avoid unbounded blur, shadow, image, and `will-change` work.
- Prevent avoidable layout shift.
- Performance budgets are measured against actual routes and devices, not asserted from taste.

## Anti-slop gate

Reject without explicit product justification:

- generic centered SaaS heroes with vague copy and floating mockups;
- equal icon/heading/description cards;
- nested rounded rectangles or pills as the dominant grammar;
- purple/cyan gradients, radial glow blobs, gradient text, decorative glass, grid wallpaper, or halo shadows;
- fake metrics, testimonials, customers, awards, command-line chrome, or decorative charts;
- generic chat UI where a domain object should own the workflow;
- tiny essential text, hidden focus, inaccessible targets, or motion added because it is easy.

## Verification

Every representative surface receives two independent passes:

1. **Design direction:** product specificity, task clarity, hierarchy, typography, material, interaction continuity, cognitive load, emotional fit, and accessibility.
2. **Implementation evidence:** rendered contrast, semantics, keyboard, touch geometry, narrow width, zoom, long content, loading/error/offline/success, token usage, reduced motion, and performance.

A passing static audit does not prove rendered quality. A beautiful screenshot does not prove interaction quality.
