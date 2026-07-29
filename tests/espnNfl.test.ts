import { describe, expect, it, vi } from 'vitest';
import {
  espnSummaryUrl,
  fetchScheduledGameById,
  fetchScheduledGames,
  normalizeEspnEvent,
  normalizeEspnScoreSummary,
  normalizeTeamAbbreviation,
} from '../functions/_lib/espnNfl';
import {
  overtimeEspnSummary,
  regulationEspnSummary,
  scheduledEspnEvent,
} from './fixtures/espnNfl.fixture';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('ESPN NFL normalization', () => {
  it('normalizes a scheduled event and canonical team aliases', () => {
    expect(normalizeEspnEvent(scheduledEspnEvent)).toEqual({
      id: '401000003',
      kickoffAt: '2026-09-10T00:20:00.000Z',
      state: 'pre',
      season: 2026,
      week: 1,
      homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
      awayTeam: { abbr: 'JAX', name: 'Jacksonville Jaguars' },
    });
    expect(normalizeTeamAbbreviation('wsh')).toBe('WAS');
    expect(normalizeTeamAbbreviation('JAC')).toBe('JAX');
    expect(normalizeTeamAbbreviation('LA')).toBe('LAR');
    expect(normalizeTeamAbbreviation('KC')).toBe('KC');
  });

  it('normalizes regulation quarter scoring', () => {
    const score = normalizeEspnScoreSummary(regulationEspnSummary);
    expect(score).toMatchObject({
      eventId: '401000001',
      state: 'post',
      period: 4,
      homeTeam: {
        abbr: 'WAS',
        score: 27,
        quarterScores: { Q1: 7, Q2: 3, Q3: 10, Q4: 7, OT: 0 },
      },
      awayTeam: {
        abbr: 'DAL',
        score: 24,
        quarterScores: { Q1: 3, Q2: 7, Q3: 7, Q4: 7, OT: 0 },
      },
    });
  });

  it('normalizes an upcoming exact-event summary before ESPN publishes score fields', () => {
    const upcoming = structuredClone({ header: scheduledEspnEvent });
    delete (upcoming.header.competitions[0].competitors[0] as any).score;
    delete (upcoming.header.competitions[0].competitors[1] as any).score;
    expect(normalizeEspnScoreSummary(upcoming)).toMatchObject({
      state: 'pre',
      period: 0,
      homeTeam: { score: 0, quarterScores: { Q1: 0, Q2: 0, Q3: 0, Q4: 0, OT: 0 } },
      awayTeam: { score: 0, quarterScores: { Q1: 0, Q2: 0, Q3: 0, Q4: 0, OT: 0 } },
    });
  });

  it('aggregates every overtime period into OT', () => {
    const score = normalizeEspnScoreSummary(overtimeEspnSummary);
    expect(score.period).toBe(6);
    expect(score.homeTeam).toMatchObject({
      abbr: 'JAX',
      score: 26,
      quarterScores: { Q1: 3, Q2: 7, Q3: 3, Q4: 7, OT: 6 },
    });
    expect(score.awayTeam).toMatchObject({
      abbr: 'LAR',
      score: 20,
      quarterScores: { Q1: 0, Q2: 10, Q3: 3, Q4: 7, OT: 0 },
    });
  });

  it('rejects malformed identity, teams, dates, and inconsistent scores', () => {
    expect(() => normalizeEspnEvent({
      ...scheduledEspnEvent,
      id: '',
      competitions: [{ ...scheduledEspnEvent.competitions[0], id: '' }],
    })).toThrow(/event ID/i);
    expect(() => normalizeEspnEvent({
      ...scheduledEspnEvent,
      competitions: [{ ...scheduledEspnEvent.competitions[0], competitors: [] }],
    })).toThrow(/home and one away/i);
    expect(() => normalizeEspnEvent({ ...scheduledEspnEvent, date: 'bad', competitions: [{
      ...scheduledEspnEvent.competitions[0],
      date: 'bad',
    }] })).toThrow(/kickoff/i);
    const inconsistent = structuredClone(regulationEspnSummary);
    inconsistent.header.competitions[0].competitors[0].score = '99';
    expect(() => normalizeEspnScoreSummary(inconsistent)).toThrow(/did not match/i);
  });
});

