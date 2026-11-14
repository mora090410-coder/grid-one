import { openBoardTask } from './helpers/organizerMocks';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boardId, ownerId, scheduledGame, installOrganizerSession, installOrganizerSupport } from './helpers/organizerMocks';

for (const credited of [false, true]) for (const width of [390, 1440]) {
  test(`Organization is reachable with remaining allowance and shows its canonical ${credited ? 'credited' : 'direct'} receipt at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await installOrganizerSession(page); await installOrganizerSupport(page);
    await page.route(`**/api/pools/${boardId}`, route => route.fulfill({ json: {
      id: boardId, owner_id: ownerId, share_code: 'BILL2345', title: 'Organization browser fixture', revision: 1,
      gameExternalId: scheduledGame.id, kickoffAt: scheduledGame.kickoffAt,
      leftAbbr: 'DAL', leftName: 'Dallas Cowboys', topAbbr: 'WAS', topName: 'Washington Commanders',
      board: { leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), squares: Array.from({ length: 100 }, () => []), isDynamic: false },
      is_activated: false, locked: false, is_shared: false, published_at: null, winner_history: [], pending_milestones: [], notification_delivery_issues: [],
    } }));
    let purchased = false;
    await page.route('**/api/billing/status*', route => route.fulfill({ json: purchased ? {
      tier: 'org', allowance: 50, used: 0, remaining: 50, organizationDisplayName: 'Ravens Fixture Club',
      orderOrganizationDisplayName: 'Ravens Fixture Club', seasonYear: 2026, entitlementStatus: 'active',
      orderStatus: 'paid', paymentConfirmed: true, contestId: boardId, paidAt: '2026-10-14T18:00:00Z', amountPaidCents: credited ? 6901 : 7900, creditCents: credited ? 999 : 0,
    } : { checkoutAvailability: { gameday: true, org: true }, tier: credited ? 'gameday' : 'free', allowance: credited ? 5 : 1, used: credited ? 1 : 0, remaining: credited ? 4 : 1, seasonYear: 2026, entitlementStatus: 'active' } }));
    await page.route('**/api/stripe/create-checkout-session', async route => {
      expect(route.request().postDataJSON()).toEqual({ contestId: boardId, tier: 'org', organizationName: 'Ravens Fixture Club' });
      purchased = true;
      await route.fulfill({ json: { url: `${new URL(route.request().url()).origin}/paid?order=44444444-4444-4444-8444-444444444444` } });
    });
    await page.goto(`/boards/${boardId}`);
    await openBoardTask(page, 'Game & settings');
    const plans = page.getByRole('button', { name: 'Season plans', exact: true });
    await expect(plans).toBeVisible();
    await plans.click();
    const sheet = page.getByRole('dialog', { name: 'Choose a plan' });
    await expect(sheet.getByRole('radio', { name: /Organization.*79/ })).toBeChecked();
    await sheet.getByLabel('Organization name').fill('Ravens Fixture Club');
    await expect(sheet).toContainText('$69.01');
    await expect(sheet).toContainText('50 total boards');
    // Sheet entry fades the entire panel (including text) from opacity 0 to 1.
    // Audit its settled interactive state, not a transient animation frame.
    await sheet.evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
    const a11y = await new AxeBuilder({ page }).analyze();
    expect(a11y.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    await info.attach('plan-choice', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    await sheet.getByRole('button', { name: 'Continue to Organization checkout' }).click();
    await expect(page.getByRole('heading', { name: 'Plan ready.' })).toBeVisible();
    const receipt = page.getByRole('region', { name: 'Payment receipt' });
    await expect(receipt).toContainText('Organization: Ravens Fixture Club');
    await expect(receipt).toContainText(`Amount paid: ${credited ? '$69.01' : '$79.00'} USD`);
    if (credited) await expect(receipt).toContainText('Game Day credit: $9.99');
    await expect(receipt).toContainText('Season: 2026');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const receiptA11y = await new AxeBuilder({ page }).analyze();
    expect(receiptA11y.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    await info.attach('organization-receipt', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });
}

for (const status of ['unavailable', 'failed', 'unknown'] as const) {
  test(`checkout stays disabled when availability is ${status}, without hiding current allowance`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installOrganizerSession(page); await installOrganizerSupport(page);
    await page.route(`**/api/pools/${boardId}`, route => route.fulfill({ json: {
      id: boardId, owner_id: ownerId, share_code: 'BILL2345', title: 'Checkout availability fixture', revision: 1,
      gameExternalId: scheduledGame.id, kickoffAt: scheduledGame.kickoffAt,
      leftAbbr: 'DAL', leftName: 'Dallas Cowboys', topAbbr: 'WAS', topName: 'Washington Commanders',
      board: { leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), squares: Array.from({ length: 100 }, () => []), isDynamic: false },
      is_activated: false, locked: false, is_shared: false, published_at: null, winner_history: [], pending_milestones: [], notification_delivery_issues: [],
    } }));
    let recovered = false;
    await page.route('**/api/billing/status*', route => route.fulfill({ status: status === 'failed' && !recovered ? 503 : 200, json: {
      tier: 'free', allowance: 1, used: 0, remaining: 1,
      ...(recovered ? { checkoutAvailability: { gameday: true, org: true } } : status === 'unavailable' ? { checkoutAvailability: { gameday: false, org: false } } : {}),
    } }));
    let checkoutCalls = 0;
    await page.route('**/api/stripe/create-checkout-session', route => { checkoutCalls++; return route.fulfill({ status: 503, json: { error: 'Unexpected checkout call' } }); });
    await page.goto(`/boards/${boardId}`);
    await openBoardTask(page, 'Game & settings');
    await page.getByRole('button', { name: 'Season plans', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Choose a plan' });
    await sheet.getByLabel('Organization name').fill('Ravens Fixture Club');
    await expect(sheet.getByRole('button', { name: 'Continue to Organization checkout' })).toBeDisabled();
    await expect(sheet).toContainText('Paid checkout is temporarily unavailable. Your current boards and plan are unchanged.');
    await expect(sheet).toContainText('$79');
    recovered = true;
    await sheet.getByRole('button', { name: 'Check checkout again' }).click();
    await expect(sheet.getByRole('button', { name: 'Continue to Organization checkout' })).toBeEnabled();
    await expect(sheet.getByRole('button', { name: 'Check checkout again' })).not.toBeVisible();
    await sheet.getByRole('button', { name: 'Not now' }).click();
    await expect(sheet).not.toBeVisible();
    expect(checkoutCalls).toBe(0);
  });
}
