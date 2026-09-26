import { test, expect, type Page } from '@playwright/test';
import { installOrganizerSession } from './helpers/organizerMocks';

/**
 * The homepage paints before the sign-in check settles. While it runs, the
 * header's auth slot is held — same box, no label — so a signed-in organizer
 * never sees "Sign in" flash to "Your boards" and nothing shifts.
 */

// Hold the auth client module until the test releases it. In the dev server
// it is served as its own module; in a build it is its own chunk.
const holdAuthClient = async (page: Page) => {
  let release!: () => void;
  const released = new Promise<void>((done) => { release = done; });
  await page.route(/\/services\/supabase\.ts(\?.*)?$/, async (route) => {
    await released;
    await route.continue().catch(() => undefined);
  });
  return release;
};

const box = async (page: Page, selector: string) => {
  const element = page.locator(selector).first();
  const rect = await element.boundingBox();
  expect(rect).not.toBeNull();
  return rect!;
};

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`homepage paints during a slow sign-in check without a header flash at ${viewport.width}px (signed out)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    // Hold the hero's entrance motion still so any movement measured is layout.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const release = await holdAuthClient(page);
    await page.goto('/');

    const banner = page.locator('header').first();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Football squares. Made easy.');
    await expect(banner.locator('[data-auth-slot="pending"]')).toBeAttached();
    await expect(banner.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    await expect(banner.getByRole('link', { name: 'Your boards' })).toHaveCount(0);
    const pendingSlot = await box(page, 'header [data-auth-slot="pending"]');
    const pendingHeading = await box(page, 'h1');
    await page.screenshot({ path: testInfo.outputPath(`pending-signed-out-${viewport.width}.png`) });

    release();
    const signIn = banner.getByRole('link', { name: 'Sign in' });
    await expect(signIn).toBeVisible();
    await expect(banner.locator('[data-auth-slot]')).toHaveCount(0);
    const settled = await signIn.boundingBox();
    expect(settled).toEqual(pendingSlot);
    expect(await box(page, 'h1')).toEqual(pendingHeading);
    await page.screenshot({ path: testInfo.outputPath(`settled-signed-out-${viewport.width}.png`) });
  });

  test(`homepage paints during a slow sign-in check without a header flash at ${viewport.width}px (signed in)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    // Hold the hero's entrance motion still so any movement measured is layout.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installOrganizerSession(page);
    const release = await holdAuthClient(page);
    await page.goto('/');

    const banner = page.locator('header').first();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Football squares. Made easy.');
    await expect(banner.locator('[data-auth-slot="pending"]')).toBeAttached();
    // The wrong label never appears for an organizer.
    await expect(banner.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    const pendingWordmark = await box(page, 'header a[href="/"]');
    const pendingHeading = await box(page, 'h1');
    await page.screenshot({ path: testInfo.outputPath(`pending-signed-in-${viewport.width}.png`) });

    release();
    await expect(banner.getByRole('link', { name: 'Your boards' })).toBeVisible();
    await expect(banner.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`settled-signed-in-${viewport.width}.png`) });
    expect(await box(page, 'header a[href="/"]')).toEqual(pendingWordmark);
    expect(await box(page, 'h1')).toEqual(pendingHeading);
  });
}
