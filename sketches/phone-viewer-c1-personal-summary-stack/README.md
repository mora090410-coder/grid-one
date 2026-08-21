# C1 — Personal summary stack

Design stance: linear phone-first stack. Score authority, Find/Your Squares, personal current status, matching scenarios, compact email opt-in, and exact grid appear in one reading path.

Key choices:
- First viewport prioritizes board identity, score authority/freshness, `Score updates about every minute`, and `Find my squares`.
- Selection structurally replaces generic Find with a Your Squares summary.
- Scenarios are personalized only after identity selection and carry the arithmetic-not-odds disclosure.
- Exact 10x10 grid remains the public artifact with sticky axes, pan/zoom, Find, and Center selected.
- Final fixture removes future-score scenarios and presents a stable record with OPEN/correction language.

Strongest use case: fastest linear phone comprehension.

Tradeoffs: selected viewers may still scroll before reaching the board. Least duplication risk because there is only one board surface.

Rubric score: **37/40 after rendered review and fixes. Accepted composition winner.**

Rendered viewport evidence:
- 390x844 unpersonalized: title/matchup, score authority/freshness, score-update language, and Find my squares appear before rules/payouts.
- 390x844 personalized: selected name/count, coordinate summary, View on board, current status, and scenario state appear before grid.
- Desktop: same linear stance, board remains a native-scroll instrument.

Keep/discard decision: **Keep the linear personal-summary composition. Promote decisions only; do not copy prototype code into production.**
