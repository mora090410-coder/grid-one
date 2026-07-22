# Premium paper-crumple hero

- [x] Move Lenis and GSAP ticker synchronization into one app-level runtime.
- [x] Replace the hero CSS-variable scrub with a scoped GSAP timeline.
- [x] Add SVG displacement crumpling, narrow/reduced-motion fallbacks, and paper-ball impact.
- [x] Preserve deterministic scroll hooks and add normalized hero seeking.
- [x] Add Playwright coverage for the animation phases and lifecycle.
- [x] Run build, unit, browser, and visual verification.

## Review

- App-level Lenis owns the single smooth-scroll instance and GSAP ticker bridge; reduced motion stays native.
- The hero uses a scoped, reversible GSAP timeline with desktop SVG displacement and a narrow transform-only fallback.
- Desktop, reverse-scrub, reduced-motion, narrow resize/pin lifecycle, overflow, and visual states are covered in Playwright.
- Verified with `npm run build`, `npm test -- --run`, and `npx playwright test`.
