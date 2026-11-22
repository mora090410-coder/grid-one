# Test Strategy

## Objectives

- Protect board integrity, winner resolution, score authority, publication, and payment activation.
- Keep the default suite deterministic, offline, and fast.
- Prefer a pure model test to a rendered one, and a rendered one to a browser one — but never skip the browser layer for the surfaces a person actually operates.

## Layers

### 1. Unit — Vitest `unit` project

```bash
npx vitest run --project unit
```

97 files under `tests/`, jsdom environment, `tests/setup.ts`, no network, no containers. This is the layer that must stay green on every commit. It covers four kinds of thing:

- **Pure models.** `organizerLifecycle`, `draftSaveModel`, `manualScoringModel`, `scenarioModel`, `viewerScoreModel`, `viewerIdentityModel`, `milestoneViewModel`, `boardGridModel`, `winnerLogic`, `retry`, `playerNameMatching`, `numberDraw`.
- **Rendered components** through Testing Library with semantic queries only — `tests/viewer/`, `tests/organizer/`, `tests/homepage/`, `tests/site/`, `viewerShell`, `viewerBoardGrid`, `manualScoringPanel`, `scheduledGamePicker`, `findSquaresModal`, `dashboard`, `createContest`.
- **Pages Functions and workers** with a mocked `context.env` and request — `notificationEndpoints`, `openSquaresEndpoint`, `scoreEndpointActivation`, `scorePublicCaching`, `scoreValidation`, `espnNfl`, `scoreRefreshScheduler`, `notificationRetryWorker`.
- **Source-scanning contracts** that read files rather than run them: `tests/design/` (tokens, cascade guards, contrast), `staticSeo`, `pricingCopyConsistency`, `productionCopy`, `pollingDisclosure`, `instrumentationSchema`.

### 2. Integration — Vitest `integration` project

```bash
npm run test:integration
```

`tests/**/*.integration.test.ts`. Each file starts a disposable Postgres container and runs real SQL against the migrations in `supabase/migrations/`, which is why the project runs one file at a time. It proves concurrency, free sharing and publishing, milestone confirmation, notification rate limits and retry, published-square rename, score test mode, and the axis rename migration.

Requires Docker. If Docker is unavailable, record the blocker and run every other gate — do not claim this layer passed.

### 3. Browser — Playwright

```bash
npx playwright test --project=chromium
```

`playwright-tests/` against the Vite dev server, with Supabase and API routes mocked in the page. `chromium` is the release project (66 tests); `webkit`, `phone-chromium`, and `phone-webkit` exist for targeted checks.

- `accessibility-contract.spec.ts` is the executable half of `docs/accessibility-contract.md`: focus order and visibility, 44×44 target geometry, field-linked auth errors, the organizer selection mode and range-assign bar, Reconcile blockers vs advisories, the draw and publish confirmations, save conflict, the viewer's first viewport and score-authority states, the find-my-squares dialog focus loop, one keyboard tab stop into the board grid, 320/390 overflow, reduced motion, and forced colors.
- `homepage.spec.ts`, `viewer.spec.ts`, `organizer.spec.ts`, `site.spec.ts`, `scheduled-game-picker.spec.ts`, `user-workflows.spec.ts`, `smoke.spec.ts` cover the routes end to end.
- `axe.spec.ts` is the automated half of the accessibility layer, complementing the hand-written contract above. It drives `@axe-core/playwright` over ten redesigned surfaces — `/`, `/demo`, `/articles`, `/articles/how-football-squares-work`, `/login`, `/privacy`, an unknown path, and the authenticated `/dashboard`, `/create`, and `/boards/:id` draft workspace (organizer session and REST/API mocks come from `playwright-tests/helpers/organizerMocks.ts`) — analysing each with the `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa` rule tags. Because several sections reveal on scroll, each test walks the page to the bottom and back before analysing; otherwise axe would sweep a mostly empty document. Any `critical` or `serious` violation fails the test, and the full violations list is attached to the report as `axe-violations.json` while `moderate` and `minor` counts are recorded as a test annotation. No rule is disabled: an axe finding is treated as a real defect to fix in application code, not a rule to silence. Run it alone with `npx playwright test playwright-tests/axe.spec.ts --project=chromium`, or as part of the release command below.

### 4. Design lint

```bash
npm run design:lint
```

`designmd lint DESIGN.md`. `DESIGN.md` keeps its frontmatter and stays normative; the lint is a gate, not a suggestion.

## Release command

Run all of it before a merge to `main`:

```bash
npx tsc --noEmit
npx vitest run --project unit
npm run build
npm run design:lint
npx playwright test --project=chromium
```

A passing build is necessary and insufficient. For any UI change, also inspect the rendered phone and desktop states.

## Coverage focus

`utils/winnerLogic.ts`, `utils/retry.ts`, `hooks/useLiveScoring.ts`, `src/features/organizer/lifecycle/`, `src/features/viewer/**/*Model.ts`, `functions/api/scores/*`, `functions/api/pools*`, `functions/api/notifications/*`.

## Non-goals

- Snapshot tests over cosmetic markup.
- Component tests that query by class name or test id where a role or label exists.
- Visual-capture specs kept alive by an environment flag.

## Adding a feature

Every new model, service, or endpoint ships with tests for the success path, the expected failure path, and — where a network call is involved — the transient-failure retry behavior. Every new interactive surface ships with semantic component tests, and joins the accessibility spec if a person operates it.
