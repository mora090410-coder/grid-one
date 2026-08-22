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

const installPublishedBoard = async (page: Page) => {
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
      score: liveScore,
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
    body: JSON.stringify({ score: liveScore, winnerHistory: [], pendingMilestones: [] }),
  }));
};

test.describe('viewer_v2 shell', () => {
  test('demo read-only query can show C1 viewer without enabling mutation routes', async ({ page }) => {
    await page.goto('/demo?viewer_v2=true');

    await expect(page.locator('[data-feature-flag="viewer_v2"]')).toHaveCount(1);
    await expect(page.getByTestId('viewer-first-viewport').getByRole('heading', { name: /Demo: Super Bowl LIX/i })).toBeVisible();
    await expect(page.getByTestId('viewer-first-viewport').getByRole('button', { name: /Find my squares/i })).toBeVisible();
    await expect(page.getByTestId('viewer-first-viewport')).not.toContainText(/Payouts|makes me win/i);

    await page.goto('/create?viewer_v2=true');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[data-feature-flag="viewer_v2"]')).toHaveCount(0);
  });

  test('exact viewer grid has one roving tab stop and keyboard navigation', async ({ page }) => {
    await installPublishedBoard(page);
    await page.goto('/b/ABCDEFGH?viewer_v2=true');
    const boardInstrument = page.getByTestId('viewer-board-grid-v2');
    const grid = boardInstrument.getByRole('grid', { name: /football squares board/i });
    await expect(grid).toBeVisible();
    await expect(grid.getByText('Top team')).toBeVisible();
    await expect(grid.getByText('Side team')).toBeVisible();
    for (const name of [/Zoom out/i, /Center current result/i, /Zoom in/i, /Fit board/i, /Find/i, /Center selected/i]) {
      const box = await boardInstrument.getByRole('button', { name, exact: true }).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }

    const namedCell = grid.getByRole('gridcell', { name: /Ann.*coordinate row 1 column 1.*top digit 0.*side digit 0/i });
    await namedCell.focus();
    expect(await grid.getByRole('gridcell').evaluateAll((cells) => cells.filter((cell) => cell.getAttribute('tabindex') === '0').length)).toBe(1);
    await page.keyboard.press('ArrowRight');
    await expect(grid.getByRole('gridcell', { name: /OPEN.*coordinate row 1 column 2.*top digit 1.*side digit 0/i })).toBeFocused();
    await page.keyboard.press('Control+End');
    await expect(grid.getByRole('gridcell', { name: /coordinate row 10 column 10.*top digit 9.*side digit 9/i })).toBeFocused();
  });
});
