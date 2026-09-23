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

test.describe('viewer shell', () => {
  test('keeps an automatic stale final visibly degraded on phone and desktop', async ({ page }) => {
    await installPublishedBoard(page, { ...liveScore, state: 'post', clock: 'Final', freshness: 'stale' });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/b/ABCDEFGH');
      await expect(page.getByRole('status').filter({ hasText: 'Stale · last known' })).toBeVisible();
      await page.screenshot({ path: `/tmp/gridone-stale-final-${width}.png`, fullPage: true });
    }
  });

  test('places the demo invitation after the board and labels the sample date', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByText('Sample game · January 18, 2026')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create your own board' })).toBeVisible();
    const isAfterViewer = await page.getByRole('complementary', { name: 'Run your own board' }).evaluate((element) => {
      const viewer = document.querySelector('main');
      return Boolean(viewer && (viewer.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(isAfterViewer).toBe(true);
    await expect(page.getByText('Game date pending')).toHaveCount(0);
  });

  test('offers a quiet new-board invitation after a final public record', async ({ page }) => {
    await installPublishedBoard(page, { ...liveScore, state: 'post', clock: 'Final' });
    await page.route('**/api/pools/ABCDEFGH/score', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ score: { ...liveScore, state: 'post', clock: 'Final' }, winnerHistory: [], pendingMilestones: [] }),
    }));
    await page.goto('/b/ABCDEFGH');
    await expect(page.getByText('Final', {exact: true}).first()).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Run your own board' })).toBeVisible();
    await page.getByRole('button', { name: 'Create your own board' }).click();
    await expect(page).toHaveURL(/\/(create|login)/);
  });

  test('demo read-only query can show the viewer without enabling mutation routes', async ({ page }) => {
    await page.goto('/demo');

    await expect(page.locator('[data-feature-flag]')).toHaveCount(0);
    await expect(page.getByTestId('viewer-first-viewport').getByRole('heading', { name: /Lincoln Softball Booster Board/i })).toBeVisible();
    await expect(page.getByTestId('viewer-first-viewport').getByRole('button', { name: /Find my squares/i })).toBeVisible();
    await expect(page.getByTestId('viewer-first-viewport')).not.toContainText(/Payouts|makes me win/i);

    await page.goto('/create');
    await expect(page).toHaveURL(/\/create/);
    await expect(page.getByRole('region', { name: 'Board preview' })).toBeVisible();
    await expect(page.locator('[data-feature-flag]')).toHaveCount(0);
  });

  test('exact viewer grid has one roving tab stop and keyboard navigation', async ({ page }) => {
    await installPublishedBoard(page);
    await page.goto('/b/ABCDEFGH');
    const boardInstrument = page.getByTestId('viewer-board-grid');
    const grid = boardInstrument.getByRole('grid', { name: /football squares board/i });
    await expect(grid).toBeVisible();
    await expect(grid.getByText('Top · WAS')).toBeVisible();
    await expect(grid.getByText('Side · DAL')).toBeVisible();
    await expect(boardInstrument.getByText(/Columns: Washington Commanders.*Rows: Dallas Cowboys/i)).toBeVisible();
    for (const name of [/Zoom out/i, /Center current result/i, /Zoom in/i, /Fit/i]) {
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

  test('C1 first viewport, score island, and no horizontal overflow at 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo');

    const firstViewport = page.getByTestId('viewer-first-viewport');
    const findButtonBox = await firstViewport.getByRole('button', { name: 'Find my squares' }).boundingBox();
    expect((findButtonBox?.y ?? 0) + (findButtonBox?.height ?? 845)).toBeLessThanOrEqual(844);
    const statusBox = await firstViewport.getByRole('status').first().boundingBox();
    expect((statusBox?.y ?? 0) + (statusBox?.height ?? 845)).toBeLessThanOrEqual(844);

    const islandToggle = page.getByRole('button', { name: /^Score/ });
    await expect(islandToggle).toHaveCount(0);
    await page.getByTestId('viewer-board-grid').scrollIntoViewIfNeeded();
    await expect(islandToggle).toBeVisible();
    await islandToggle.click();
    const scoreRegion = page.getByRole('region', { name: 'Score', exact: true });
    await expect(scoreRegion).toBeVisible();
    await expect(islandToggle).toHaveAttribute('aria-expanded', 'true');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    await page.evaluate(() => window.scrollTo(0, 0));
    // Authorized notch contract: never retire an open/focused return target.
    await expect(islandToggle).toBeVisible();
    await expect(islandToggle).toHaveAttribute('aria-expanded', 'true');
    await scoreRegion.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(islandToggle).toBeFocused();
    await expect(islandToggle).toHaveAttribute('aria-expanded', 'false');
    await firstViewport.getByRole('button', { name: 'Find my squares' }).focus();
    await expect(islandToggle).toHaveCount(0);
  });
});

for (const width of [320, 390, 1440]) {
  test(`completed Q1 and compact 99-square selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const score = { ...liveScore, period: 2, leftScore: 0, topScore: 0, clock: '12:21', detail: '12:21 - 2nd Quarter' };
    const winnerHistory = [{ milestone: 'Q1', topDigit: 0, sideDigit: 0, participantName: 'Ann', resolvedAt: '2026-09-13T18:00:00.000Z' }];
    await page.route('**/api/pools/ABCDEFGH', route => route.fulfill({ json: {
      share_code: 'ABCDEFGH', title: 'Quarter result check', revision: 7, published_at: '2026-09-12T20:00:00.000Z',
      leftAbbr: 'DAL', topAbbr: 'WAS', dates: '2026-09-13',
      board: { ...publishedBoard, squares: Array.from({ length: 100 }, (_, i) => i < 99 ? ['Ann'] : []) },
      score, winner_history: winnerHistory, pending_milestones: [], payoutDescriptions: { Q1: '$100' }, is_activated: true,
    } }));
    await page.route('**/api/pools/ABCDEFGH/score', route => route.fulfill({ json: { score, winnerHistory, pendingMilestones: [] } }));
    await page.goto('/b/ABCDEFGH');
    await expect(page.getByRole('region', { name: 'Completed results' })).toContainText('Q1 · Ann');
    await expect(page.getByRole('button', { name: /^Score/ })).toHaveCount(0);
    await page.getByTestId('viewer-first-viewport').getByRole('button', { name: 'Find my squares' }).click();
    const dialog = page.getByRole('dialog', { name: 'Find my squares' });
    await dialog.getByRole('button', { name: 'Ann', exact: true }).click();
    const summary = page.getByRole('region', { name: 'Ann square summary' });
    await expect(summary.getByRole('button', { name: /View on board/ })).toHaveCount(4);
    await summary.getByRole('button', { name: /Show all/ }).click();
    await expect(summary.getByRole('button', { name: /View on board/ })).toHaveCount(99);
    await summary.getByRole('button', { name: /Show fewer/ }).click();
    await expect(summary.getByRole('button', { name: /View on board/ })).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `/tmp/gridone-viewer-${width}.png`, fullPage: true });
  });
}
