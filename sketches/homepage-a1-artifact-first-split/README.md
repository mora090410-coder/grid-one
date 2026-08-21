# GridOne Homepage A1 — Artifact-first split

Design stance: copy/actions are paired immediately with a concrete product artifact. The artifact is not a floating SaaS mockup; it is a labeled synthetic board/viewer proof surface using accepted B2 organizer task-header and C1 viewer personal-summary decisions.

Key choices:
- First viewport states the football-squares fundraiser product definition, build/share/game-day outcome, Create your free board, See a live board, first published board free, and the money boundary.
- Primary proof starts as organizer B2 task header plus board fragment; viewer proof can be switched in place.
- Uses only local HTML/CSS/JS and `../theme.css` read-only.
- CTA clicks update a local live region only. No account, API, checkout, storage write, deployment, or external system touch.
- Optional story is below fold in a native disclosure and cannot gate product access.

Strongest use case:
- Fast five-second comprehension for organizers who need practical proof before brand story.

Tradeoffs:
- Safer and more legible than a board-field composition.
- Less distinctive than A2 because the page still has a conventional two-part entrance.

Rubric self-score:
- Product specificity: 4
- Primary-task clarity: 4
- Information architecture: 4
- Hierarchy/noise floor: 4
- Typography/resilience: 3
- Semantic restraint: 4
- Interaction continuity/recovery: 4
- Cognitive load: 4
- Phone/desktop adaptation: 4
- Accessibility: 3
- Total: **38/40 after rendered review and first-viewport verification. Accepted final homepage composition.**

Rendered viewport evidence:
- `evidence-phone.png` and `evidence-desktop.png` preserve the rendered variants.
- `evidence.json` records phone 390×664 and desktop 1280×720 bounding boxes, document width, proof-switch/story/CTA interactions, reduced-motion behavior, and no-JavaScript visibility.
- The verified 390×664 phone viewport is stricter vertically than the intended 390×844 target; product definition, outcome, both CTAs, free-first-board truth, no-money boundary, and artifact proof all begin within that viewport.

Keep/discard decision:
- **Keep A1.** Promote the artifact-first composition decisions only; do not copy prototype code into production.
