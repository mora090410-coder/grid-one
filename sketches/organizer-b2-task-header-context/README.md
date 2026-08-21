# Organizer B2 — Sticky task header + contextual progress disclosure

Design stance: make the current task header and full-width artifact dominant, with progress and prior phases behind explicit disclosure.

Key choices:
- Sticky current-task header contains phase, save state, and primary/secondary actions.
- Artifact spans the full width; the board is not placed beneath settings or scoring panels.
- Phase progress is available through disclosure, especially for phone.
- Synthetic data is explicitly labeled; no APIs, no build step, no production imports.

Strongest use case: phone-first assignment and review where the user should see one task, one artifact, and one action.

Tradeoffs:
- Complete journey context is weaker until the disclosure is opened.
- The sticky header carries more responsibility and can feel dense on narrow screens.

Rubric score: **39/40 after rendered review and interaction verification. Accepted composition winner.**

Rendered viewport evidence to collect manually:
- Desktop: full-width artifact with collapsed/expanded progress disclosure.
- Phone: 390×844 sticky task header, disclosure, native board scrolling.
- Reduced motion: no animation required for comprehension.

Keep/discard decision: **Keep the sticky current-task header and contextual progress disclosure. Remove fixture-state controls from production.**
