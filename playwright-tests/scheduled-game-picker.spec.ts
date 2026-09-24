import { expect, test, type Page } from '@playwright/test';

const authStorageKey = 'sb-illqymckwqiawdwxhwcy-auth-token';

const installOrganizerSession = async (page: Page) => {
  await page.addInitScript(({ key }) => {
    window.localStorage.setItem(key, JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      expires_in: 60 * 60,
      token_type: 'bearer',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'organizer@example.test',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-07-28T00:00:00.000Z',
      },
    }));
  }, { key: authStorageKey });
};

const upcomingGames = [{
  id: '401772510',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  state: 'pre',
  season: 2026,
  week: 1,
  awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' },
  homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
}];

test('board creation is one screen: name, matchup, and no independent date input', async ({ page }) => {
  await installOrganizerSession(page);
  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ games: upcomingGames }),
  }));

  await page.goto('/create');

  await expect(page.getByRole('heading', { name: 'Pick the game' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
  await expect(page.getByText('Game date (optional)')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /DAL.*at.*WAS/i })).not.toBeChecked();

  await page.getByLabel('Board name').fill('Week 1 fundraiser');
  await expect(page.getByRole('button', { name: 'Create board' })).toBeDisabled();

  await page.getByRole('radio', { name: /DAL.*at.*WAS/i }).click();
  await expect(page.getByRole('button', { name: 'Create board' })).toBeEnabled();
});

test('Create board stays disabled until both the name and the matchup are set', async ({ page }) => {
  await installOrganizerSession(page);
  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ games: upcomingGames }),
  }));

  await page.goto('/create');
  const create = page.getByRole('button', { name: 'Create board' });
  await expect(create).toBeDisabled();

  await page.getByRole('radio', { name: /DAL.*at.*WAS/i }).click();
  await expect(create).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('Dallas Cowboys at Washington Commanders');

  await page.getByLabel('Board name').fill('Week 1 fundraiser');
  await expect(create).toBeEnabled();
});

test('hidden score-test mode requests at most five completed games', async ({ page }) => {
  await installOrganizerSession(page);
  const scheduleRequest = page.waitForRequest((request) =>
    request.url().includes('/api/nfl/games?')
    && request.url().includes('scope=completed')
    && request.url().includes('limit=5'));
  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      games: upcomingGames.map((game) => ({ ...game, state: 'post' })),
      scoreTestMode: true,
    }),
  }));

  await page.goto('/create?scoreTest=1');

  await scheduleRequest;
  await expect(page.getByText('Completed-game score test')).toBeVisible();
  await expect(page.getByText(/five most recent final games/i)).toBeVisible();
});

test('score-test query stays on ordinary upcoming UX without server capability', async ({ page }) => {
  await installOrganizerSession(page);
  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ games: upcomingGames }),
  }));

  await page.goto('/create?scoreTest=1');

  await expect(page.getByRole('radio', { name: /DAL.*at.*WAS/i })).toBeVisible();
  await expect(page.getByText('Completed-game score test')).toHaveCount(0);
});

test('matchup selection works by keyboard on a phone-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installOrganizerSession(page);
  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ games: upcomingGames }),
  }));

  await page.goto('/create');
  await page.getByLabel('Board name').fill('Keyboard board');

  const matchup = page.getByRole('radio', { name: /DAL.*at.*WAS/i });
  await matchup.focus();
  await page.keyboard.press('Space');

  await expect(page.getByRole('status')).toContainText('Dallas Cowboys at Washington Commanders');
  await expect(page.getByRole('button', { name: 'Change game' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Create board' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});


const user = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated', role: 'authenticated', email: 'organizer@example.test',
  app_metadata: {}, user_metadata: {}, created_at: '2026-08-22T00:00:00.000Z',
};
const games = Array.from({ length: 50 }, (_, index) => ({
  id: `scheduled-${index}`,
  kickoffAt: new Date(Date.UTC(2026, 8, 10 + Math.floor(index / 16) * 7, 0, 20)).toISOString(),
  state: 'pre', season: 2026, week: Math.floor(index / 16) + 1,
  awayTeam: { abbr: index === 0 ? 'NE' : `A${index}`, name: index === 0 ? 'New England Patriots' : `Away team ${index}` },
  homeTeam: { abbr: index === 0 ? 'SEA' : `H${index}`, name: index === 0 ? 'Seattle Seahawks' : `Home team ${index}` },
}));

for (const width of [390, 1440]) {
  test(`selected game keeps Create board in view at ${width}px with a 50-game slate`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(({ user }) => {
      localStorage.setItem('sb-illqymckwqiawdwxhwcy-auth-token', JSON.stringify({
        access_token: 'test-access-token', refresh_token: 'test-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600,
        token_type: 'bearer', user,
      }));
    }, { user });
    await page.route('https://illqymckwqiawdwxhwcy.supabase.co/**', route => route.fulfill({ json: user }));
    await page.route('**/api/nfl/games?**', route => route.fulfill({ json: { games } }));
    await page.goto('/create');
    await page.getByRole('textbox', { name: 'Board name' }).fill('Game One test');
    await expect(page.getByRole('radio')).toHaveCount(16);
    await page.getByRole('radio').first().click();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('New England Patriots at Seattle Seahawks');
    const create = page.getByRole('button', { name: 'Create board', exact: true });
    await expect(create).toBeEnabled();
    await expect(create).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Change game' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`create-selected-${width}.png`), fullPage: true });

    // Reopen by keyboard, change the native week select, then choose by keyboard.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('radio').first()).toBeFocused();
    const week = page.getByRole('combobox', { name: 'NFL week' });
    await week.focus();
    await expect(week).toBeFocused();
    await week.selectOption('2026:2');
    await expect(week).toHaveValue('2026:2');
    await page.getByRole('radio').first().focus();
    await expect(page.getByRole('radio').first()).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('status')).toContainText('Away team 16 at Home team 16');
    await expect(page.getByRole('status')).toContainText('Week 2');
    await expect(create).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Change game' })).toBeFocused();
  });
}
