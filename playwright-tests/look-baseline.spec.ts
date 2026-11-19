import { expect, test, type Page } from '@playwright/test';
import {
  boardId, ownerId, scheduledGame,
  installOrganizerSession, installOrganizerSupport, installOrganizerContests,
} from './helpers/organizerMocks';

const title = 'Baseline fundraiser';
const code = 'LOOK2026';
const sellerCode = '0123456789abcdef';
const clock = new Date('2026-09-13T22:00:00.000Z');
type Phase = 'draft' | 'shared' | 'published' | 'final';

async function installBoard(page: Page, phase: Phase, organizer: boolean) {
  if (organizer) {
    await installOrganizerSession(page);
    await installOrganizerSupport(page);
  }
  const published = phase === 'published' || phase === 'final';
  const digits = published ? Array.from({ length: 10 }, (_, i) => i) : Array(10).fill(null);
  const final = phase === 'final';
  const history = published ? [
    { milestone: 'Q1', participantName: 'Avery', topScore: 3, sideScore: 7, topDigit: 3, sideDigit: 7, resolvedAt: '2026-09-13T18:00:00Z' },
    { milestone: 'Q2', participantName: null, openSquare: true, topScore: 10, sideScore: 14, topDigit: 0, sideDigit: 4, resolvedAt: '2026-09-13T19:00:00Z' },
    { milestone: 'Q3', participantName: null, openSquare: true, topScore: 13, sideScore: 14, topDigit: 3, sideDigit: 4, resolvedAt: '2026-09-13T20:00:00Z' },
    ...(final ? [{ milestone: 'FINAL', participantName: 'Dana', topScore: 20, sideScore: 21, topDigit: 0, sideDigit: 1, resolvedAt: clock.toISOString() }] : []),
  ] : [];
  const score = published ? {
    leftScore: 21, topScore: 20, period: 4, clock: final ? '0:00' : '2:00',
    state: final ? 'post' : 'in', detail: final ? 'Final' : 'Fourth quarter',
    isOvertime: false, isManual: true, sourceName: 'Organizer',
    freshness: 'fresh', retrievedAt: clock.toISOString(),
    quarterScores: { Q1: { left: 7, top: 3 }, Q2: { left: 7, top: 7 }, Q3: { left: 0, top: 3 }, Q4: { left: 7, top: 7 }, OT: { left: 0, top: 0 } },
  } : null;
  const row = {
    id: boardId, owner_id: organizer ? ownerId : undefined, share_code: code, title, revision: 1,
    meta: 'Synthetic test board', gameExternalId: scheduledGame.id, kickoffAt: scheduledGame.kickoffAt,
    dates: '2026-09-13', leftAbbr: 'DAL', leftName: 'Dallas Cowboys',
    topAbbr: 'WAS', topName: 'Washington Commanders',
    board: {
      squares: Array.from({ length: 100 }, (_, i) => i === 73 ? ['Avery'] : i === 10 ? ['Dana'] : []),
      leftAxis: digits, topAxis: digits, allocationLabels: Array(100).fill(null),
      isDynamic: false, allowOpenSquares: true,
    },
    is_activated: phase !== 'draft', is_shared: phase !== 'draft', locked: phase === 'draft',
    shared_at: phase !== 'draft' ? '2026-09-10T17:00:00Z' : null,
    published_at: published ? '2026-09-11T17:00:00Z' : null,
    updated_at: '2026-09-11T17:00:00Z', winner_history: history,
    pending_milestones: [], notification_delivery_issues: [], payoutDescriptions: {}, score,
  };
  const ref = organizer ? boardId : code;
  await page.route(`**/api/pools/${ref}`, route => route.fulfill({ json: row }));
  await page.route(`**/api/pools/${ref}/score`, route =>
    route.fulfill({ json: { score, winnerHistory: history, pendingMilestones: [] } }));
}

const viewportSizes = [{ width: 390, height: 844 }, { width: 1280, height: 800 }];
test.use({ locale: 'en-US', timezoneId: 'America/Chicago', serviceWorkers: 'block' });
test.beforeEach(async ({ page, baseURL }) => {
  // Freeze Date while letting normal rendering and layout settle. No production requests.
  await page.clock.setFixedTime(clock);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === new URL(baseURL!).origin ? route.continue() : route.abort();
  });
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/nfl/games?**', route => route.fulfill({ json: { games: [{ ...scheduledGame, kickoffAt: '2026-09-20T17:00:00.000Z' }] } }));
});

for (const viewport of viewportSizes) {
  const size = `${viewport.width}x${viewport.height}`;
  test.describe(size, () => {
    test.use({ viewport });
    async function capture(page: Page, name: string) {
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await expect(page).toHaveScreenshot(`${name}-${size}.png`, {
        animations: 'disabled', caret: 'hide', scale: 'css',
        threshold: 0, maxDiffPixels: 0,
      });
    }
    for (const [name, path, heading] of [
      ['homepage', '/', 'Your team. One board. Less chasing.'],
      ['create-logged-out', '/create', 'Start with your team.'],
      ['login', '/login', 'Welcome back'],
      ['articles', '/articles', /.+/],
      ['not-found', '/missing-c0-baseline', 'This link does not point to a page.'],
    ] as const) {
      test(name, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        if (name === 'homepage') await expect(page.locator('.cine')).toHaveAttribute('data-settled', 'true', { timeout: 15000 });
        await capture(page, name);
      });
    }
    test('dashboard', async ({ page }) => {
      await installOrganizerSession(page);
      await installOrganizerSupport(page);
      await installOrganizerContests(page);
      await page.goto('/dashboard');
      await expect(page.getByRole('main', { name: 'Your boards' })).toContainText('Parkside browser board');
      await capture(page, 'dashboard');
    });
    for (const phase of ['draft', 'shared', 'published', 'final'] as const) {
      test(`organizer-${phase}`, async ({ page }) => {
        await installBoard(page, phase, true);
        await page.goto(`/boards/${boardId}`);
        const workspace = page.getByRole('main', { name: `${title} workspace` });
        await expect(workspace).toBeVisible();
        if (phase === 'draft') await expect(workspace.getByRole('region', { name: 'Board', exact: true })).toBeVisible();
        if (phase === 'shared') await expect(page.getByRole('region', { name: 'Organizer status' }).getByText('Shared · numbers not drawn', { exact: true })).toBeVisible();
        if (phase === 'final') await expect(workspace.getByText('Final record', { exact: true }).first()).toBeVisible();
        await capture(page, `organizer-${phase}`);
      });
    }
    for (const phase of ['shared', 'published', 'final'] as const) {
      test(`viewer-${phase}`, async ({ page }) => {
        await installBoard(page, phase, false);
        await page.goto(`/b/${code}`);
        if (phase === 'shared') await expect(page.getByText('Selling squares', { exact: true })).toBeVisible();
        else if (phase === 'published') await expect(page.getByRole('heading', { name: 'Current score match', exact: true })).toBeVisible();
        else await expect(page.getByRole('heading', { name: 'Final record', exact: true })).toBeVisible();
        await capture(page, `viewer-${phase}`);
      });
    }
    test('seller', async ({ page }) => {
      await page.route(`**/api/sellers/${sellerCode}`, route => route.fulfill({ json: {
        title, label: 'Family Alpha', open: true, shareCode: code,
        cells: [{ index: 0, available: true }, { index: 1, available: false }],
      } }));
      await page.goto(`/s/${sellerCode}`);
      await expect(page.getByRole('button', { name: 'Square 1, open' })).toBeVisible();
      await capture(page, 'seller');
    });
  });
}
