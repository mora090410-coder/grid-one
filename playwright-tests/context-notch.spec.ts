import { expect, test, type Page } from '@playwright/test';
import { boardId, installOrganizerBoard } from './helpers/organizerMocks';

// All outbound traffic is denied; individual fixtures registered later win.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' ? route.continue() : route.abort();
  });
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
});
const evidence = '.hermes/notch-implementation/evidence-pass-refine1';
async function viewer(page: Page, final = false) {
  const score = { leftScore: 14, topScore: 10, period: 3, state: final ? 'post' : 'in', clock: '5:00', detail: '', isOvertime: false, isManual: true, freshness: 'fresh', retrievedAt: '2026-09-13T18:00:00Z', quarterScores: { Q1: { left: 7, top: 3 }, Q2: { left: 7, top: 7 }, Q3: { left: 0, top: 0 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } } };
  const history = [{ milestone: 'Q1', participantName: null, openSquare: true, corrected: true, topDigit: 3, sideDigit: 7, resolvedAt: '2026-09-13T18:00:00Z' }];
  await page.route('**/api/pools/ABCDEFGH', route => route.fulfill({ json: { share_code: 'ABCDEFGH', title: 'Notch fixture', published_at: '2026-09-13T17:00:00Z', leftAbbr: 'CHI', topAbbr: 'GB', leftName: 'Chicago', topName: 'Green Bay', board: { leftAxis: [0,1,2,3,4,5,6,7,8,9], topAxis: [0,1,2,3,4,5,6,7,8,9], squares: Array.from({ length: 100 }, (_, i) => i === 0 ? ['Ann'] : []), participants: [{ id: 'ann', displayName: 'Ann', publicLabel: 'Ann' }], allowOpenSquares: true }, score, winner_history: history, is_activated: true } }));
  await page.route('**/api/pools/ABCDEFGH/score', route => route.fulfill({ json: { score, winnerHistory: history, pendingMilestones: [] } }));
  await page.goto('/b/ABCDEFGH');
  await expect(page.getByRole('heading', { name: 'Notch fixture' })).toBeVisible();
  await page.getByText('All possible next scores', { exact: true }).click();
  await page.getByRole('heading', { name: 'Board', exact: true }).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(page.getByRole('button', { name: 'Score', exact: true })).toBeVisible();
}

