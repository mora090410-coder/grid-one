import { expect, test, type Page } from '@playwright/test';

const publishedBoard = {
  leftAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  topAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  squares: Array.from({ length: 100 }, (_, index) => index === 99 ? ['Ann'] : [] as string[]),
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
      winner_history: [{ milestone: 'Q1', topDigit: 7, sideDigit: 3, participantName: 'Ann', resolvedAt: '2026-09-13T18:00:00.000Z' }],
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


test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.abort());
  await page.route('**/*.supabase.co/**', route => route.abort());
});

for (const width of [390, 1440]) {
  test(`View on board reveals and focuses the requested square at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installPublishedBoard(page);
    await page.goto('/b/ABCDEFGH');
    await page.getByTestId('viewer-first-viewport').getByRole('button', { name: 'Find my squares' }).click();
    await page.getByRole('dialog', { name: 'Find my squares' }).getByRole('button', { name: 'Ann', exact: true }).click();
    const action = page.getByRole('button', { name: 'View on board top 0 side 0', exact: true });
    const cell = page.locator('[role="gridcell"][data-row-index="9"][data-col-index="9"]');
    await action.click();
    await expect(cell).toBeFocused();
    await expect(cell).toBeInViewport({ ratio: 1 });
    // Repeating the same target must work after returning to the summary.
    await action.scrollIntoViewIfNeeded();
    await action.focus();
    await page.keyboard.press('Enter');
    await expect(cell).toBeFocused();
    await expect(cell).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `/tmp/gridone-view-on-board-${width}.png` });
  });
}
