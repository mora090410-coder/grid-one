import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  boardId,
  installOrganizerBoard,
  installOrganizerContests,
  installOrganizerSession,
  installOrganizerSupport,
} from './helpers/organizerMocks';

/**
 * Automated WCAG sweep over every redesigned surface. Serious and critical
 * violations fail the build; moderate and minor counts are printed as an
 * annotation so a regression is visible without blocking on axe's judgement
 * calls about decorative structure.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Several surfaces reveal content on scroll, so analysing straight after the
 * first paint would sweep a mostly empty document. Walk the page to the bottom,
 * come back to the top, and let the reveal transitions settle first.
 */
const settle = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let offset = 0; offset < height; offset += 600) {
    await page.evaluate((y) => window.scrollTo(0, y), offset);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  // Scrolling triggers the lazy homepage chunks; wait for them to land before analysing.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
};

const runAxe = async (page: Page, testInfo: TestInfo) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  await testInfo.attach('axe-violations.json', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  const byImpact = (impact: string) => results.violations.filter((violation) => violation.impact === impact);
  const critical = byImpact('critical');
  const serious = byImpact('serious');

  testInfo.annotations.push({
    type: 'axe',
    description: `${testInfo.title}: moderate=${byImpact('moderate').length} minor=${byImpact('minor').length}`,
  });

  const describe = (list: typeof results.violations) => list
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`)
    .join('\n');

  expect(critical, `critical violations:\n${describe(critical)}`).toEqual([]);
  expect(serious, `serious violations:\n${describe(serious)}`).toEqual([]);
};

test.describe('axe accessibility sweep', () => {
  const publicRoutes: Array<[string, string]> = [
    ['homepage', '/'],
    ['demo board', '/demo'],
    ['articles hub', '/articles'],
    ['article', '/articles/how-football-squares-work'],
    ['login', '/login'],
    ['privacy', '/privacy'],
    ['not found', '/this-route-does-not-exist'],
  ];

  for (const [name, path] of publicRoutes) {
    test(`${name} (${path}) has no serious or critical violations`, async ({ page }, testInfo) => {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await settle(page);
      await runAxe(page, testInfo);
    });
  }

  test('dashboard has no serious or critical violations', async ({ page }, testInfo) => {
    await installOrganizerSession(page);
    await installOrganizerSupport(page);
    await installOrganizerContests(page);

    await page.goto('/dashboard');
    await expect(page.getByRole('main', { name: 'Your boards' })).toBeVisible();
    await settle(page);
    await runAxe(page, testInfo);
  });

  test('create has no serious or critical violations', async ({ page }, testInfo) => {
    await installOrganizerSession(page);
    await installOrganizerSupport(page);

    await page.goto('/create');
    // A create-specific landmark, so an unauthenticated redirect to /login can
    // never be scanned in place of the create route.
    await expect(page.getByRole('heading', { level: 1, name: 'Start with your team.' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await settle(page);
    await runAxe(page, testInfo);
  });

  test('draft workspace has no serious or critical violations', async ({ page }, testInfo) => {
    await installOrganizerBoard(page);

    await page.goto(`/boards/${boardId}`);
    await expect(page.getByRole('main', { name: 'Parkside browser board workspace' })).toBeVisible();
    await settle(page);
    await runAxe(page, testInfo);
  });
});
