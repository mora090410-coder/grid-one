import { expect, test, type Page } from '@playwright/test';

/**
 * The site routes (hub, articles, legal, 404, login) all sit on the same
 * header/main/footer shell. These are the contract checks that shell owes:
 * one h1 per route, the guide links, the landmarks, and a visible focus ring
 * on the first two tab stops.
 */

const focusRing = (page: Page) => page.evaluate(() => {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return null;
  const style = getComputedStyle(active);
  return {
    name: active.getAttribute('aria-label') || active.querySelector('img[alt]')?.getAttribute('alt') || active.textContent?.trim() || '',
    tag: active.tagName,
    boxShadow: style.boxShadow,
    outlineStyle: style.outlineStyle,
    outlineWidth: style.outlineWidth,
  };
});

test.describe('site routes contract', () => {
  test('articles hub renders one h1 and the twelve guide links', async ({ page }) => {
    await page.goto('/articles');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    const guideLinks = main.locator('a[href^="/articles/"]');
    await expect(guideLinks).toHaveCount(12);
    await expect(main.getByRole('link', { name: /How Football Squares Work/i })).toBeVisible();
  });

  test('an article renders its heading, related guides, the header sign in, and the footer', async ({ page }) => {
    await page.goto('/articles/how-football-squares-work');

    await expect(page.getByRole('heading', { level: 1, name: 'How football squares work' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    const related = page.getByRole('group', { name: 'Related guides' });
    await expect(related).toBeVisible();
    await expect(related.getByRole('link').first()).toBeVisible();

    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    await expect(footer.getByRole('link', { name: 'All guides' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Terms' })).toBeVisible();
  });

  for (const path of ['/privacy', '/terms']) {
    test(`${path} renders the Legal eyebrow above one h1`, async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole('main').getByText('Legal', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    });
  }

  test('an unknown path renders the 404 page and its three recovery links', async ({ page }) => {
    await page.goto('/this-path-does-not-exist');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'This link does not point to a page.' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Return to GridOne' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Create a new board' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'See the demo board' })).toBeVisible();
    await expect(main.getByRole('link')).toHaveCount(3);
  });

  test('signup mode exposes the confirm password field', async ({ page }) => {
    await page.goto('/login?mode=signup');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm Password')).toBeVisible();
  });

  test('the first two tab stops are the wordmark and sign in, each with a visible ring', async ({ page }) => {
    await page.goto('/articles/how-football-squares-work');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.keyboard.press('Tab');
    const wordmark = await focusRing(page);
    expect(wordmark?.name).toBe('GridOne');
    expect(wordmark?.boxShadow !== 'none' || wordmark?.outlineStyle !== 'none').toBe(true);

    await page.keyboard.press('Tab');
    const signIn = await focusRing(page);
    expect(signIn?.name).toBe('Sign in');
    expect(signIn?.boxShadow !== 'none' || signIn?.outlineStyle !== 'none').toBe(true);
  });
});
