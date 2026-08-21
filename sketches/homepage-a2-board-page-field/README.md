# GridOne Homepage A2 — Board-as-page field

Design stance: the board/grid structurally organizes the viewport. Product copy and proof occupy deliberate board bands, while visible cells, axes, OPEN/taken states, and current-winner cells make the field product-specific instead of decorative wallpaper.

Key choices:
- First viewport states the football-squares fundraiser product definition, build/share/game-day outcome, Create your free board, See a live board, first published board free, and the no-money-handling boundary.
- Accepted B2 organizer task-header proof and C1 viewer personal-summary proof switch inside the board field.
- Board structure remains legible on 390x844 by reducing visible columns rather than forcing page-level horizontal overflow.
- CTA clicks update a local live region only. No account, API, checkout, storage write, deployment, or external system touch.
- Optional story is a below-fold native disclosure; product access remains immediate and native scrolling remains intact.

Strongest use case:
- Product specificity. The first view is unmistakably about a football-squares board, not generic SaaS workflow software.

Tradeoffs:
- More distinctive but riskier. If spacing or long copy degrades, the board field can become decorative or crowded.
- Mobile needs stricter content discipline than A1.

Rubric self-score:
- Product specificity: 4
- Primary-task clarity: 3
- Information architecture: 3
- Hierarchy/noise floor: 3
- Typography/resilience: 3
- Semantic restraint: 2
- Interaction continuity/recovery: 4
- Cognitive load: 2
- Phone/desktop adaptation: 4
- Accessibility: 3
- Total: **31/40 after rendered review. Does not pass because semantic restraint and cognitive load fall below 3.**

Rendered viewport evidence:
- `evidence-phone.png` and `evidence-desktop.png` preserve the rendered variants.
- `evidence.json` records phone 390×664 and desktop 1280×720 bounding boxes, document width, proof-switch/story/CTA interactions, reduced-motion behavior, and no-JavaScript visibility.
- The verified 390×664 phone viewport is stricter vertically than the intended 390×844 target; required product truth/actions/boundary/proof begin within it despite A2’s rejected density.

Keep/discard decision:
- **Discard A2.** The page-scale board field becomes decorative, dense, and too close to sports/betting visual language.
