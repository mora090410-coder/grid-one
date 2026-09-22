import { expect, test, type Page } from '@playwright/test';
import {
  boardId,
  installOrganizerSession,
  installOrganizerSupport,
  ownerId,
  scheduledGame,
} from './helpers/organizerMocks';

const evidence = '.work/notch-quickviews';

const score = {
  leftScore: 21,
  topScore: 20,
  period: 4,
  clock: '2:00',
  state: 'in',
  detail: 'Fourth quarter',
  isOvertime: false,
  isManual: true,
  freshness: 'fresh',
  sourceName: 'Manual score',
  retrievedAt: '2026-09-13T22:00:00Z',
  quarterScores: {
    Q1: { left: 7, top: 3 },
    Q2: { left: 7, top: 7 },
    Q3: { left: 0, top: 3 },
    Q4: { left: 7, top: 7 },
    OT: { left: 0, top: 0 },
  },
};

const history = [
  { milestone: 'Q1', participantName: 'Ava', topScore: 3, sideScore: 7, topDigit: 3, sideDigit: 7, resolvedAt: '2026-09-13T18:00:00Z' },
  { milestone: 'Q2', participantName: 'Ben', topScore: 10, sideScore: 14, topDigit: 0, sideDigit: 4, resolvedAt: '2026-09-13T19:00:00Z' },
  { milestone: 'Q3', participantName: null, openSquare: true, corrected: true, topScore: 13, sideScore: 14, topDigit: 3, sideDigit: 4, resolvedAt: '2026-09-13T20:00:00Z' },
  { milestone: 'FINAL', participantName: 'Dana', topScore: 20, sideScore: 21, topDigit: 0, sideDigit: 1, resolvedAt: '2026-09-13T22:00:00Z' },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const hostname = new URL(route.request().url()).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
});

async function assertKeyboardResultsQuickView(page: Page, notchLabel: string) {
  const notch = page.getByRole('region', { name: notchLabel, exact: true });
  const toggle = notch.getByRole('button', { name: notchLabel, exact: true });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  const resultsButton = notch.getByRole('button', { name: 'Results', exact: true });
  await resultsButton.focus();
  await page.keyboard.press('Enter');
  await expect(resultsButton).toBeFocused();
  await expect(resultsButton).toHaveAttribute('aria-pressed', 'true');

  const results = notch.getByRole('region', { name: 'Results details' });
  await expect(results).toBeVisible();
  const rows = results.locator('.context-notch-result');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('Q1 · Ava');
  await expect(rows.nth(0)).toContainText('DAL 7 · WAS 3 · WAS digit 3 · DAL digit 7');
  await expect(rows.nth(1)).toContainText('Halftime · Ben');
  await expect(rows.nth(1)).toContainText('DAL 14 · WAS 10 · WAS digit 0 · DAL digit 4');
  await expect(rows.nth(2)).toContainText('Q3 · OPEN · corrected');
  await expect(rows.nth(2)).toContainText('DAL 14 · WAS 13 · WAS digit 3 · DAL digit 4');
  await expect(rows.nth(3)).toContainText('Final · Dana');
  await expect(rows.nth(3)).toContainText('DAL 21 · WAS 20 · WAS digit 0 · DAL digit 1');
  await expect(results.getByRole('button', { name: 'View results', exact: true })).toHaveCount(0);

  await notch.locator('.context-notch').evaluate(node => {
    node.getAnimations({ subtree: true }).forEach(animation => animation.finish());
  });

  const geometry = await results.evaluate(node => {
    const detail = node.getBoundingClientRect();
    const surface = node.closest('.context-notch')!.getBoundingClientRect();
    const contents = node.closest('.context-notch-contents')!;
    return {
      detail: { left: detail.left, right: detail.right },
      surface: { left: surface.left, right: surface.right },
      contentsFits: contents.scrollWidth <= contents.clientWidth,
      documentFits: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  const close = notch.getByRole('button', { name: 'Close', exact: true });
  const footerIsTopmost = await close.evaluate(button => {
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return Boolean(hit?.closest('.context-notch'));
  });
  expect(geometry.detail.left).toBeGreaterThanOrEqual(geometry.surface.left);
  expect(geometry.detail.right).toBeLessThanOrEqual(geometry.surface.right);
  expect(geometry.contentsFits).toBe(true);
  expect(geometry.documentFits).toBe(true);
  expect(footerIsTopmost).toBe(true);
}

async function installViewerBoard(page: Page) {
  await page.route('**/api/pools/ABCDEFGH', route => route.fulfill({ json: {
    share_code: 'ABCDEFGH',
    title: 'Notch quick-view fixture',
    published_at: '2026-09-13T17:00:00Z',
    leftAbbr: 'DAL',
    topAbbr: 'WAS',
    leftName: 'Dallas',
    topName: 'Washington',
    board: {
      leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      squares: Array.from({ length: 100 }, (_, index) => index === 0 ? ['Ava'] : []),
      participants: [{ id: 'ava', displayName: 'Ava', publicLabel: 'Ava' }],
      allowOpenSquares: true,
    },
    score,
    winner_history: history,
    pending_milestones: [],
    is_activated: true,
  } }));
  await page.route('**/api/pools/ABCDEFGH/score', route => route.fulfill({ json: {
    score,
    winnerHistory: history,
    pendingMilestones: [],
  } }));
}

async function installPublishedOrganizerBoard(page: Page) {
  await installOrganizerSession(page);
  await installOrganizerSupport(page);
  await page.route(`**/api/pools/${boardId}`, route => route.fulfill({ json: {
    id: boardId,
    owner_id: ownerId,
    share_code: 'SHARE123',
    title: 'Published notch quick-view fixture',
    revision: 1,
    gameExternalId: scheduledGame.id,
    kickoffAt: scheduledGame.kickoffAt,
    leftAbbr: 'DAL',
    leftName: 'Dallas',
    topAbbr: 'WAS',
    topName: 'Washington',
    published_at: '2026-09-13T17:00:00Z',
    is_activated: true,
    locked: false,
    score,
    board: {
      squares: Array.from({ length: 100 }, (_, index) => index === 0 ? ['Ava'] : []),
      leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      allowOpenSquares: true,
    },
    winner_history: history,
    pending_milestones: [],
    notification_delivery_issues: [],
  } }));
  await page.route(`**/api/pools/${boardId}/score`, route => route.fulfill({ json: {
    score,
    winnerHistory: history,
    pendingMilestones: [],
  } }));
}

for (const width of [390, 1280]) {
  test(`viewer inline Results quick view is keyboard-ready and contained at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installViewerBoard(page);
    await page.goto('/b/ABCDEFGH');
    await expect(page.getByRole('heading', { name: 'Notch quick-view fixture' })).toBeVisible();
    await page.getByText('All possible next scores', { exact: true }).click();
    await page.getByRole('heading', { name: 'Board', exact: true }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.getByRole('button', { name: 'Score', exact: true }).scrollIntoViewIfNeeded();
    await assertKeyboardResultsQuickView(page, 'Score');
    await page.screenshot({ path: `${evidence}/viewer-results-${width}.png` });
  });

  test(`organizer inline Results quick view is keyboard-ready and contained at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installPublishedOrganizerBoard(page);
    await page.goto(`/boards/${boardId}`);
    await assertKeyboardResultsQuickView(page, 'Organizer status');
    const results = page.getByRole('region', { name: 'Organizer status', exact: true }).getByRole('region', { name: 'Results details' });
    await expect(results.getByRole('button', { name: 'Correct a published result', exact: true })).toBeVisible();
    await page.screenshot({ path: `${evidence}/organizer-results-${width}.png` });
  });
}
