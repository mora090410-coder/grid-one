import { expect, test as base, type Page } from '@playwright/test';

/** Register before the scenario's routes: explicit mocks take precedence. */
export async function guardUnmockedApi(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const unexpected: string[] = [];
  await page.route(url => url.origin === origin && url.pathname.startsWith('/api/'), async route => {
    // Do not include query strings, request bodies, or credentials in diagnostics.
    unexpected.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    await route.fulfill({ status: 503, json: { error: 'Unexpected unmocked test API request' } });
  });
  return unexpected;
}

/** Only opted-in mocked suites use this guard; intentional error mocks still work. */
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    if (!baseURL) throw new Error('Strict API mocks require the configured local baseURL.');
    const unexpected = await guardUnmockedApi(page, baseURL);
    await use(page);
    expect(unexpected, 'Every exercised same-app API request must have an explicit scenario mock').toEqual([]);
  },
});
export { expect };
