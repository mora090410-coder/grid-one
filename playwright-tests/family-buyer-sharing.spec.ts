import { expect, test } from '@playwright/test';

test('family can share a stable buyer link without exposing private access', async ({ page, browser, baseURL }) => {
  const familyToken = 'a'.repeat(64);
  const sellerPath = '/s/0123456789abcdef';
  let claimed = '';
  let created = false;
  let createCalls = 0;
  const family = () => ({
    title: 'No-money family fixture', revision: claimed ? 2 : 1, label: 'Family Alpha',
    cells: [
      { index: 0, name: claimed, availability: 'available' },
      { index: 1, name: 'Already taken', availability: 'unavailable' },
    ],
  });
  await page.route('**/api/family', async route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${familyToken}`);
    expect(route.request().postDataJSON()).toEqual({ action: 'read' });
    await route.fulfill({ json: family() });
  });
  await page.route('**/api/family/seller-link', async route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${familyToken}`);
    const action = route.request().postDataJSON().action;
    expect(['read', 'create']).toContain(action);
    if (action === 'create') { createCalls++; created = true; }
    await route.fulfill({ json: claimed
      ? { state: 'no_available', availableCount: 0 }
      : created ? { state: 'active', url: sellerPath, availableCount: 1 }
        : { state: 'not_created', availableCount: 1 } });
  });
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: async () => { throw new Error('clipboard unavailable'); } },
  }));
  await page.goto(`/family#${familyToken}`);
  await expect(page.getByRole('heading', { name: 'Share available squares' })).toBeVisible();
  await page.getByRole('button', { name: 'Create buyer link' }).click();
  await page.getByRole('button', { name: 'Copy buyer link' }).click();
  const buyerLink = new URL(sellerPath, baseURL).href;
  await expect(page.getByLabel('Buyer link', { exact: true })).toHaveValue(buyerLink);
  expect(buyerLink).not.toContain(familyToken);
  await page.reload();
  await page.getByRole('button', { name: 'Copy buyer link' }).click();
  await expect(page.getByLabel('Buyer link', { exact: true })).toHaveValue(buyerLink);
  expect(createCalls).toBe(1);

  const buyer = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
  try {
    const buyerPage = await buyer.newPage();
    await buyerPage.route('**/api/sellers/0123456789abcdef', async route => {
      expect(route.request().headers().authorization).toBeUndefined();
      if (route.request().method() === 'POST') {
        expect(route.request().postDataJSON()).toEqual({ cells: [0], name: 'QA Buyer' });
        claimed = 'QA Buyer';
        await route.fulfill({ json: { cells: [0], name: claimed, label: 'Family Alpha', shareCode: 'ABCDEFGH' } });
      } else {
        await route.fulfill({ json: { title: family().title, label: 'Family Alpha', open: true, shareCode: 'ABCDEFGH',
          cells: [{ index: 0, available: !claimed }, { index: 1, available: false }] } });
      }
    });
    await buyerPage.goto(buyerLink);
    await expect(buyerPage.getByRole('button', { name: 'Square 1, open' })).toBeVisible();
    await expect(buyerPage.getByRole('button', { name: 'Square 2, taken', includeHidden: true })).toBeDisabled();
    expect(claimed).toBe('');
    await buyerPage.getByRole('button', { name: 'Square 1, open' }).click();
    await buyerPage.getByLabel('Your name, as it shows on the board').fill('QA Buyer');
    await buyerPage.getByRole('button', { name: 'Claim my square' }).click();
    await expect(buyerPage.getByRole('heading', { name: 'You’re on the board' })).toBeVisible();
    await buyerPage.reload();
    await expect(buyerPage.getByRole('button', { name: 'Square 1, taken', includeHidden: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByLabel('Name on square 1')).toHaveValue('QA Buyer');
  } finally {
    await buyer.close();
  }
});
