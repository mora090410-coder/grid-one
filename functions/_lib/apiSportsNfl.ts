import type { ProviderScoreResult } from './scoreRefresh';

// Official contract: https://api-sports.io/documentation/nfl/v1
// This adapter is server-only. Credentials never enter URLs or error messages.
const TEAMS: Record<string, string> = {
  'Arizona Cardinals': 'ARI', 'Atlanta Falcons': 'ATL', 'Baltimore Ravens': 'BAL', 'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR', 'Chicago Bears': 'CHI', 'Cincinnati Bengals': 'CIN', 'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL', 'Denver Broncos': 'DEN', 'Detroit Lions': 'DET', 'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU', 'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX', 'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC', 'Los Angeles Rams': 'LAR', 'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN', 'New England Patriots': 'NE', 'New Orleans Saints': 'NO', 'New York Giants': 'NYG',
  'New York Jets': 'NYJ', 'Philadelphia Eagles': 'PHI', 'Pittsburgh Steelers': 'PIT', 'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA', 'Tampa Bay Buccaneers': 'TB', 'Tennessee Titans': 'TEN', 'Washington Commanders': 'WAS',
};
const canonical = (value: unknown) => {
  const abbr = String(value || '').trim().toUpperCase();
  return ({ JAC: 'JAX', WSH: 'WAS', LA: 'LAR' } as Record<string, string>)[abbr] || abbr;
};
const matches = (contest: any, raw: any) => {
  const kickoff = Date.parse(contest.game_starts_at);
  return raw?.league?.id === 1 && Number.isInteger(raw?.game?.id) && raw.game.id > 0
    && Number.isInteger(raw?.game?.date?.timestamp) && Number.isFinite(kickoff)
    && raw.game.date.timestamp * 1000 === kickoff
    && TEAMS[raw?.teams?.away?.name] === canonical(contest.side_team_abbr)
    && TEAMS[raw?.teams?.home?.name] === canonical(contest.top_team_abbr);
};
export const findApiSportsGame = (contest: any, games: unknown[]): unknown => {
  const found = games.filter(raw => matches(contest, raw));
  if (found.length !== 1) throw new Error(found.length ? 'API-Sports returned an ambiguous NFL game.' : 'API-Sports did not return the linked NFL game.');
  return found[0];
};

export type ApiSportsScoreboard = { games: unknown[]; observedAt: string };
export const fetchApiSportsScoreboard = async (
  date: string, key: string, fetchImpl: typeof fetch = fetch,
): Promise<ApiSportsScoreboard> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))) throw new Error('A valid NFL scoreboard date is required.');
  if (!key.trim()) throw new Error('The independent scoring provider is not configured.');
  const observedAt = new Date().toISOString();
  const response = await fetchImpl(`https://v1.american-football.api-sports.io/games?league=1&date=${date}&timezone=UTC`, {
    headers: { 'x-apisports-key': key }, signal: AbortSignal.timeout(10_000), cache: 'no-store',
  });
  if (!response.ok) throw new Error(`API-Sports scoreboard request failed (${response.status}).`);
  // Age only protects against stale HTTP cache entries; it cannot prove the
  // underlying provider feed has advanced. No source timestamp is documented.
  const age = response.headers.get('age');
  if (age !== null && (!/^\d+$/.test(age) || Number(age) > 30)) throw new Error('API-Sports returned a stale cached scoreboard.');
  const payload: any = await response.json();
  if (!payload?.errors || typeof payload.errors !== 'object' || Object.keys(payload.errors).length || !Array.isArray(payload.response)) {
    throw new Error('API-Sports returned an invalid scoreboard or provider error.');
  }
  return { games: payload.response, observedAt };
};

const integerScore = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255;
export const providerScoreFromApiSportsGame = (contest: any, raw: any, observedAt: string): ProviderScoreResult => {
  if (!matches(contest, raw)) throw new Error('API-Sports returned a different NFL game than the board is linked to.');
  const status = raw.game.status?.short;
  const periods: Record<string, number> = { NS: 0, Q1: 1, Q2: 2, HT: 2, Q3: 3, Q4: 4, OT: 5, FT: 4, AOT: 5 };
  if (!Object.hasOwn(periods, status)) throw new Error('API-Sports returned an unsupported game state.');
  const period = periods[status];
  const sourceTime = Date.parse(observedAt);
  if (!Number.isFinite(sourceTime)) throw new Error('API-Sports observation time is invalid.');
  const fields = ['quarter_1', 'quarter_2', 'quarter_3', 'quarter_4', 'overtime'] as const;
  const readSide = (side: 'home' | 'away') => {
    const scores = raw.scores?.[side];
    const quarters = fields.map((field, index) => {
      const value = scores?.[field];
      if (index >= period && (value === null || value === 0)) return 0;
      if (index >= period || !integerScore(value)) throw new Error('API-Sports returned incomplete or invalid quarter scoring.');
      return value;
    });
    const total = period === 0 && scores?.total === null ? 0 : scores?.total;
    if (!integerScore(total) || quarters.reduce((sum, value) => sum + value, 0) !== total) throw new Error('API-Sports quarter scoring does not match its total.');
    return { quarters, total };
  };
  const left = readSide('away'); const top = readSide('home');
  const quarterScores = Object.fromEntries(['Q1', 'Q2', 'Q3', 'Q4', 'OT'].map((key, index) => [key, { left: left.quarters[index], top: top.quarters[index] }])) as ProviderScoreResult['score']['quarterScores'];
  return {
    provider: 'api-sports', raw,
    source: { title: 'API-Sports', uri: 'https://api-sports.io/sports/nfl' },
    score: {
      leftScore: left.total, topScore: top.total, quarterScores, period,
      state: status === 'NS' ? 'pre' : ['FT', 'AOT'].includes(status) ? 'post' : 'in',
      clock: status === 'HT' ? '0:00' : String(raw.game.status.timer || '').slice(0, 32),
      detail: status === 'HT' ? 'Halftime' : status === 'NS' ? 'Scheduled' : status === 'FT' ? 'Final' : status === 'AOT' ? 'Final/OT' : status,
      isOvertime: period === 5, sourceObservedAt: new Date(sourceTime).toISOString(),
    },
  };
};
