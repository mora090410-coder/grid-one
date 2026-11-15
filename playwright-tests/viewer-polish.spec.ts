import { expect, test, type Page } from '@playwright/test';

const publishedBoard = {
  leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  squares: Array.from({ length: 100 }, (_, index) => index === 0 ? ['Ann'] : [] as string[]),
  isDynamic: false,
  allowOpenSquares: true,
  participants: [{ id: 'participant-ann', displayName: 'Ann', publicLabel: 'Ann' }],
};

const liveScore = {
  leftScore: 17,
  topScore: 24,
  quarterScores: {
    Q1: { left: 3, top: 7 },
    Q2: { left: 7, top: 7 },
    Q3: { left: 7, top: 3 },
    Q4: { left: 0, top: 7 },
    OT: { left: 0, top: 0 },
  },
  clock: '2:31',
  period: 4,
  state: 'in',
  detail: 'Fourth quarter',
  isOvertime: false,
  freshness: 'fresh',
};

const installPublishedBoard = async (page: Page, score = liveScore) => {
  await page.route('**/api/pools/ABCDEFGH', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      share_code: 'ABCDEFGH',
      title: 'Published Week 1',
      revision: 7,
      published_at: '2026-09-12T20:00:00.000Z',
      leftAbbr: 'DAL',
      leftName: 'Dallas Cowboys',
      topAbbr: 'WAS',
      topName: 'Washington Commanders',
      dates: '2026-09-13',
      board: publishedBoard,
      score,
      winner_history: [],
      pending_milestones: [],
      payoutDescriptions: {},
      is_activated: true,
      locked: false,
    }),
  }));
  await page.route('**/api/pools/ABCDEFGH/score', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ score, winnerHistory: [], pendingMilestones: [] }),
  }));
};


test('Find is near score on phone and desktop and keeps keyboard dialog flow', async ({ page }) => {
  await installPublishedBoard(page);
  for (const width of [393, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/b/ABCDEFGH');
    const find = page.getByRole('button', { name: 'Find my squares', exact: true });
    await expect(find).toBeVisible();
    const bounds = await find.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThan(500);
    await find.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(find).toBeFocused();
    await page.screenshot({ path: `/tmp/gridone-viewer-polish-${width}.png`, fullPage: true, animations: 'disabled' });
  }
});

test('floating score does not cover top grid digits', async ({ page }) => {
  await installPublishedBoard(page);
  await page.setViewportSize({ width: 393, height: 844 });
  await page.goto('/b/ABCDEFGH');
  const grid = page.getByRole('grid');
  await expect(grid).toBeVisible();
  await grid.evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 45));
  await expect(page.getByRole('button', { name: 'Score', exact: true })).toHaveCount(0);
  await page.screenshot({ path: '/tmp/gridone-viewer-polish-grid.png', animations: 'disabled' });
});

test('halftime selection remains a match with pending confirmation, not a declared winner', async ({ page }) => {
  const score = { ...liveScore, leftScore: 20, topScore: 10, period: 2, clock: '0:00', detail: 'Halftime' };
  const pending = [{ milestone: 'Q2', topScore: 10, sideScore: 20, topDigit: 0, sideDigit: 0, stableSince: '', lastObservedAt: '', successfulReadCount: 1 }];
  await installPublishedBoard(page, score);
  await page.route('**/api/pools/ABCDEFGH', async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    share_code: 'ABCDEFGH', title: 'Halftime fixture', revision: 7, published_at: '2026-09-12T20:00:00.000Z', leftAbbr: 'DAL', leftName: 'Dallas Cowboys', topAbbr: 'WAS', topName: 'Washington Commanders', dates: '2026-09-13', board: publishedBoard, score, winner_history: [], pending_milestones: pending, is_activated: true, locked: false,
  }) }));
  await page.route('**/api/pools/ABCDEFGH/score', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ score, winnerHistory: [], pendingMilestones: pending }) }));
  await page.setViewportSize({ width: 393, height: 844 });
  await page.goto('/b/ABCDEFGH');
  await page.getByRole('button', { name: 'Find my squares', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ann', exact: true }).click();
  await expect(page.getByText('1 square · 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Halftime · pending confirmation', { exact: true })).toBeVisible();
  await expect(page.getByText(/You’re winning|Winning right now|No quarter winners yet/)).toHaveCount(0);
  await page.screenshot({ path: '/tmp/gridone-viewer-polish-halftime.png', fullPage: true, animations: 'disabled' });
});
