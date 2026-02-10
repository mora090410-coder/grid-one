# Test Strategy

## Objectives
- Protect critical business behavior: board integrity, winner logic, contest lifecycle, and payment activation.
- Keep tests deterministic and fast.
- Prefer pure unit tests first, then targeted integration tests.

## Test Pyramid
1. Unit tests (majority)
- Target: `utils/`, deterministic hook helpers, validators.
- Must not require live network.
- Examples:
  - Winner calculation behavior by quarter/final.
  - Retry/backoff behavior for transient failures.

2. Integration tests (selective)
- Target: hook/service boundaries with mocked dependencies.
- Validate data transformation and error handling.
- Examples:
  - `useLiveScoring` mapping ESPN payload -> app state.
  - Stripe service parsing + redirect behavior.

3. Route/API contract tests
- Target: Cloudflare function handlers with mocked `context.env` and request payloads.
- Validate status codes and response shape.
- Examples:
  - Missing env var returns actionable 500.
  - Unauthorized update path returns 401.

## Coverage Focus Areas
- `utils/winnerLogic.ts`
- `utils/retry.ts`
- `hooks/useLiveScoring.ts`
- `functions/api/stripe/*.ts`
- `functions/api/pools*.ts`

## Non-Goals
- Snapshot-heavy component tests for cosmetic markup.
- End-to-end browser automation until critical unit/integration coverage is stable.

## CI Gates
- `npm run build` must pass.
- `npm test -- --run` must pass.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` must pass.

## Adding New Features
- Every new utility/service must include tests for:
  - Success path.
  - Expected failure path.
  - Transient network failure retry behavior where applicable.
