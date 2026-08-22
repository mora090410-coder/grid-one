# GridOne Agent Instructions

GridOne is a production football-squares organizer and game-day viewer. Product truth, public trust, accessibility, and rollback outrank fashionable refactors.

## Read first

1. `PRODUCT.md` — canonical product, people, terminology, commercial model, permissions, and non-goals.
2. `DESIGN.md` — formal GridOne visual overlay.
3. `docs/wayfinder-gridone-production-quality.md` — resolved product-quality decisions.
4. `docs/plans/2026-08-20-gridone-product-quality-implementation.md` — approved slice sequence and stop conditions.
5. Read the relevant contract before changing a surface:
   - `docs/organizer-journey-contract.md`
   - `docs/phone-viewer-hierarchy.md`
   - `docs/landing-product-boundary.md`
   - `docs/accessibility-contract.md`
   - `docs/design-system-governance.md`
   - `docs/instrumentation-rollout-feedback.md`

Use `docs/REFACTOR_LOG.md` as the append-only execution record for every refactor slice.

## Product contracts that may not drift

- Free: 1 published board per account per season.
- Game Day: $9.99 once for up to 5 published boards in the 2026 season.
- Organization: $79 per season for up to 50 published boards plus documented organization features.
- GridOne never collects square money, holds funds, adjudicates off-platform payment, or pays winners.
- One signed-in organizer owns and edits each board at launch; viewers need no account and cannot edit.
- Manual score authority remains canonical until deliberately returned to automatic; stale automatic data never overwrites manual or newer state.
- Launch uses one fixed 0–9 top/side axis set. Do not flatten legacy dynamic boards without an approved preservation plan.
- OPEN outcomes stay OPEN, do not roll over, and send no winner email.
- Public label and milestone corrections are audited and viewer-visible; private payment, seller, and contact metadata stays private.

## Architecture and feature seams

- Do not move the whole app into `src/` before the feature seams in the implementation plan exist and pass pilot gates.
- New v2 work belongs behind independently reversible `viewer_v2`, `organizer_v2`, or `homepage_v2` flags.
- Prefer feature-local components, hooks, services, and types. Keep global primitives only when at least two real feature consumers share behavior.
- Browser and server clients are separate security boundaries. Never move service-role, Stripe-secret, scoring-provider, email, cron, or notification secrets into browser code.
- Do not add behavior to `components/AdminPanel.tsx` or `components/GameDayHorizon.tsx`; extract tested seams according to the plan.

## Editing discipline

- Use strict RED → GREEN → REFACTOR for behavior changes. Record commands and results in `docs/REFACTOR_LOG.md`.
- Touch only the active slice. No unrelated renames, formatting sweeps, dependency upgrades, schema changes, or cleanup.
- Treat existing untracked files as protected user work. Never delete, move, overwrite, format, stage, or commit them without explicit approval.
- Do not copy disposable `sketches/` HTML or JavaScript into production. Promote decisions, not prototype code.
- Do not commit, push, deploy, alter production data or configuration, install unapproved packages, enable flags for real users, or contact users without the applicable Anthony approval.

## Verification

Run the smallest focused test first, then the relevant full gates:

```bash
npm run test:unit
npm run test:integration
npm run build
npx playwright test
npm run design:audit
npm run design:lint
```

Integration tests may require Docker or PostgreSQL. If unavailable, record the blocker and run every non-container gate. A passing build is necessary and insufficient; inspect representative rendered phone and desktop states plus accessibility behavior for UI slices.

## Stop and ask

Stop when work discovers a pricing, permission, or public/private ambiguity; production schema change; destructive migration pressure; legacy dynamic-axis board; score-authority risk; new paid service; production credential need; inaccessible product behavior; protected-file collision; deployment; or real-user rollout/contact requirement.
