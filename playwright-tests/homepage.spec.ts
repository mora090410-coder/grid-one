import { expect, test, type Locator, type Page } from '@playwright/test';

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const film = (page: Page) => page.getByRole('region', { name: 'Board film' });
const settle = async (page: Page) => {
  await expect(page.getByTestId('homepage-first-viewport')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.cine')).toHaveAttribute('data-settled', 'true', { timeout: 15000 });
};
const scrollThroughPage = async (page: Page) => {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => innerHeight);
  for (let y = 0; y < height; y += step) {
    await page.evaluate(offset => scrollTo(0, offset), y);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  }
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
};
const expectTarget = async (control: Locator) => {
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
};

for (const width of [320, 390, 1280]) {
  test(`compact cinema stays bounded before and after page scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await settle(page);
    expect(await overflow(page)).toBe(0);
    const box = await film(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    await scrollThroughPage(page);
    expect(await overflow(page)).toBe(0);
    await page.evaluate(() => scrollTo(0, 0));
    expect(await overflow(page)).toBe(0);
  });
}

test('phone presents the primary action immediately and pricing within three thousand pixels', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await settle(page);
  const hero = page.getByTestId('homepage-first-viewport');
  for (const control of [hero.getByRole('heading', { level: 1 }), hero.getByRole('link', { name: 'Create your free board' }), hero.getByText(/First published board free each season/)]) {
    const box = await control.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }
  const pricing = page.getByRole('heading', { name: 'Your first board is free.' });
  expect(await pricing.evaluate(element => element.getBoundingClientRect().top + scrollY)).toBeLessThan(3000);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(5000);
  await expect(page.getByRole('region', { name: 'Interactive sample board' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Comparison table' })).toHaveCount(0);
  await testInfo.attach('compact-phone-homepage', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

test('desktop retains the cinematic board next to the promise and action', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await settle(page);
  const board = await film(page).boundingBox();
  expect(board!.y).toBeLessThan(900);
  await expect(film(page)).toContainText(/sample|simulated/i);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your team. One board. Less chasing.');
  await testInfo.attach('compact-desktop-homepage', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

test('cinematic controls support repeated and interrupted selection with visible keyboard focus', async ({ page, browserName }) => {
  await page.goto('/');
  await settle(page);
  const region = film(page);
  const before = await region.evaluate(element => element.getBoundingClientRect().top + scrollY);
  for (const name of ['Share', 'Game day', 'Build', 'Game day', 'Game day']) {
    const button = region.getByRole('button', { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(region.locator('button[aria-pressed="true"]')).toHaveCount(1);
    expect(await region.evaluate(element => element.getBoundingClientRect().top + scrollY)).toBeCloseTo(before, 0);
    await expectTarget(button);
  }
  const build = region.getByRole('button', { name: 'Build', exact: true });
  await build.focus();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  const share = region.getByRole('button', { name: 'Share', exact: true });
  await expect(share).toBeFocused();
  await share.press('Enter');
  await expect(share).toHaveAttribute('aria-pressed', 'true');
  expect(await share.evaluate(element => element.matches(':focus-visible'))).toBe(true);
  expect(await share.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  expect(await share.evaluate(element => Number.parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2);
});

test('sharing copy distinguishes public viewers from scoped seller claims', async ({ page }) => {
  await page.goto('/');
  await film(page).getByRole('button', { name: 'Share', exact: true }).click();
  await expect(film(page)).toContainText(/viewer.*viewing only|viewer.*view only/i);
  await expect(film(page)).toContainText(/seller.*unsold squares/i);
  await expect(film(page)).toContainText(/(?:before|until).*numbers lock/i);
});

test('Game day has keyboard-equivalent square inspection and truthful sample labels', async ({ page }) => {
  await page.goto('/');
  const region = film(page);
  await region.getByRole('button', { name: 'Game day', exact: true }).click();
  await expect(region).toContainText(/KC\s*17/);
  await expect(region).toContainText(/PHI\s*14/);
  await expect(region).toContainText(/sample|simulated/i);
  const next = region.getByRole('button', { name: 'Next square' });
  const previous = region.getByRole('button', { name: 'Previous square' });
  for (const control of [next, previous]) await expectTarget(control);
  const inspector = region.locator('[aria-live="polite"]');
  await expect(inspector).toContainText('Square 35 · Taylor M.');
  await expect(inspector).toContainText('KC 7 × PHI 4');
  await expect(inspector).toContainText('Matching right now.');
  const before = await inspector.innerText();
  await next.focus();
  await next.press('Enter');
  await expect(inspector).toContainText('Square 36');
  await expect(inspector).not.toContainText('Matching right now.');
  await expect.poll(() => inspector.innerText()).not.toBe(before);
  await previous.click();
  await expect.poll(() => inspector.innerText()).toBe(before);
});

test('the two-view summary changes locally and keeps its sample identity', async ({ page }) => {
  await page.goto('/');
  const summary = page.getByRole('region', { name: 'From setup to game day.' });
  await summary.getByRole('button', { name: 'Organizer view' }).click();
  await expect(summary).toContainText('Family A');
  await expect(summary).toContainText('4 squares open');
  await expect(summary).toContainText('2 squares open');
  await summary.getByRole('button', { name: 'Game day view' }).click();
  await expect(summary.getByRole('button', { name: 'Game day view' })).toHaveAttribute('aria-pressed', 'true');
  await expect(summary).toContainText(/score|matching/i);
  await expect(summary).toContainText(/sample|illustrative/i);
  await summary.getByRole('button', { name: 'Organizer view' }).click();
  await expect(summary).toContainText('Family A');
  await expect(page).toHaveURL(/\/$/);
});

test('conversion links retain visible keyboard focus', async ({ page, browserName }) => {
  await page.goto('/');
  const hero = page.getByTestId('homepage-first-viewport');
  const create = hero.getByRole('link', { name: 'Create your free board' });
  const demo = hero.getByRole('link', { name: 'Try the demo' });
  await create.focus();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(demo).toBeFocused();
  for (const link of [demo, create]) {
    if (link === create) await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab');
    await expect(link).toBeFocused();
    expect(await link.evaluate(element => element.matches(':focus-visible'))).toBe(true);
    expect(await link.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
    expect(await link.evaluate(element => Number.parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(3);
    await expectTarget(link);
  }
});

test('demo handoff still leads to a personal board preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try the demo' }).first().click();
  await expect(page).toHaveURL(/\/demo/);
  await expect(page.getByTestId('homepage')).toHaveCount(0);
  await expect(page.getByText('Sample board — not a live game', { exact: true })).toBeVisible();
  await expect(page.getByText('This is a sample board. Ready to run yours?')).toBeVisible();
  await page.getByRole('button', { name: 'Create your own board' }).click();
  await expect(page).toHaveURL(/\/create/);
  await expect(page.getByRole('region', { name: 'Board preview' })).toBeVisible();
});

test('no-JS fallback keeps the promise, actions and money boundary', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your team. One board. Less chasing.');
  await expect(page.getByRole('link', { name: /Create your free board/i })).toBeVisible();
  await expect(page.getByText(/does not collect square money/i)).toBeVisible();
  await context.close();
});

for (const rootFontPercent of [100, 200]) {
  test(`static film and controls reflow at 320px with ${rootFontPercent}% text`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/');
    await expect(film(page)).toBeVisible();
    await page.addStyleTag({ content: `html { font-size: ${rootFontPercent}% !important; }` });
    for (const name of ['Build', 'Share', 'Game day']) {
      await film(page).getByRole('button', { name, exact: true }).click();
      expect(await film(page).evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expect(await overflow(page)).toBe(0);
    }
    await scrollThroughPage(page);
    expect(await overflow(page)).toBe(0);
  });
}

test('phone hero remains readable without web fonts', async ({ page }) => {
  await page.route('**/fonts/*.woff2', route => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const action = page.getByTestId('homepage-first-viewport').getByRole('link', { name: 'Create your free board' });
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(await overflow(page)).toBe(0);
});
