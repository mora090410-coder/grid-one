import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchScheduledGames } from '../functions/_lib/espnNfl';
import { regulationEspnSummary, scheduledEspnEvent } from './fixtures/espnNfl.fixture';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const schedule = (events: unknown[]) => jsonResponse({
  content: {
    schedule: { 20260910: { games: events } },
    calendar: [{
      value: '2',
      entries: [
        { value: '1', startDate: '2026-09-08T00:00:00Z', endDate: '2026-09-15T23:59:59Z' },
        { value: '2', startDate: '2026-09-16T00:00:00Z', endDate: '2026-09-22T23:59:59Z' },
        { value: '3', startDate: '2026-09-23T00:00:00Z', endDate: '2026-09-29T23:59:59Z' },
      ],
    }],
  },
});

afterEach(() => vi.restoreAllMocks());

describe('upcoming schedule resilience', () => {
  it.each([
    ['HTTP failure after retry', () => jsonResponse({}, 503)],
    ['timeout', () => { throw new DOMException('Request timed out', 'TimeoutError'); }],
    ['invalid JSON', () => new Response('<html>Unavailable</html>')],
    ['missing schedule envelope', () => jsonResponse({ content: {} })],
  ])('keeps verified upcoming games when a later week has %s', async (_label, failedWeek) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const requested: string[] = [];
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      requested.push(url);
      if (url.includes('week=')) return failedWeek();
      return schedule([scheduledEspnEvent, regulationEspnSummary.header, { malformed: true }]);
    };

    const games = await fetchScheduledGames({
      scope: 'upcoming', limit: 50, now: new Date('2026-09-09T12:00:00Z'),
    }, fetchImpl);

    expect(games).toEqual([{
      id: '401000003', kickoffAt: '2026-09-10T00:20:00.000Z', state: 'pre',
      season: 2026, week: 1,
      homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
      awayTeam: { abbr: 'JAX', name: 'Jacksonville Jaguars' },
    }]);
    // Stop at the gap instead of making later games look like the next slate.
    expect(requested.some(url => url.includes('week=3'))).toBe(false);
  });

  it('retains the sorted, deduplicated games from successful expansion before a later failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const nextWeek = structuredClone(scheduledEspnEvent);
    nextWeek.id = '401000004';
    nextWeek.competitions[0].id = nextWeek.id;
    nextWeek.date = '2026-09-17T00:20:00Z';
    nextWeek.competitions[0].date = nextWeek.date;
    nextWeek.week = { number: 2 };
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('week=3')) return jsonResponse({}, 403);
      if (url.includes('week=2')) return schedule([nextWeek, scheduledEspnEvent]);
      return schedule([scheduledEspnEvent]);
    };

    const games = await fetchScheduledGames({
      scope: 'upcoming', limit: 50, now: new Date('2026-09-09T12:00:00Z'),
    }, fetchImpl);

    expect(games.map(game => [game.id, game.kickoffAt])).toEqual([
      ['401000003', '2026-09-10T00:20:00.000Z'],
      ['401000004', '2026-09-17T00:20:00.000Z'],
    ]);
  });

  it('still fails when no eligible upcoming game was obtained before the failed week', async () => {
    const fetchImpl = async (input: string | URL | Request) => String(input).includes('week=')
      ? jsonResponse({}, 403)
      : schedule([regulationEspnSummary.header, scheduledEspnEvent]);
    await expect(fetchScheduledGames({
      scope: 'upcoming', now: new Date('2026-09-11T12:00:00Z'),
    }, fetchImpl)).rejects.toThrow('HTTP 403');
  });

  it('does not turn failure of the initial schedule request into an empty success', async () => {
    await expect(fetchScheduledGames({
      scope: 'upcoming', now: new Date('2026-09-09T12:00:00Z'),
    }, async () => jsonResponse({}, 403))).rejects.toThrow('HTTP 403');
  });

  it('keeps completed-game discovery strict if an earlier week fails', async () => {
    const fetchImpl = async (input: string | URL | Request) => String(input).includes('week=')
      ? jsonResponse({}, 403)
      : schedule([regulationEspnSummary.header]);
    await expect(fetchScheduledGames({
      scope: 'completed', now: new Date('2026-09-25T12:00:00Z'),
    }, fetchImpl)).rejects.toThrow('HTTP 403');
  });
});
