import { expect, test, type Page } from '@playwright/test';

const authStorageKey = 'sb-illqymckwqiawdwxhwcy-auth-token';
const ownerId = '11111111-1111-4111-8111-111111111111';

const sessionValue = () => JSON.stringify({
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  expires_in: 60 * 60,
  token_type: 'bearer',
  user: {
    id: ownerId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'organizer@example.test',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-07-28T00:00:00.000Z',
  },
});

const installOrganizerSession = async (page: Page) => {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, { key: authStorageKey, value: sessionValue() });
};

const scheduledGame = {
  id: '401772510',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  state: 'pre',
  season: 2026,
  week: 1,
  awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' },
  homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
};

const quarterScores = {
  Q1: { left: 3, top: 7 },
  Q2: { left: 7, top: 7 },
  Q3: { left: 7, top: 3 },
  Q4: { left: 0, top: 7 },
  OT: { left: 0, top: 0 },
};

test('protected routes preserve the exact destination through sign-in', async ({ page }) => {
  await page.goto('/create?scoreTest=1');
  await expect(page).toHaveURL(/\/login\?returnTo=/);

  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: authStorageKey,
    value: sessionValue(),
  });
  await page.reload();

  await expect(page).toHaveURL(/\/create\?scoreTest=1$/);
});

test('organizer creates a board from one scheduled NFL event', async ({ page }) => {
  await installOrganizerSession(page);
  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ games: [scheduledGame] }),
  }));

  let submitted: any;
  await page.route('**/api/pools', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    submitted = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        poolId: ownerId,
        boardId: ownerId,
        shareCode: 'ABCDEFGH',
        revision: 1,
      }),
    });
  });

  await page.goto('/create');
  await page.getByLabel('Board name').fill('Week 1 fundraiser');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /DAL.*at.*WAS/i }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Create blank 10×10 board/i }).click();

  await expect(page.getByRole('heading', { name: /Your board is ready to fill/i })).toBeVisible();
  expect(submitted.game.gameExternalId).toBe(scheduledGame.id);
  expect(submitted.game.kickoffAt).toBe(scheduledGame.kickoffAt);
  expect(submitted.board.squares).toHaveLength(100);
});

test('published viewer renders the board and exact-name square finder', async ({ page }) => {
  const squares = Array.from({ length: 100 }, () => [] as string[]);
  squares[0] = ['Ann'];
  squares[1] = ['Anna'];
  const board = {
    bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    oppAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    squares,
    isDynamic: false,
    participants: [
      { id: 'participant-ann', displayName: 'Ann', publicLabel: 'AN' },
      { id: 'participant-anna', displayName: 'Anna', publicLabel: 'AN' },
    ],
  };
  const score = {
    leftScore: 17,
    topScore: 24,
    quarterScores,
    clock: '2:31',
    period: 4,
    state: 'in',
    detail: 'Fourth quarter',
    isOvertime: false,
    sourceName: 'ESPN',
    retrievedAt: '2026-09-13T20:15:00.000Z',
    staleAfter: '2099-09-13T20:16:00.000Z',
    freshness: 'fresh',
  };

  await page.route('**/api/pools/ABCDEFGH', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      share_code: 'ABCDEFGH',
      title: 'Published Week 1',
      revision: 7,
      published_at: '2026-09-12T20:00:00.000Z',
      leftAbbr: 'DAL',
      leftName: 'Dallas Cowboys',
      topAbbr: 'WAS',
      topName: 'Washington Commanders',
      gameExternalId: scheduledGame.id,
      kickoffAt: scheduledGame.kickoffAt,
      dates: '2026-09-13',
      board,
      score,
      winner_history: [],
      payouts: { Q1: 25, Q2: 25, Q3: 25, Final: 25 },
      is_activated: true,
      locked: false,
    }),
  }));
  await page.route('**/api/pools/ABCDEFGH/score', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ score, winnerHistory: [] }),
  }));

  await page.goto('/b/ABCDEFGH');
  await expect(page.getByRole('main', { name: /Published Week 1 game day/i })).toBeVisible();
  await expect(page.getByText(/This board is not published yet/i)).toHaveCount(0);
  await page.getByRole('button', { name: /Find my squares/i }).click();
  await page.getByLabel('Find Player:').selectOption('Ann');

  await expect(page.getByText('1 square', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: /^Ann,/ })).toHaveClass(/ring-cardinal/);
  await expect(page.getByRole('cell', { name: /^Anna,/ })).not.toHaveClass(/ring-cardinal/);
  await expect(page.getByText(/Quarter-winner email for Ann/i)).toBeVisible();
});

test('invalid public links show an explicit unavailable state', async ({ page }) => {
  await page.route('**/api/pools/BADLINK2', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'This board is unavailable or has not been published.' }),
  }));

  await page.goto('/b/BADLINK2');
  await expect(page.getByRole('alert')).toContainText('This link does not open a published GridOne board.');
});

test('organizer flushes the latest draft before publishing the viewer link', async ({ page }) => {
  await installOrganizerSession(page);
  const boardId = ownerId;
  const fullBoard = {
    bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    oppAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    squares: Array.from({ length: 100 }, () => ['Mora']),
    isDynamic: false,
  };
  const score = {
    leftScore: 0,
    topScore: 0,
    quarterScores: {
      Q1: { left: 0, top: 0 },
      Q2: { left: 0, top: 0 },
      Q3: { left: 0, top: 0 },
      Q4: { left: 0, top: 0 },
      OT: { left: 0, top: 0 },
    },
    clock: '',
    period: 0,
    state: 'pre',
    detail: 'Scheduled',
    isOvertime: false,
    sourceName: 'ESPN',
    retrievedAt: '2026-09-01T00:00:00.000Z',
    staleAfter: '2099-09-01T00:00:00.000Z',
    freshness: 'fresh',
  };
  const requestOrder: string[] = [];
  let savedTitle = '';

  await page.route(`**/api/pools/${boardId}`, async (route) => {
    if (route.request().method() === 'PUT') {
      requestOrder.push('save');
      const payload = route.request().postDataJSON();
      savedTitle = payload.game.title;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, revision: 2 }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: boardId,
        share_code: 'ABCDEFGH',
        owner_id: ownerId,
        title: 'Original title',
        status: 'ready',
        revision: 1,
        meta: 'Fundraiser',
        gameExternalId: scheduledGame.id,
        kickoffAt: scheduledGame.kickoffAt,
        dates: '2026-09-13',
        leftAbbr: 'DAL',
        leftName: 'Dallas Cowboys',
        topAbbr: 'WAS',
        topName: 'Washington Commanders',
        payouts: { Q1: 25, Q2: 25, Q3: 25, Final: 25 },
        board: fullBoard,
        score,
        is_activated: true,
        locked: false,
        published_at: null,
        winner_history: [],
      }),
    });
  });
  await page.route(`**/api/pools/${boardId}/score`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ score, winnerHistory: [] }),
  }));
  await page.route(`**/api/pools/${boardId}/publish`, (route) => {
    requestOrder.push('publish');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ published: true, shareCode: 'ABCDEFGH', viewerUrl: '/b/ABCDEFGH' }),
    });
  });
  await page.route('**/rest/v1/contest_entries*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ games: [scheduledGame] }),
  }));

  await page.goto(`/boards/${boardId}`);
  await page.getByRole('button', { name: 'Edit', exact: true }).last().click();
  await page.getByLabel('Board Name').fill('Latest title');
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('button', { name: /Publish viewer link/i }).click();

  await expect.poll(() => requestOrder).toEqual(['save', 'publish']);
  expect(savedTitle).toBe('Latest title');
});
