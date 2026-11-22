import { expect, test } from '@playwright/test';

const code = 'HARKTEST';
const digits = [0,1,2,3,4,5,6,7,8,9];
const shift = (first: number) => [...digits.slice(first), ...digits.slice(0, first)];
const score = {
  topScore: 14, leftScore: 17,
  quarterScores: { Q1:{ top:7, left:3 }, Q2:{ top:7, left:14 }, Q3:{ top:0, left:0 }, Q4:{ top:0, left:0 }, OT:{ top:0, left:0 } },
  clock:'2:31', period:2, state:'in', detail:'Second quarter', isOvertime:false, freshness:'fresh',
  retrievedAt: '2026-09-13T18:15:00.000Z', staleAfter: '2099-09-13T18:18:00.000Z',
};

for (const isDynamic of [false, true]) {
  test(`signed-out published board remembers a name and focuses the same physical square (${isDynamic ? 'quarter numbers' : 'one set'})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: testInfo.repeatEachIndex % 2 === 0 ? 390 : 1280, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date("2026-09-13T18:16:00.000Z"));
    const apiWrites: string[] = [];
    await page.route('**/api/**', route => {
      const request = route.request();
      if (!['GET','HEAD'].includes(request.method()) && new URL(request.url()).pathname !== '/api/events') apiWrites.push(request.method() + ' ' + new URL(request.url()).pathname);
      return route.fulfill({ status: 404, json: {} });
    });
    const board = {
      leftAxis: digits, topAxis: digits,
      isDynamic,
      ...(isDynamic ? {
        topAxisByQuarter: { Q1: shift(1), Q2: shift(4), Q3: shift(2), Q4: shift(9) },
        leftAxisByQuarter: { Q1: shift(3), Q2: shift(7), Q3: shift(8), Q4: shift(2) },
      } : {}),
      squares: Array.from({ length: 100 }, (_, index) => index === 0 ? ['Jamie'] : []),
      participants: [{ id: 'test-participant-jamie', displayName: 'Jamie', publicLabel: 'Jamie' }],
      allowOpenSquares: true,
    };
    await page.route(`**/api/pools/${code}`, route => route.fulfill({ json: {
      share_code: code, title:'Test board', revision:1, published_at:'2026-09-13T15:00:00.000Z',
      leftAbbr:'DAL', leftName:'Dallas Cowboys', topAbbr:'WAS', topName:'Washington Commanders',
      kickoffAt:'2026-09-13T17:00:00.000Z', gameExternalId:'401234567',
      board, score, winner_history:[], pending_milestones:[], payoutDescriptions:{}, is_activated:true, locked:false,
    } }));
    await page.route(`**/api/pools/${code}/score`, route => route.fulfill({ json: { score, winnerHistory:[], pendingMilestones:[] } }));

    await page.goto(`/b/${code}`);
    await page.getByRole('button', { name:'Find my squares', exact:true }).click();
    await page.getByRole('dialog', { name:'Find my squares' }).getByRole('button', { name:'Jamie', exact:true }).click();
    await page.reload();
    const summary = page.getByTestId('game-day-glance').getByRole('region', { name:'Jamie square summary' });
    const top = isDynamic ? 4 : 0;
    const left = isDynamic ? 7 : 0;
    const view = summary.getByRole('button', { name:`View on board top ${top} side ${left}`, exact:true });
    await expect(view).toBeInViewport({ ratio: 1 });
    if (isDynamic) {
      await expect(summary).toContainText('Your square matches the current score.');
      await page.getByRole('group', { name:'Quarter numbers' }).getByRole('button', { name:'1st', exact:true }).click();
      await expect(page.getByText(/Showing 1st numbers/)).toBeVisible();
    } else await expect(summary).toContainText('No current score match.');

    await view.press('Enter');
    const namedCell = page.getByRole('gridcell', { name: new RegExp(`Jamie.*coordinate row 1 column 1.*top digit ${top}.*side digit ${left}`, 'i') });
    await expect(namedCell).toBeFocused();
    await expect(namedCell).toBeInViewport({ ratio: 1 });
    if (isDynamic) {
      await expect(page.getByText(/Showing 2nd numbers/)).toBeVisible();
      await expect(namedCell).toHaveAttribute('data-current', 'true');
    }
    await expect(page.getByRole('gridcell')).toHaveCount(100);
    expect(apiWrites).toEqual([]);
  });
}
