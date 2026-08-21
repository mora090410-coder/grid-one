# Organizer B1 — Compact phase rail + artifact workspace

Design stance: keep the five-phase Game-Day Horizon visible as a compact rail while the current phase artifact owns the center of the screen.

Key choices:
- Sticky board identity/save state adjacent to the primary artifact.
- Compact rail shows Fill, Reconcile, Draw, Preview, Go Live without exposing every phase control.
- Narrow context region carries counts and advisory notes only.
- Synthetic data is explicitly labeled; no APIs, no build step, no production imports.

Strongest use case: desktop organizer continuity where the user needs constant confidence about lifecycle position.

Tradeoffs:
- The rail consumes phone space, so it becomes a horizontal native-scroll strip.
- Reconcile advisory issues are text-labeled as advisory to avoid implying a payment hard gate.

Rubric score: **33/40 after rendered review and responsive containment fix. Does not pass the 34/40 bar.**

Rendered viewport evidence to collect manually:
- Desktop: rail/context/artifact composition at representative width.
- Phone: 390×844 phase rail scroll, sticky header, board viewport native horizontal scroll.
- Reduced motion: discrete state changes; no motion dependency.

Keep/discard decision: **Discard the permanent phase rail. It compresses the artifact and taxes phone/desktop space.**
