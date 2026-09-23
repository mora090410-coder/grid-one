# GridOne Agent Instructions

GridOne is a production football-squares organizer and game-day viewer. Optimize for organizer success, viewer understanding and trustworthy game-day results. Existing work is context, not a ceiling.

## Creative exploration and production acceptance

Use full cross-disciplinary judgment. Existing copy, layout, palette, tokens, component boundaries and interaction mechanisms describe current choices, not immutable product truths. When the task calls for exploration, critique or redesign, challenge them and recommend a stronger solution when it improves the objective. Do not manufacture a redesign when the existing solution is better.

For reversible exploration, make a concrete first pass with labeled assumptions. Ask when uncertainty materially changes the outcome, truthful promise, authority or irreversible risk; an interview, fixed concept count and full release suite are not prerequisites for a proposal.

Exploration is not permission to ship. Preserve truthful claims, accessibility, privacy, credential isolation, data integrity and protected work. Adopt a selected alternative only within the authorized scope, with coordinated contract/test updates, a reversible implementation and relevant acceptance evidence. Current production conventions remain the baseline for unchanged surfaces.

## Relevant context

Read the material that governs the current uncertainty or affected surface; do not turn this index into a ritual for every task.

1. `PRODUCT.md` — current product facts, people, commercial commitments, permissions, and scope.
2. `DESIGN.md` — maintained Broadcast Glass production baseline and rationale. Alternatives may be proposed and intentionally adopted; `npm run design:lint` validates the maintained spec.
3. `docs/ARCHITECTURE.md` — routes, feature directories, API surface, workers, security boundaries.
4. `docs/TEST_STRATEGY.md` — what each test layer owns and the release command.
5. Read the relevant contract before changing a surface:
   - `docs/organizer-journey-contract.md`
   - `docs/phone-viewer-hierarchy.md`
   - `docs/accessibility-contract.md`
   - `docs/DESIGN_TOKENS.md`

`docs/REFACTOR_LOG.md` is the append-only execution record. Append within the authorized write scope; do not rewrite existing entries. If it is protected for a task, keep the report in that task's approved output location instead.

## Product contracts that may not drift

- Free: 1 published board per account per season.
- Game Day: $9.99 once for up to 5 published boards in the 2026 season.
- Organization: $79 per season for up to 50 published boards plus the documented organization features.
- The ladder is written once, in `src/features/homepage/pricing.ts`. `tests/pricingCopyConsistency.test.ts` enforces it across the customer-facing corpus.
- GridOne never collects square money, holds funds, adjudicates off-platform payment, or pays winners.
- One signed-in organizer owns each board; public viewers cannot edit. Optional private family links may edit scoped names/availability before finalization, with database-enforced revision, revocation, and scope checks.
- Manual score authority is canonical until deliberately returned to automatic; stale automatic data never overwrites manual or newer state.
- The released creation flow uses one fixed 0–9 top/side axis set per board. Preserve valid legacy quarter-specific data; never flatten it or silently substitute another period's numbers. An approved new mode must coordinate persistence, validation, publication, scoring and viewer behavior before release.
- OPEN outcomes stay OPEN, do not roll over, and send no winner email.
- Public label and milestone corrections are audited and viewer-visible; private payment, seller, and contact metadata stays private.

## Architecture and feature seams

- Current architecture: `src/design/` owns tokens and primitives; `src/features/{homepage,viewer,organizer,site,instrumentation}` own the surfaces; `pages/` orchestrates routes; `hooks/`, `services/`, and `utils/` are shared. Prefer coherent integration; these boundaries may be improved within an approved architectural change.
- Prefer feature-local components, hooks, models, and services. Promote something into `src/design/primitives/` only when two real features share the behavior.
- Business rules belong in pure modules (`*Model.ts`, `lifecycle/`, `utils/`) that test without a browser. Components render; they do not decide.
- Production styling uses the `--g-*` tokens and Tailwind aliases in `src/index.css`; retain that coherent baseline for unchanged surfaces. Proposals may explore different materials, type, color or geometry. Integrate an adopted direction through coordinated tokens rather than accidental one-off values or a parallel `--gridone-*` system.
- Browser and server are separate security boundaries. Never move service-role, Stripe-secret, scoring-provider, Gemini, email, cron, or notification secrets into browser code.
- There are no feature flags in this app. The `FeatureVariant` union in `src/features/instrumentation/eventSchema.ts` keeps its historical variant literals for analytics continuity only — do not rename them, and do not read them as evidence that a flag still exists.

## Editing discipline

- For behavior changes, reproduce the relevant failure or missing behavior, implement it and verify the result with appropriate tests. Do not invent a behavioral RED for a documentation-only edit or require production scaffolding for an inert concept. Record actual commands and outcomes within the authorized write scope.
- Implement only the authorized scope. Recommend broader improvements when warranted, but do not silently add unrelated renames, formatting sweeps, dependency upgrades, schema changes or cleanup.
- Treat existing untracked files as protected user work. Never delete, move, overwrite, format, stage, or commit them without explicit approval — this includes everything under `docs/marketing/`.
- Do not commit, push, deploy, alter production data or configuration, install unapproved packages, or contact users without the applicable Anthony approval.

## Verification

For production code releases, run the smallest focused test first, then the gates. Documentation and proposal work uses checks appropriate to what actually changed; it must not claim unrun release gates passed:

```bash
npx tsc --noEmit
npm run test:unit
npm run build
npm run design:lint
npx playwright test --project=chromium
```

`npm run test:integration` starts disposable Postgres containers. If Docker is unavailable, record the blocker and run every non-container gate — do not claim that layer passed.

A passing build is necessary and insufficient. For a UI slice, inspect the rendered phone and desktop states and the accessibility behavior before calling it done.

## Stop and ask

Stop when work discovers a pricing, permission, or public/private ambiguity; a production schema change; destructive migration pressure; a legacy dynamic-axis board; a score-authority risk; a new paid service; a production credential need; inaccessible product behavior; a protected-file collision; a deployment; or a real-user rollout or contact requirement.
