import { expect, test, type Page } from '@playwright/test';
import { boardId, ownerId, installOrganizerSession, installOrganizerSupport, scheduledGame } from './helpers/organizerMocks';

declare global {
  interface Window { refinementNotch: { activate: (label: string) => void; destroy: () => void } }
}
const evidence = '.hermes/notch-implementation/evidence-pass-refine1';
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
});
async function harness(page: Page) {
  await page.goto('/login');
  await page.evaluate(async () => {
    const path = '/tests/design/notchRefinementHarness.tsx';
    const { mountRefinementNotch } = await import(path);
    window.refinementNotch = mountRefinementNotch();
  });
}

test('interruption uses painted dimensions and observer does not restart in-flight height', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await harness(page);
  const measured = await page.evaluate(async () => {
    const surface = document.querySelector('#refinement-notch-test .context-notch')!;
    const clip = surface.querySelector('.context-notch-reveal')!;
    window.refinementNotch.activate('Refinement notch');
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const initialHeightAnimation = clip.getAnimations()[0];
    for (let index = 0; index < 4; index++) await new Promise(requestAnimationFrame);
    const sameHeightAnimation = clip.getAnimations()[0] === initialHeightAnimation;
    surface.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = 120; });
    const before = { width: surface.getBoundingClientRect().width, height: clip.getBoundingClientRect().height };
    window.refinementNotch.activate('Refinement notch');
    const after = { width: surface.getBoundingClientRect().width, height: clip.getBoundingClientRect().height };
    return { before, after, sameHeightAnimation };
  });
  await info.attach('interrupted-dimensions', { body: JSON.stringify(measured), contentType: 'application/json' });
  expect(Math.abs(measured.before.width - measured.after.width)).toBeLessThan(2);
  expect(Math.abs(measured.before.height - measured.after.height)).toBeLessThan(2);
  expect(measured.sameHeightAnimation).toBe(true);
});