for (const width of [390, 1280]) test(`viewer notch motion and persistent dialog return at ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await viewer(page);
  const toggle = page.getByRole('button', { name: 'Score', exact: true });
  await expect(toggle).toContainText('Manual score');
  await page.screenshot({ path: `${evidence}/viewer-${width}-compact.png` });
  // Programmatic native click avoids hover preview consuming the open transition.
  const motion = await toggle.evaluate(async button => {
    (button as HTMLButtonElement).click();
    await new Promise(requestAnimationFrame);
    const surface = button.closest('.context-notch')!;
    const reveal = surface.querySelector('.context-notch-reveal')!;
    const animations = surface.getAnimations({ subtree: true });
    const heightAnimation = animations.find(animation => (animation.effect as KeyframeEffect).target === reveal);
    if (!heightAnimation) return { active: animations.length, heights: [] };
    heightAnimation.pause();
    const heights: number[] = [];
    for (const time of [0, 100, 300, 840]) {
      heightAnimation.currentTime = time;
      heights.push(reveal.getBoundingClientRect().height);
    }
    heightAnimation.currentTime = 100;
    return { active: animations.length, heights };
  });
  expect(motion.active).toBeGreaterThan(0);
  expect(motion.heights.length).toBe(4);
  expect(motion.heights[1]).toBeGreaterThan(motion.heights[0]);
  expect(motion.heights[1]).toBeLessThan(motion.heights[3]);
  await page.screenshot({ path: `${evidence}/viewer-${width}-mid.png` });
  await page.locator('.context-notch').evaluate(async node => {
    node.getAnimations({ subtree: true }).forEach(animation => animation.finish());
  });
  await page.screenshot({ path: `${evidence}/viewer-${width}-open.png` });
  const detail = page.getByRole('region', { name: 'Game details' });
  const element = await detail.elementHandle();
  await page.getByRole('button', { name: 'Results', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await expect(page.getByRole('region', { name: 'Results details' })).toContainText('OPEN · corrected');
  const travel = await page.getByRole('region', { name: 'Results details' }).evaluate(node => ({ count: node.getAnimations({ subtree: true }).length, left: getComputedStyle(node).left }));
  expect(travel.count).toBeGreaterThan(0);
  expect(await element?.evaluate(node => node.isConnected)).toBe(true);
  await page.screenshot({ path: `${evidence}/viewer-${width}-switch.png` });
  await page.getByRole('button', { name: 'Find squares', exact: true }).click();
  await page.getByRole('region', { name: 'Find squares details' }).getByRole('button', { name: 'Find my squares' }).click();

  const dialog = page.getByRole('dialog', { name: 'Find my squares' });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));

  await dialog.getByRole('button', { name: 'Close', exact: true }).click();

  await expect(toggle).toBeFocused();
  await expect(toggle).toBeVisible();
  await page.getByRole('heading', { name: 'Notch fixture' }).evaluate(node => { node.setAttribute('tabindex', '-1'); (node as HTMLElement).focus(); });
  await expect(toggle).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await info.attach('measured-motion', { body: JSON.stringify({ motion, travel }), contentType: 'application/json' });
});

test('organizer modules preserve payment dialog and draw confirmation; reduced motion is instant', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installOrganizerBoard(page);
  await page.goto(`/boards/${boardId}`);
  const toggle = page.getByRole('button', { name: 'Organizer status', exact: true });
  await toggle.click();
  await expect(page.getByRole('region', { name: 'Board details' })).toBeVisible();
  expect(await page.locator('.context-notch').evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await page.getByRole('button', { name: 'Payments', exact: true }).first().click();
  await page.getByRole('button', { name: 'Open payments' }).click();
  const payments = page.getByRole('dialog', { name: 'Payments', exact: true });
  await expect(payments).toBeVisible();
  await payments.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await page.screenshot({ path: `${evidence}/organizer-320-reduced.png` });
  const targets = await page.locator('.context-notch button:visible').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  expect(targets.every(box => box.width >= 44 && box.height >= 44)).toBe(true);
  await page.getByRole('region', { name: 'Organizer status', exact: true }).getByRole('button', { name: 'Prepare to publish' }).click();
  await expect(page.getByRole('button', { name: 'Use numbers and continue' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('pin is nonmodal; explicit close and forced colors remain usable', async ({ page }) => {
  await installOrganizerBoard(page);
  await page.goto(`/boards/${boardId}`);
  const toggle = page.getByRole('button', { name: 'Organizer status', exact: true });
  const supportsHover = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
  if (supportsHover) {
    await toggle.hover();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
  } else {
    await toggle.click();
    await page.getByRole('button', { name: 'Keep open' }).click();
  }
  await expect(page.getByRole('button', { name: 'Unpin' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Board name' }).focus();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.emulateMedia({ forcedColors: 'active' });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.screenshot({ path: `${evidence}/organizer-forced-colors.png` });
});

test('assignment reading sweeps on genuine prop changes; merge retracts without delay', async ({ page }, info) => {
  await installOrganizerBoard(page);
  await page.goto(`/boards/${boardId}`);
  const reading = await page.evaluate(async () => {
    const path = '/tests/design/notchBrowserHarness.tsx';
    const { mountReadingTest } = await import(path);
    const harness = mountReadingTest();
    const circle = document.querySelector('#notch-reading-test circle:last-child')!;
    const initialAnimations = circle.getAnimations().length;
    harness.update();
    const animation = circle.getAnimations()[0];
    if (!animation) { harness.destroy(); return { initialAnimations, values: [], duration: 0 }; }
    animation.pause();
    const values: number[] = [];
    for (const time of [0, 200, 900, 1800]) {
      animation.currentTime = time;
      values.push(parseFloat(getComputedStyle(circle).strokeDashoffset));
    }
    const duration = animation.effect?.getTiming().duration;
    harness.destroy();
    return { initialAnimations, values, duration };
  });
  expect(reading.initialAnimations).toBe(0);
  expect(reading.duration).toBe(1800);
  expect(reading.values[0]).toBeCloseTo(80);
  expect(reading.values[1]).toBeLessThan(80);
  expect(reading.values[1]).toBeGreaterThan(28);
  expect(reading.values[3]).toBeCloseTo(28);
  const toggle = page.getByRole('button', { name: 'Organizer status', exact: true });
  await toggle.evaluate(button => (button as HTMLButtonElement).click());
  const stagger = await page.locator('.context-notch').evaluate(node => node.getAnimations({ subtree: true }).filter(animation => (animation.effect as KeyframeEffect).target?.hasAttribute('data-notch-cell')).map(animation => animation.effect?.getTiming().delay));
  expect(stagger).toEqual([0, 45, 90, 135]);
  await page.locator('.context-notch').evaluate(node => node.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
  await toggle.evaluate(button => (button as HTMLButtonElement).click());
  const merge = await page.locator('.context-notch-reveal').evaluate(node => node.getAnimations()[0]?.effect?.getTiming());
  expect(merge?.duration).toBe(200);
  expect(merge?.delay).toBe(0);
  await info.attach('reading-stagger-merge', { body: JSON.stringify({ reading, stagger, merge }), contentType: 'application/json' });
});
