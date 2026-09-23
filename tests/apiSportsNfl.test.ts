import { describe, expect, it, vi } from 'vitest';
import { fetchApiSportsScoreboard, findApiSportsGame, providerScoreFromApiSportsGame } from '../functions/_lib/apiSportsNfl';

const contest = { side_team_abbr: 'CHI', top_team_abbr: 'CAR', game_starts_at: '2026-09-13T17:00:00Z' };
const observedAt = '2026-09-13T18:30:00Z';
const game = () => ({
  game: { id: 123, date: { timestamp: 1789318800 }, status: { short: 'HT', timer: null } },
  league: { id: 1, name: 'NFL' },
  teams: { home: { name: 'Carolina Panthers' }, away: { name: 'Chicago Bears' } },
  scores: {
    home: { quarter_1: 7, quarter_2: 17, quarter_3: null, quarter_4: null, overtime: null, total: 24 },
    away: { quarter_1: 14, quarter_2: 17, quarter_3: null, quarter_4: null, overtime: null, total: 31 },
  },
});

describe('API-Sports NFL independent provider', () => {
  it('orients an explicitly identified halftime game and retains its observation time', () => {
    const result = providerScoreFromApiSportsGame(contest, game(), '2026-09-13T18:30:00Z');
    expect(result).toMatchObject({ provider: 'api-sports', source: { uri: 'https://api-sports.io/sports/nfl' }, score: { leftScore: 31, topScore: 24, period: 2, detail: 'Halftime', state: 'in', sourceObservedAt: '2026-09-13T18:30:00.000Z', quarterScores: { Q2: { left: 17, top: 17 }, Q3: { left: 0, top: 0 } } } });
  });
  it('rejects wrong kickoff, home/away, league, unknown teams and ambiguous matches', () => {
    for (const mutate of [
      (g: any) => g.game.date.timestamp++, (g: any) => g.league.id = 2,
      (g: any) => g.teams.home.name = 'Chicago Bears', (g: any) => g.teams.away.name = 'Bears',
    ]) { const g = game(); mutate(g); expect(() => providerScoreFromApiSportsGame(contest, g, observedAt)).toThrow(); }
    expect(() => findApiSportsGame(contest, [game(), game()])).toThrow(/ambiguous/i);
    expect(() => findApiSportsGame(contest, [])).toThrow();
    expect(findApiSportsGame(contest, [game()])).toEqual(game());
  });
  it('rejects missing played quarters, contradictory totals, and unsupported status', () => {
    for (const mutate of [
      (g: any) => g.scores.away.quarter_2 = null, (g: any) => g.scores.away.total++,
      (g: any) => g.game.status.short = 'PST', (g: any) => g.scores.home.quarter_3 = 7,
    ]) { const g = game(); mutate(g); expect(() => providerScoreFromApiSportsGame(contest, g, observedAt)).toThrow(); }
  });
  it.each(['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'FT', 'AOT', 'NS'])('handles %s', status => {
    const g: any = game(); g.game.status.short = status;
    for (const side of ['home', 'away']) g.scores[side] = { quarter_1: 0, quarter_2: 0, quarter_3: 0, quarter_4: 0, overtime: 0, total: 0 };
    const result = providerScoreFromApiSportsGame(contest, g, observedAt);
    expect(result.score.state).toBe(status === 'NS' ? 'pre' : ['FT', 'AOT'].includes(status) ? 'post' : 'in');
  });
  it('accepts null pregame scores but rejects missing played overtime', () => {
    const g: any = game(); g.game.status.short = 'NS';
    for (const side of ['home', 'away']) for (const field of Object.keys(g.scores[side])) g.scores[side][field] = null;
    expect(providerScoreFromApiSportsGame(contest, g, observedAt).score.leftScore).toBe(0);
    g.game.status.short = 'AOT';
    expect(() => providerScoreFromApiSportsGame(contest, g, observedAt)).toThrow();
    expect(() => providerScoreFromApiSportsGame(contest, game(), '')).toThrow(/observation/);
  });
  it('does not repeat sensitive API error bodies', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: { token: 'private-test-key' }, response: [] })));
    await expect(fetchApiSportsScoreboard('2026-09-13', 'private-test-key', fetcher)).rejects.toThrow('API-Sports returned an invalid scoreboard or provider error.');
  });
  it('uses a server-only key header and returns a reusable daily batch', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [], response: [game()] })));
    const result = await fetchApiSportsScoreboard('2026-09-13', 'test-key', fetcher);
    expect(result.games).toEqual([game()]);
    expect(fetcher.mock.calls[0][0]).toBe('https://v1.american-football.api-sports.io/games?league=1&date=2026-09-13&timezone=UTC');
    expect(fetcher.mock.calls[0][1].headers).toEqual({ 'x-apisports-key': 'test-key' });
  });
  it('accepts HTTP cache age at the 30-second provider update interval', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [], response: [game()] }), { headers: { Age: '30' } }));
    expect((await fetchApiSportsScoreboard('2026-09-13', 'test-key', fetcher)).games).toEqual([game()]);
  });
  it('rejects HTTP, API-level and stale cache failures without exposing provider errors', async () => {
    for (const response of [
      new Response('', { status: 403 }),
      new Response(JSON.stringify({ errors: { token: 'secret' }, response: [] })),
      new Response(JSON.stringify({ errors: [], response: {} })),
      new Response(JSON.stringify({ errors: [], response: [game()] }), { headers: { Age: '31' } }),
    ]) {
      await expect(fetchApiSportsScoreboard('2026-09-13', 'test-key', vi.fn().mockResolvedValue(response))).rejects.toThrow();
    }
  });
});
