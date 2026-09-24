import { expect, test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boardId, ownerId, scheduledGame, installOrganizerSession, installOrganizerSupport } from './helpers/organizerMocks';

const code = '0123456789abcdef';

async function capture(page: Page, name: string, testInfo: TestInfo) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(issue => issue.impact === 'serious' || issue.impact === 'critical')).toEqual([]);
  await testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true }), contentType: 'image/png' });
}

for (const width of [390, 1440]) {
  test(`buyer claims squares from a seller link at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const cells = [
      { index: 60, available: true }, { index: 61, available: true }, { index: 62, available: false },
      { index: 63, available: true }, { index: 64, available: true },
    ];
    const claims: unknown[] = [];
    await page.route(`**/api/sellers/${code}`, async route => {
      if (route.request().method() === 'POST') {
        claims.push(route.request().postDataJSON());
        await route.fulfill({ json: { cells: [60, 61], name: 'Maria Lopez', label: 'Anthony', shareCode: 'ABCDEFGH' } });
        return;
      }
      await route.fulfill({ json: {
        title: 'Lincoln Softball Booster Board', label: 'Anthony', shareCode: 'ABCDEFGH', open: true,
        sideTeamName: 'Kansas City Chiefs', topTeamName: 'Philadelphia Eagles', gameStartsAt: '2026-09-27T17:00:00Z',
        squarePrice: '$20', instructions: 'Venmo @anthony-m', cells,
      } });
    });
    await page.goto(`/s/${code}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Pick your squares from Anthony' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Square 63, taken' })).toBeDisabled();
    await capture(page, `seller-link-open-${width}`, testInfo);

    await page.getByRole('button', { name: 'Square 61, open' }).click();
    await page.getByRole('button', { name: 'Square 62, open' }).click();
    await page.getByLabel('Your name, as it shows on the board').fill('Maria Lopez');
    const claim = page.getByRole('button', { name: 'Claim 2 squares' });
    const box = await claim.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await capture(page, `seller-link-picked-${width}`, testInfo);
    await claim.click();

    await expect(page.getByRole('heading', { name: 'You’re in!' })).toBeVisible();
    await expect(page.getByText('Squares 61 and 62 are yours.')).toBeVisible();
    await expect(page.getByText('Venmo @anthony-m')).toBeVisible();
    expect(claims).toEqual([{ cells: [60, 61], name: 'Maria Lopez' }]);
    expect(await page.evaluate(() => localStorage.getItem('gridone:find-squares:ABCDEFGH'))).toBe(JSON.stringify({ version: 2, participantId: null, displayName: 'Maria Lopez' }));
    await capture(page, `seller-link-claimed-${width}`, testInfo);
  });

  test(`organizer sends every seller a link at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await installOrganizerSession(page); await installOrganizerSupport(page);
    const label = (i: number) => (i < 10 ? 'Anthony' : i < 15 ? 'Maria' : null);
    const row = { id: boardId, owner_id: ownerId, share_code: 'ABCDEFGH', title: 'Lincoln Softball', revision: 3, meta: '', gameExternalId: scheduledGame.id, kickoffAt: scheduledGame.kickoffAt, leftAbbr: 'DAL', leftName: 'Dallas Cowboys', topAbbr: 'WAS', topName: 'Washington Commanders', board: { squares: Array.from({ length: 100 }, (_, i) => (i < 2 ? ['Buyer'] : label(i) ? [label(i)!] : [])), allocationLabels: Array.from({ length: 100 }, (_, i) => label(i)), leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), isDynamic: false, allowOpenSquares: false, participation: {} }, is_activated: true, locked: true, is_shared: true, shared_at: new Date().toISOString(), published_at: null, updated_at: new Date().toISOString(), winner_history: [], pending_milestones: [], notification_delivery_issues: [], payoutDescriptions: {} };
    await page.route(`**/api/pools/${boardId}/score`, route => route.fulfill({ json: { score: null, winnerHistory: [] } }));
    await page.route(`**/api/pools/${boardId}`, route => route.fulfill({ json: row }));
    const requests: unknown[] = [];
    await page.route(`**/api/pools/${boardId}/seller-links`, async route => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ json: { links: [
        { label: 'Anthony', code, url: `https://www.getgridone.com/s/${code}` },
        { label: 'Maria', code: 'fedcba9876543210', url: 'https://www.getgridone.com/s/fedcba9876543210' },
      ] } });
    });
    await page.goto(`/boards/${boardId}`);
    const card = page.getByRole('region', { name: 'Send seller links' });
    await expect(card).toContainText('2 sellers · 15 squares');
    await card.getByRole('button', { name: 'Get seller links' }).click();
    const list = card.getByRole('list', { name: 'Seller links' });
    await expect(list.getByRole('listitem', { name: 'Anthony' })).toContainText('10 squares · 8 not sold yet');
    await expect(card.getByRole('button', { name: 'Copy all links' })).toBeVisible();
    expect(requests).toEqual([{ action: 'sync' }]);
    await capture(page, `organizer-seller-links-${width}`, testInfo);
  });
}
