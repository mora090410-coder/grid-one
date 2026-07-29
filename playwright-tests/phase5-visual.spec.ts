import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const capturePhase = process.env.PHASE5_CAPTURE;
if (capturePhase && capturePhase !== 'before' && capturePhase !== 'after') {
  throw new Error('Set PHASE5_CAPTURE to exactly "before" or "after".');
}
const captureEnabled = capturePhase === 'before' || capturePhase === 'after';

const captureDirectory = path.resolve(
  'docs/audits/phase5-design-refresh-2026-07-29',
  capturePhase || 'disabled',
);
if (captureEnabled) mkdirSync(captureDirectory, { recursive: true });

test.skip(!captureEnabled, 'Set PHASE5_CAPTURE to "before" or "after" to write visual review artifacts.');

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

const waitForStableVisuals = async (page: Page) => {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
};

const capture = async (
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {},
) => {
  await waitForStableVisuals(page);
  await page.screenshot({
    path: path.join(captureDirectory, name),
    fullPage: options.fullPage,
    animations: 'disabled',
    caret: 'hide',
  });
};

const installOrganizerSession = async (page: Page) => {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
    window.localStorage.setItem('gridone_preview_mode', 'false');
  }, { key: authStorageKey, value: sessionValue() });
};

const installOrganizerFixture = async (
  page: Page,
  phase: 'fill' | 'draw',
) => {
  await installOrganizerSession(page);

  const squares = phase === 'fill'
    ? Array.from({ length: 100 }, () => [] as string[])
    : Array.from({ length: 100 }, (_, index) => [`Player ${String(index + 1).padStart(3, '0')}`]);
  const axes = phase === 'fill'
    ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    : Array.from({ length: 10 }, () => null);
  const board = {
    bearsAxis: axes,
    oppAxis: [...axes].reverse(),
    squares,
    isDynamic: false,
  };

  await page.route(`**/api/pools/${ownerId}/score`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ score, winnerHistory: [] }),
  }));
  await page.route(`**/api/pools/${ownerId}`, async (route) => {
    if (route.request().method() === 'PUT') {
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
        id: ownerId,
        share_code: 'ABCDEFGH',
        owner_id: ownerId,
        title: phase === 'fill' ? 'Week 1 Fill Board' : 'Week 1 Draw Board',
        status: 'draft',
        revision: 1,
        meta: 'Parkside fundraiser',
        gameExternalId: scheduledGame.id,
        kickoffAt: scheduledGame.kickoffAt,
        dates: '2026-09-13',
        leftAbbr: 'DAL',
        leftName: 'Dallas Cowboys',
        topAbbr: 'WAS',
        topName: 'Washington Commanders',
        payouts: { Q1: 25, Q2: 25, Q3: 25, Final: 25 },
        board,
        score: phase === 'draw' ? score : null,
        is_activated: phase === 'draw',
        locked: phase === 'fill',
        published_at: null,
        winner_history: [],
      }),
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
};

const installPublishedViewerFixture = async (page: Page) => {
  const squares = Array.from({ length: 100 }, () => [] as string[]);
  squares[0] = ['Ann'];
  squares[1] = ['Anna'];
  squares[24] = ['Mora'];
  const board = {
    bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    oppAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    squares,
    isDynamic: false,
    participants: [
      { id: 'participant-ann', displayName: 'Ann', publicLabel: 'AN' },
      { id: 'participant-anna', displayName: 'Anna', publicLabel: 'AN' },
      { id: 'participant-mora', displayName: 'Mora', publicLabel: 'MO' },
    ],
  };

  await page.route('**/api/pools/ABCDEFGH/score', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ score, winnerHistory: [] }),
  }));
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
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('capture landing desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /The board watches the game/i })).toBeVisible();
  await capture(page, 'landing-desktop.png', { fullPage: true });
});

test('capture organizer Fill desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installOrganizerFixture(page, 'fill');
  await page.goto(`/boards/${ownerId}`);
  await page.getByRole('button', { name: 'Assign 100 squares' }).click();
  await expect(page.getByRole('heading', { name: 'Grid Editor' })).toBeVisible();
  await expect(page.getByLabel('Label to apply')).toBeFocused();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await capture(page, 'organizer-fill-desktop.png');
});

test('capture organizer Draw desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installOrganizerFixture(page, 'draw');
  await page.goto(`/boards/${ownerId}`);
  await page.getByRole('button', { name: 'Draw board numbers' }).click();
  await expect(page.getByRole('heading', { name: 'Draw both 0–9 axes once.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draw numbers' })).toBeEnabled();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await capture(page, 'organizer-draw-desktop.png');
});

test('capture published viewer phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installPublishedViewerFixture(page);
  await page.goto('/b/ABCDEFGH');
  await expect(page.getByRole('main', { name: /Published Week 1 game day/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Find my squares/i }).first()).toBeVisible();
  await capture(page, 'viewer-phone.png');
});

test('capture Find my squares dialog phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installPublishedViewerFixture(page);
  await page.goto('/b/ABCDEFGH');
  const trigger = page.getByRole('button', { name: /Find my squares/i }).first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Find my squares' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await capture(page, 'find-squares-dialog-phone.png');
});
