import { expect, test, type Page } from '@playwright/test';

const authStorageKey = 'sb-illqymckwqiawdwxhwcy-auth-token';
const ownerId = '11111111-1111-4111-8111-111111111111';
const boardId = '22222222-2222-4222-8222-222222222222';

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
    created_at: '2026-08-22T00:00:00.000Z',
  },
});

const scheduledGame = {
  id: '401772510',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  state: 'pre',
  season: 2026,
  week: 1,
  awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' },
  homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
};

const installOrganizerSession = async (page: Page) => {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, { key: authStorageKey, value: sessionValue() });
};

/**
 * Every network the organizer surfaces touch is answered here, so the suite
 * never needs the functions server: the board row, its score, publishing, the
 * organizer-only plan summary, owner entry metadata, and the NFL schedule.
 */
const installOrganizerBoard = async (page: Page, persistEdits = false) => {
  const saved = {
    revision: 1,
    game: {} as Record<string, unknown>,
    payouts: {} as Record<string, string>,
    writes: [] as Array<{ method: string; revision: number }>,
    conflicts: 0,
  };
  await installOrganizerSession(page);

  const squares = Array.from({ length: 100 }, (_, index) => (index === 0 ? ['Ava'] : ([] as string[])));
  const board = {
    leftAxis: Array(10).fill(null),
    topAxis: Array(10).fill(null),
    squares,
    isDynamic: false,
    allowOpenSquares: true,
    participants: [{ id: 'p1', displayName: 'Ava', publicLabel: 'Ava' }],
  };

  await page.route(`**/api/pools/${boardId}/score`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ score: null, winnerHistory: [] }),
  }));
  await page.route(`**/api/pools/${boardId}/publish`, (route) => route.fulfill(!Number.isInteger(route.request().postDataJSON()?.revision) ? {
    status: 409,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'A current board revision is required.' }),
  } : {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ published: true, shareCode: 'SHARE123', viewerUrl: '/b/SHARE123', revision: 2, tier: 'free', used: 1, allowance: 1 }),
  }));
  await page.route(`**/api/pools/${boardId}`, (route) => {
    const method = route.request().method();
    if (persistEdits && (method === 'PUT' || method === 'PATCH')) {
      const body = route.request().postDataJSON();
      saved.writes.push({ method, revision: body.revision });
      if (body.revision !== saved.revision) {
        saved.conflicts += 1;
        return route.fulfill({ status: 409, json: {
          error: 'This board changed in another session. Reload before saving again.',
          code: 'REVISION_CONFLICT', currentRevision: saved.revision,
        } });
      }
      if (method === 'PUT') saved.game = body.game;
      else saved.payouts = body.payoutDescriptions;
      saved.revision += 1;
      return route.fulfill({ json: { ok: true, revision: saved.revision, payoutDescriptions: saved.payouts } });
    }
    if (method === 'PUT') {
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
        share_code: 'SHARE123',
        owner_id: ownerId,
        title: 'Parkside browser board',
        revision: 1,
        meta: 'Parkside fundraiser',
        gameExternalId: scheduledGame.id,
        kickoffAt: scheduledGame.kickoffAt,
        dates: '2026-09-13',
        leftAbbr: 'DAL',
        leftName: 'Dallas Cowboys',
        topAbbr: 'WAS',
        topName: 'Washington Commanders',
        payoutDescriptions: {},
        board,
        is_activated: false,
        locked: true,
        published_at: null,
        winner_history: [],
        pending_milestones: [],
        notification_delivery_issues: [],
        ...(persistEdits ? { ...saved.game, revision: saved.revision, payoutDescriptions: saved.payouts } : {}),
      }),
    });
  });
  await page.route('**/api/billing/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ tier: 'free', used: 0, allowance: 1 }),
  }));
  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ games: [scheduledGame] }),
  }));
  await page.route('**/rest/v1/contest_entries*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  return saved;
};