for (const width of [320, 390, 1280]) test(`medallions and measured selected-card anchor at ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await harness(page);
  await page.evaluate(() => window.refinementNotch.activate('Refinement notch'));
  const surface = page.locator('#refinement-notch-test .context-notch');
  await expect.poll(() => surface.evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  const card = await page.getByRole('region', { name: 'Board details' }).elementHandle();
  const firstBox = await card!.boundingBox();
  await page.screenshot({ path: `${evidence}/medallions-${width}-board.png` });
  await page.evaluate(() => window.refinementNotch.activate('Share with your organization'));
  await expect(page.getByRole('region', { name: 'Share with your organization details' })).toBeVisible();
  expect(await card!.evaluate(node => node.isConnected)).toBe(true);
  await page.screenshot({ path: `${evidence}/medallions-${width}-travel.png` });
  await expect.poll(() => surface.evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  const geometry = await surface.evaluate(node => {
    const cell = node.querySelector('[aria-pressed="true"][data-notch-cell]')!.getBoundingClientRect();
    const connector = node.querySelector('.context-notch-connector')!.getBoundingClientRect();
    const medallion = node.querySelector('.context-notch-medallion')!;
    const disc = medallion.getBoundingClientRect();
    const panel = node.querySelector('.context-notch-detail')!.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return { source: cell.x + cell.width / 2, connector: connector.x + connector.width / 2, circle: { width: disc.width, height: disc.height, radius: getComputedStyle(medallion).borderRadius }, card: { x: panel.x, width: panel.width }, surface: { x: box.x, width: box.width }, background: getComputedStyle(node).backgroundColor, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(Math.abs(geometry.source - geometry.connector)).toBeLessThan(2);
  expect(geometry.circle.width).toBe(geometry.circle.height);
  expect(geometry.circle.width).toBeGreaterThanOrEqual(44);
  expect(geometry.circle.radius).toBe('50%');
  expect(geometry.background).toBe('rgb(19, 33, 46)');
  expect(geometry.card.x).toBeGreaterThanOrEqual(geometry.surface.x);
  expect(geometry.card.x + geometry.card.width).toBeLessThanOrEqual(geometry.surface.x + geometry.surface.width);
  if (width === 1280) expect(geometry.card.x - firstBox!.x).toBeGreaterThan(20);
  expect(geometry.overflow).toBe(false);
  await page.screenshot({ path: `${evidence}/medallions-${width}-share.png` });
  await info.attach('measured-card-anchor', { body: JSON.stringify(geometry), contentType: 'application/json' });
  if (width === 1280) {
    await page.setViewportSize({ width: 320, height: 640 });
    await expect.poll(() => surface.evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
    const close = page.getByRole('button', { name: 'Close', exact: true });
    await close.scrollIntoViewIfNeeded();
    await expect(close).toBeInViewport();
    // The concave shoulders intentionally extend outside the surface box, but
    // neither the document nor the actual scrolling contents may overflow.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    expect(await surface.locator('.context-notch-contents').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: `${evidence}/medallions-resized-320.png` });
  }
});

test('changing reduced motion cancels independent reading and all notch motion', async ({ page }) => {
  await harness(page);
  await page.evaluate(async () => {
    const path = '/tests/design/notchBrowserHarness.tsx';
    const { mountReadingTest } = await import(path);
    mountReadingTest().update();
    window.refinementNotch.activate('Refinement notch');
    window.refinementNotch.activate('Payments');
    document.querySelectorAll('#notch-reading-test, #refinement-notch-test').forEach(node => node.getAnimations({ subtree: true }).forEach(animation => animation.pause()));
  });
  expect(await page.locator('#notch-reading-test').evaluate(node => node.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.locator('#notch-reading-test').evaluate(node => node.getAnimations({ subtree: true }).length), { timeout: 1000 }).toBe(0);
  await expect.poll(() => page.locator('#refinement-notch-test .context-notch').evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.getByRole('region', { name: 'Payments details' })).toBeVisible();
});

test('published organizer Game Results Share navigate real pre-Final destinations', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installOrganizerSession(page);
  await installOrganizerSupport(page);
  const score = { leftScore: 14, topScore: 10, period: 3, clock: '5:00', state: 'in', detail: 'Third quarter', isOvertime: false, freshness: 'fresh', sourceName: 'ESPN', retrievedAt: new Date().toISOString(), quarterScores: { Q1: { left: 7, top: 3 }, Q2: { left: 7, top: 7 }, Q3: { left: 0, top: 0 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } } };
  const history = [{ milestone: 'Q1', topDigit: 3, sideDigit: 7, participantName: 'Ava', resolvedAt: '2026-09-13T18:00:00Z' }];
  await page.route(`**/api/pools/${boardId}`, route => route.fulfill({ json: {
    id: boardId, owner_id: ownerId, share_code: 'SHARE123', title: 'Published notch fixture', revision: 1,
    gameExternalId: scheduledGame.id, kickoffAt: scheduledGame.kickoffAt, leftAbbr: 'DAL', leftName: 'Dallas', topAbbr: 'WAS', topName: 'Washington',
    published_at: '2026-09-13T17:00:00Z', is_activated: true, locked: false, score,
    board: { squares: Array.from({ length: 100 }, (_, index) => index === 0 ? ['Ava'] : []), leftAxis: [0,1,2,3,4,5,6,7,8,9], topAxis: [0,1,2,3,4,5,6,7,8,9], allowOpenSquares: true },
    winner_history: history, pending_milestones: [], notification_delivery_issues: [],
  } }));
  await page.route(`**/api/pools/${boardId}/score`, route => route.fulfill({ json: { score, winnerHistory: history, pendingMilestones: [] } }));
  await page.goto(`/boards/${boardId}`);
  const notch = page.getByRole('region', { name: 'Organizer status', exact: true });
  const toggle = notch.getByRole('button', { name: 'Organizer status', exact: true });
  await toggle.click();
  await expect(notch.getByRole('button', { name: 'Payments', exact: true })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button', { name: 'Payments', exact: true })).toBeVisible();
  for (const destination of [
    { module: 'Game', action: 'View score authority', id: 'organizer-score' },
    { module: 'Results', action: 'Correct a published result', id: 'organizer-corrections' },
    { module: 'Share', action: 'View sharing options', id: 'organizer-share' },
  ]) {
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await notch.getByRole('button', { name: destination.module, exact: true }).click();
    if (destination.module === 'Results') {
      await expect(notch.getByRole('region', { name: 'Results details' })).toContainText('Q1 · Ava');
      await expect(notch.getByRole('button', { name: 'View results', exact: true })).toHaveCount(0);
    }
    await notch.getByRole('button', { name: destination.action, exact: true }).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(`#${destination.id}`)).toBeFocused();
    await expect(page.locator(`#${destination.id}`)).toBeInViewport();
  }
  await toggle.click();
  await page.screenshot({ path: `${evidence}/published-organizer-share.png` });
});
