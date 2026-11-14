import { expect, test } from '@playwright/test';

const film = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Board film' });

test('FAQ answers open and close from the keyboard', async ({ page }) => {
  await page.goto('/');
  const summary = page.locator('summary').filter({ hasText: 'Do viewers need an account?' });
  await summary.focus();
  await summary.press('Enter');
  await expect(page.getByText(/Viewers open the link without creating an account\. Only the organizer signs in\./)).toBeVisible();
  await summary.press('Enter');
  await expect(page.getByText(/Viewers open the link without creating an account\. Only the organizer signs in\./)).toBeHidden();
});

test('the 3D film never blocks readable content or controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.cine')).toHaveAttribute('data-mode', /^(static|cinematic)$/);
  for (const name of ['Build', 'Share', 'Game day']) await expect(film(page).getByRole('button', { name, exact: true })).toBeVisible();
  await expect(film(page)).toContainText(/sample|simulated/i);
});

test('missing WebGL keeps a usable static film with the same chapter controls', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
      if (/webgl/i.test(contextId)) return null;
      return original.apply(this, [contextId, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.locator('.cine')).toHaveAttribute('data-mode', 'static');
  for (const name of ['Build', 'Share', 'Game day']) {
    const control = film(page).getByRole('button', { name, exact: true });
    await control.click();
    await expect(control).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(film(page)).toContainText(/KC\s*17/);
  await expect(film(page).getByRole('button', { name: 'Next square' })).toBeEnabled();
});

test('reduced motion keeps all content and requests no 3D code', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on('request', request => { if (/boardScene|three/.test(request.url())) requests.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('.cine')).toHaveAttribute('data-mode', 'static');
  for (const name of ['Build', 'Share', 'Game day']) {
    const control = film(page).getByRole('button', { name, exact: true });
    await control.click();
    await expect(control).toHaveAttribute('aria-pressed', 'true');
  }
  for (const name of [/Your team\.\s*One board\.\s*Less chasing\./, 'From setup to game day.', 'Your first board is free.']) {
    const heading = page.getByRole('heading', { name }).first();
    await expect(heading).toBeVisible();
    expect(await heading.evaluate(element => getComputedStyle(element).opacity)).toBe('1');
  }
  await expect(page.locator('[data-reveal], [data-enter]')).toHaveCount(0);
  expect(requests).toEqual([]);
  await context.close();
});

const openForcedFilm = async (page: import('@playwright/test').Page) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?film=on');
  await expect(page.locator('.cine')).toHaveAttribute('data-mode', 'cinematic', { timeout: 15000 });
  await expect(page.locator('.cine')).toHaveAttribute('data-settled', 'true', { timeout: 15000 });
  await expect(film(page).locator('canvas')).toBeVisible();
};

test('forced cinematic scene switches chapters and distinguishes inspected from matching squares', async ({ page }) => {
  await openForcedFilm(page);
  for (const name of ['Build', 'Share', 'Game day']) {
    const control = film(page).getByRole('button', { name, exact: true });
    await control.click();
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await expect(film(page).locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('.cine')).toHaveAttribute('data-mode', 'cinematic');
  }
  const inspector = film(page).locator('[aria-live="polite"]');
  await expect(inspector).toContainText('Square 35 · Taylor M.');
  await expect(inspector).toContainText('Matching right now.');
  await expect(film(page)).toContainText('You can also tap a tile.');
  await film(page).getByRole('button', { name: 'Next square' }).click();
  await expect(inspector).toContainText('Square 36');
  await expect(inspector).not.toContainText('Matching right now.');
  // The sampled score's matching owner does not change when another square is inspected.
  await expect(film(page)).toContainText('Taylor M. matches 7 × 4 right now.');
  await film(page).getByRole('button', { name: 'Previous square' }).click();
  await expect(inspector).toContainText('Square 35 · Taylor M.');
  await expect(inspector).toContainText('Matching right now.');
});

test('forced cinematic WebGL context loss preserves a usable truthful static fallback', async ({ page }) => {
  await openForcedFilm(page);
  await film(page).locator('canvas').evaluate(canvas => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(page.locator('.cine')).toHaveAttribute('data-mode', 'static');
  await expect(film(page)).not.toContainText('tap a tile');
  for (const name of ['Build', 'Share', 'Game day']) {
    const control = film(page).getByRole('button', { name, exact: true });
    await control.click();
    await expect(control).toHaveAttribute('aria-pressed', 'true');
  }
  await film(page).getByRole('button', { name: 'Next square' }).click();
  await expect(film(page).locator('[aria-live="polite"]')).toContainText('Square 36');
  await expect(film(page)).not.toContainText('tap a tile');
});

// Count actual WebGL draws rather than unrelated requestAnimationFrame callbacks.
const instrumentDraws = async (page: import('@playwright/test').Page) => page.addInitScript(() => {
  const state = window as unknown as { __filmDraws: number };
  state.__filmDraws = 0;
  for (const Constructor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Constructor) continue;
    const prototype = Constructor.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = prototype[name];
      if (!original) continue;
      prototype[name] = function (...args: unknown[]) { state.__filmDraws++; return original.apply(this, args); };
    }
  }
});
const drawCount = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __filmDraws: number }).__filmDraws);

test('forced cinematic renderer resumes after an emulated document hidden-to-visible transition', async ({ page }) => {
  await instrumentDraws(page);
  await openForcedFilm(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const before = await drawCount(page);
  await film(page).getByRole('button', { name: 'Build', exact: true }).click();
  await page.waitForTimeout(250); // Verify that the hidden document suppresses draws.
  expect(await drawCount(page)).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => drawCount(page)).toBeGreaterThan(before);
  await expect(page.locator('.cine')).toHaveAttribute('data-mode', 'cinematic');
});

test('forced cinematic renderer resumes when its stage returns onscreen', async ({ page }) => {
  await instrumentDraws(page);
  await openForcedFilm(page);
  await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
  await expect(film(page).locator('canvas')).not.toBeInViewport();
  await page.waitForTimeout(250); // Let the real IntersectionObserver deliver the offscreen state.
  const before = await drawCount(page);
  await film(page).getByRole('button', { name: 'Build', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await page.waitForTimeout(250);
  expect(await drawCount(page)).toBe(before);
  await film(page).locator('canvas').scrollIntoViewIfNeeded();
  await expect.poll(() => drawCount(page)).toBeGreaterThan(before);
  await expect(page.locator('.cine')).toHaveAttribute('data-mode', 'cinematic');
});
