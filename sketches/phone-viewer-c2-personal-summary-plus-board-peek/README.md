# C2 — Personal summary plus board peek

Design stance: selected identity gets an immediate cropped board peek beside/under the Your Squares summary, then the full exact grid follows as the single inspectable artifact.

Key choices:
- Score authority and Find My Squares remain above personalization.
- After selection, a cropped board reference makes spatial connection obvious before the full grid.
- The peek is explicitly labeled as a cropped reference and has no independent controls.
- Full exact 10x10 grid keeps sticky axes, pan/zoom, Find, and Center selected.
- Final fixture removes future-looking scenarios and replaces them with durable milestones.

Strongest use case: a selected viewer who wants immediate confidence that their squares exist on the exact board.

Tradeoffs: stronger spatial continuity than C1, but higher risk of decorative duplication if the peek is mistaken for a second board surface.

Rubric score: **30/40 after rendered review and fixes. Does not pass due to cognitive-load and duplicated-artifact risk.**

Rendered viewport evidence:
- 390x844 unpersonalized: no `me` language; score authority/freshness and Find my squares visible before rules/payouts.
- 390x844 personalized: selected summary and cropped board peek visible with View/center selected.
- Desktop: score/find column and personal/board column create a materially different stance from C1.

Keep/discard decision: **Discard the cropped board peek. Borrow only the explicit center-selected behavior for the single exact grid.**