test.describe('organizer workspace contract', () => {
  test('create route previews before account creation', async ({ page }) => {
    await page.goto('/create');

    await expect(page).toHaveURL(/\/create/);
    await expect(page.getByRole('region', { name: 'Board preview' })).toBeVisible();
  });

  test('dashboard lists the organizer boards and links into the workspace', async ({ page }) => {
    await installOrganizerBoard(page);
    await page.route('**/rest/v1/contests*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: boardId,
        title: 'Parkside browser board',
        created_at: '2026-08-22T00:00:00.000Z',
        settings: { leftAbbr: 'DAL', topAbbr: 'WAS' },
        board_data: { leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), squares: Array.from({ length: 100 }, (_, index) => (index === 0 ? ['Ava'] : [])) },
        published_at: null,
        board_activations: [],
      }]),
    }));

    await page.goto('/dashboard');

    const main = page.getByRole('main', { name: 'Your boards' });
    await expect(main).toBeVisible();
    await expect(main.getByRole('heading', { level: 1, name: 'Your boards' })).toBeVisible();
    await expect(main.getByText('0 of 1 published · Free')).toBeVisible();
    await expect(main.getByRole('link', { name: 'New board' }).first()).toBeVisible();

    await main.getByRole('link', { name: 'Parkside browser board', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/boards/${boardId}$`));
    await expect(page.getByRole('main', { name: 'Parkside browser board workspace' })).toBeVisible();
  });

  test('workspace opens on the board with its header, island, and no phone overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installOrganizerBoard(page);

    await page.goto(`/boards/${boardId}`);

    await expect(page.getByRole('main', { name: 'Parkside browser board workspace' })).toBeVisible();
    await expect(page.getByLabel('Board name')).toHaveValue('Parkside browser board');
    await expect(page.getByRole('button', { name: 'Change game' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Square 1, assigned to Ava' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Square 2, unassigned' })).toBeVisible();

    await expect(page.getByRole('region', { name: 'Organizer status' })).toBeVisible();
    // The next step is available without expanding organizer status.
    await expect(page.getByRole('button', { name: 'Prepare to publish' })).toBeVisible();

    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const offenders = Array.from(document.body.querySelectorAll<HTMLElement>('*'))
        .filter((element) => !element.closest('[data-testid="contained-board-overflow"]'))
        .filter((element) => element.getBoundingClientRect().right > width + 1)
        .map((element) => ({ tag: element.tagName, className: typeof element.className === 'string' ? element.className : '' }));
      window.scrollTo(999, 0);
      return {
        amount: document.documentElement.scrollWidth - width,
        windowScrollX: window.scrollX,
        offenders,
      };
    });
    expect(overflow.amount, JSON.stringify(overflow)).toBe(0);
    expect(overflow.windowScrollX).toBe(0);
    expect(overflow.offenders).toEqual([]);
  });

  test('the change-game sheet loads the schedule once and applies the picked matchup', async ({ page }) => {
    await installOrganizerBoard(page);
    let scheduleRequests = 0;
    await page.route('**/api/nfl/games?**', (route) => {
      scheduleRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          games: [scheduledGame, {
            ...scheduledGame,
            id: '401772511',
            awayTeam: { abbr: 'PHI', name: 'Philadelphia Eagles' },
            homeTeam: { abbr: 'NYG', name: 'New York Giants' },
          }],
        }),
      });
    });

    await page.goto(`/boards/${boardId}`);
    await expect(page.getByRole('main', { name: 'Parkside browser board workspace' })).toBeVisible();
    expect(scheduleRequests).toBe(0);

    await page.getByRole('button', { name: 'Change game' }).click();
    const sheet = page.getByRole('dialog', { name: 'Pick the game' });
    await expect(sheet).toBeVisible();
    expect(scheduleRequests).toBeGreaterThan(0);

    // The sheet closes on selection, so the radio unmounts before check() could verify it.
    await sheet.getByRole('radio', { name: /PHI.*at.*NYG/i }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText(/PHI at NYG/)).toBeVisible();
  });
});


test('payout rules save beside a pending board edit and survive reload without revision conflict', async ({ page }) => {
  const saved = await installOrganizerBoard(page, true);
  await page.goto(`/boards/${boardId}`);
  await expect(page.getByRole('main', { name: 'Parkside browser board workspace' })).toBeVisible();
  for (const label of ['Q1', 'Halftime', 'Q3', 'Final']) {
    await page.getByRole('textbox', { name: label, exact: true }).fill('$100');
  }
  const notes = 'Test board. Each quarter pays $100; organizer handles payment.';
  await page.getByRole('textbox', { name: 'Board rules', exact: true }).fill(notes);
  await expect(page.getByRole('status').filter({ hasText: 'Unsaved payout rules' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Board name', exact: true }).fill('Payout persistence test');
  await page.getByRole('textbox', { name: 'Board name', exact: true }).press('Tab');
  await expect(page.getByRole('main', { name: 'Payout persistence test workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Save payout rules', exact: true }).click();
  await expect.poll(() => saved.payouts).toEqual({ Q1: '$100', HALF: '$100', Q3: '$100', FINAL: '$100', notes });
  await expect(page.getByRole('status').filter({ hasText: 'Unsaved payout rules' })).toHaveCount(0);
  expect(saved.conflicts).toBe(0);
  expect(saved.writes).toEqual([{ method: 'PUT', revision: 1 }, { method: 'PATCH', revision: 2 }]);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Board name', exact: true })).toHaveValue('Payout persistence test');
  for (const label of ['Q1', 'Halftime', 'Q3', 'Final']) {
    await expect(page.getByRole('textbox', { name: label, exact: true })).toHaveValue('$100');
  }
  await expect(page.getByRole('textbox', { name: 'Board rules', exact: true })).toHaveValue(notes);
  expect(saved.conflicts).toBe(0);
});