describe('ESPN NFL schedule fetches', () => {
  it('returns upcoming games oldest first and excludes started games', async () => {
    const later = structuredClone(scheduledEspnEvent);
    later.id = '401000004';
    later.date = '2026-09-17T00:20:00Z';
    later.competitions[0].id = later.id;
    later.competitions[0].date = later.date;
    const completed = structuredClone(regulationEspnSummary.header);
    const fetchMock = vi.fn(async () => jsonResponse({ events: [later, completed, scheduledEspnEvent] }));

    const games = await fetchScheduledGames({
      scope: 'upcoming',
      limit: 10,
      now: new Date('2026-07-28T12:00:00Z'),
    }, fetchMock);

    expect(games.map((game) => game.id)).toEqual(['401000003', '401000004']);
    expect(String((fetchMock.mock.calls as any[][])[0][0])).toContain('dates=20260728-20270325');
  });

  it('returns only the requested number of most recent completed games', async () => {
    const completedEvents = Array.from({ length: 7 }, (_, index) => {
      const event = structuredClone(regulationEspnSummary.header);
      event.id = String(401000010 + index);
      event.competitions[0].id = event.id;
      event.competitions[0].date = `2026-01-${String(10 + index).padStart(2, '0')}T20:00:00Z`;
      return event;
    });
    const fetchMock = vi.fn(async () => jsonResponse({ events: completedEvents.reverse() }));
    const games = await fetchScheduledGames({
      scope: 'completed',
      limit: 5,
      now: new Date('2026-02-01T12:00:00Z'),
    }, fetchMock);

    expect(games).toHaveLength(5);
    expect(games.map((game) => game.id)).toEqual([
      '401000016',
      '401000015',
      '401000014',
      '401000013',
      '401000012',
    ]);
  });

  it('skips Pro Bowl and malformed feed entries instead of breaking the picker', async () => {
    const proBowl = structuredClone(regulationEspnSummary.header);
    proBowl.id = '401000099';
    proBowl.competitions[0].id = proBowl.id;
    proBowl.competitions[0].competitors[0].team = {
      abbreviation: 'AFC',
      displayName: 'AFC',
    };
    proBowl.competitions[0].competitors[1].team = {
      abbreviation: 'NFC',
      displayName: 'NFC',
    };
    const fetchMock = vi.fn(async () => jsonResponse({
      events: [{ broken: true }, proBowl, regulationEspnSummary.header],
    }));

    const games = await fetchScheduledGames({
      scope: 'completed',
      limit: 5,
      now: new Date('2026-02-01T12:00:00Z'),
    }, fetchMock);

    expect(games.map((game) => game.id)).toEqual(['401000001']);
  });

  it('resolves an exact event ID through the ESPN summary URL', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ header: scheduledEspnEvent }));
    await expect(fetchScheduledGameById('401000003', fetchMock)).resolves.toMatchObject({
      id: '401000003',
      homeTeam: { abbr: 'WAS' },
    });
    expect(fetchMock).toHaveBeenCalledWith(espnSummaryUrl('401000003'), {
      headers: { Accept: 'application/json' },
    });
  });

  it('separates invalid or missing exact events from malformed provider data', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 404));
    await expect(fetchScheduledGameById('not-an-id', fetchMock)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(fetchScheduledGameById('401999999', fetchMock)).resolves.toBeNull();

    const mismatchFetch = vi.fn(async () => jsonResponse({ header: scheduledEspnEvent }));
    await expect(fetchScheduledGameById('401999998', mismatchFetch)).rejects.toThrow(/different event/i);

    const malformedFetch = vi.fn(async () => jsonResponse({ header: {} }));
    await expect(fetchScheduledGameById('401999997', malformedFetch)).rejects.toThrow(/competition/i);
  });

  it('treats an all-malformed non-empty schedule as a provider failure', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      events: [{ broken: true }, { also: 'broken' }],
    }));
    await expect(fetchScheduledGames({
      scope: 'upcoming',
      now: new Date('2026-07-28T12:00:00Z'),
    }, fetchMock)).rejects.toThrow(/valid NFL games/i);
  });
});
