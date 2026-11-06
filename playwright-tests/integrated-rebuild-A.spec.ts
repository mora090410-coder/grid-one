import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boardId, ownerId, scheduledGame, installOrganizerBoard } from './helpers/organizerMocks';

const sample = () => ({
  id: boardId, owner_id: ownerId, share_code: 'COLORA01', title: 'Palette A acceptance board', revision: 1,
  gameExternalId: scheduledGame.id, kickoffAt: scheduledGame.kickoffAt, dates: 'Sample game',
  leftAbbr: 'DAL', leftName: 'Dallas Cowboys', topAbbr: 'WAS', topName: 'Washington Commanders',
  board: { squares: Array.from({ length: 100 }, (_, i) => i < 10 ? ['Sample seller'] : []), allocationLabels: Array.from({ length: 100 }, (_, i) => i < 10 ? 'Sample seller' : null), leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), isDynamic: false, allowOpenSquares: false },
  is_shared: true, shared_at: '2026-11-05T12:00:00Z', is_activated: true, locked: false, published_at: null,
  winner_history: [], pending_milestones: [], notification_delivery_issues: [], payoutDescriptions: {},
});

for (const width of [320, 390, 1440]) {
  test(`palette A is integrated at home/create and sales controls match at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('[data-base]').first()).toHaveCSS('background-color', 'rgb(16, 27, 42)');
    await expect(page.getByRole('link', { name: 'Create your free board', exact: true }).first()).toHaveCSS('background-color', 'rgb(183, 164, 119)');
    await page.screenshot({ path: info.outputPath(`home-${width}.png`), fullPage: true });
    await page.getByRole('link', { name: 'Create your free board', exact: true }).first().click();
    await expect(page).toHaveURL(/\/create/);
    await expect(page.getByRole('heading', { name: 'Start with your team.', exact: true })).toBeVisible();
    await expect(page.locator('[data-base]').first()).toHaveCSS('background-color', 'rgb(16, 27, 42)');
    await page.route('**/api/pools/COLORA01', route => route.fulfill({ json: { ...sample(), owner_id: undefined } }));
    await page.route('**/api/pools/*/score', route => route.fulfill({ json: { score: null, winnerHistory: [] } }));
    await page.goto('/b/COLORA01');
    const search = page.getByRole('searchbox'); const family = page.getByLabel('Family', { exact: true });
    await expect(family).toHaveCSS('appearance', 'none');
    const dimensions = await Promise.all([search.boundingBox(), family.boundingBox()]);
    expect(dimensions[0]!.height).toBe(48); expect(dimensions[1]!.height).toBe(48);
    await family.selectOption('Sample seller');
    await expect(page.getByRole('gridcell')).toHaveCount(100);
    await expect(page.getByRole('region', { name: 'Square details', exact: true }).getByRole('listitem')).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`sales-${width}.png`), fullPage: true });
  });
}

for (const reduced of [false, true]) {
  test(`real organizer selection and handoff honor reduced motion=${reduced}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await installOrganizerBoard(page);
    await page.route(`**/api/pools/${boardId}`, route => route.fulfill({ json: sample() }));
    await page.route(`**/api/pools/${boardId}/seller-links`, route => route.fulfill({ json: { links: [{ label: 'Sample seller', code: 'aaaaaaaaaaaaaaaa', url: 'https://example.test/s/aaaaaaaaaaaaaaaa' }] } }));
    await page.goto(`/boards/${boardId}`);
    expect(await page.locator('#workspace-board').evaluate(element => Boolean(element.compareDocumentPosition(document.getElementById('seller-links-heading')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await page.getByRole('button', { name: 'Select squares', exact: true }).click();
    const cell = page.getByRole('button', { name: /^Square 11,/ });
    await cell.click();
    await expect(cell).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => cell.evaluate(e => new DOMMatrix(getComputedStyle(e).transform).m42)).toBe(reduced ? 0 : -2);
    await page.getByRole('button', { name: 'Get seller links', exact: true }).click();
    await page.getByRole('button', { name: 'Preview Sample seller’s handoff' }).click();
    const preview = page.getByRole('region', { name: 'Sample seller’s handoff' });
    await expect(preview).toBeVisible();
    await expect(preview).toHaveCSS('animation-name', reduced ? 'none' : 'g-handoff-open');
    expect(await page.getByRole('textbox', { name: 'Handoff message for Sample seller' }).inputValue()).toContain('1, 2, 3, 4, 5, 6, 7, 8, 9, 10');
    await expect(page.getByText('Preview only. Nothing has been emailed.')).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`organizer-handoff-${reduced}.png`), fullPage: true });
  });
}
