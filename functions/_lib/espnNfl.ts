export type ScheduledGameState = 'pre' | 'in' | 'post';

export interface ScheduledTeam {
  abbr: string;
  name: string;
}

export interface ScheduledGame {
  id: string;
  kickoffAt: string;
  state: ScheduledGameState;
  season: number;
  week: number | string;
  homeTeam: ScheduledTeam;
  awayTeam: ScheduledTeam;
}

export interface EspnTeamScore extends ScheduledTeam {
  score: number;
  quarterScores: {
    Q1: number;
    Q2: number;
    Q3: number;
    Q4: number;
    OT: number;
  };
}

export interface EspnScoreSnapshot {
  eventId: string;
  kickoffAt: string;
  state: ScheduledGameState;
  period: number;
  clock: string;
  detail: string;
  homeTeam: EspnTeamScore;
  awayTeam: EspnTeamScore;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

import { withRetry } from '../../utils/retry';

const ESPN_FETCH_TIMEOUT_MS = 8_000;

const espnRequestInit = (): RequestInit => ({
  headers: { Accept: 'application/json' },
  ...(typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
    ? { signal: AbortSignal.timeout(ESPN_FETCH_TIMEOUT_MS) }
    : {}),
});

const isRetryableEspnError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return true;
  const message = error.message.toLowerCase();
  return message.includes('network') || message.includes('timeout') || message.includes('http 5');
};

// One retry keeps the worst case (~2 fetch timeouts + backoff) well inside the
// 45-second score refresh lease.
const ESPN_RETRY_OPTIONS = {
  retries: 1,
  baseDelayMs: 400,
  maxDelayMs: 1_500,
  shouldRetry: isRetryableEspnError,
};

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
export const ESPN_SCOREBOARD_URL = `${ESPN_BASE_URL}/scoreboard`;
export const espnSummaryUrl = (eventId: string) =>
  `${ESPN_BASE_URL}/summary?event=${encodeURIComponent(eventId)}`;

const TEAM_ABBREVIATION_ALIASES: Record<string, string> = {
  JAC: 'JAX',
  LA: 'LAR',
  OAK: 'LV',
  SD: 'LAC',
  STL: 'LAR',
  WSH: 'WAS',
};

const NFL_TEAM_ABBREVIATIONS = new Set([
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS',
]);

export const normalizeTeamAbbreviation = (value: unknown): string => {
  const abbreviation = String(value || '').trim().toUpperCase();
  return TEAM_ABBREVIATION_ALIASES[abbreviation] || abbreviation;
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const requireRecord = (value: unknown, message: string): Record<string, any> => {
  if (!isRecord(value)) throw new Error(message);
  return value;
};

const finiteInteger = (value: unknown, message: string): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(number) || Number(number) < 0) throw new Error(message);
  return Number(number);
};

const normalizeState = (value: unknown): ScheduledGameState => {
  if (value === 'pre' || value === 'in' || value === 'post') return value;
  throw new Error('ESPN event did not contain a recognized game state.');
};

const normalizeTeam = (competitor: unknown): ScheduledTeam => {
  const rawCompetitor = requireRecord(competitor, 'ESPN event contained an invalid competitor.');
  const team = requireRecord(rawCompetitor.team, 'ESPN event competitor did not contain a team.');
  const abbr = normalizeTeamAbbreviation(team.abbreviation);
  const name = String(team.displayName || '').trim();
  if (!NFL_TEAM_ABBREVIATIONS.has(abbr) || !name) {
    throw new Error('ESPN event competitor did not contain a canonical NFL team.');
  }
  return { abbr, name };
};

const eventParts = (rawEvent: unknown) => {
  const event = requireRecord(rawEvent, 'ESPN event was malformed.');
  const competition = Array.isArray(event.competitions) ? event.competitions[0] : undefined;
  const normalizedCompetition = requireRecord(competition, 'ESPN event did not contain a competition.');
  const competitors = Array.isArray(normalizedCompetition.competitors)
    ? normalizedCompetition.competitors
    : [];
  const home = competitors.find((candidate) => candidate?.homeAway === 'home');
  const away = competitors.find((candidate) => candidate?.homeAway === 'away');
  if (!home || !away || competitors.length !== 2) {
    throw new Error('ESPN event did not contain one home and one away NFL team.');
  }

  const id = String(event.id || normalizedCompetition.id || '').trim();
  const rawKickoff = normalizedCompetition.date || event.date;
  const kickoff = new Date(rawKickoff);
  const state = normalizedCompetition.status?.type?.state ?? event.status?.type?.state;
  const season = event.season?.year;
  const week = event.week?.number ?? event.week;
  if (!/^\d+$/.test(id)) throw new Error('ESPN event did not contain a valid event ID.');
  if (Number.isNaN(kickoff.getTime())) throw new Error('ESPN event did not contain a valid kickoff.');
  if (!Number.isInteger(season)) throw new Error('ESPN event did not contain a valid season.');
  if ((typeof week !== 'number' && typeof week !== 'string') || String(week).trim() === '') {
    throw new Error('ESPN event did not contain a valid week.');
  }

  return {
    event,
    competition: normalizedCompetition,
    home,
    away,
    id,
    kickoffAt: kickoff.toISOString(),
    state: normalizeState(state),
    season: Number(season),
    week,
  };
};

export const normalizeEspnEvent = (rawEvent: unknown): ScheduledGame => {
  const parts = eventParts(rawEvent);
  return {
    id: parts.id,
    kickoffAt: parts.kickoffAt,
    state: parts.state,
    season: parts.season,
    week: parts.week,
    homeTeam: normalizeTeam(parts.home),
    awayTeam: normalizeTeam(parts.away),
  };
};

const normalizeLineScores = (competitor: Record<string, any>) => {
  const linescores = Array.isArray(competitor.linescores) ? competitor.linescores : [];
  const result = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, OT: 0 };

  linescores.forEach((line, index) => {
    const period = Number.isInteger(line?.period) ? Number(line.period) : index + 1;
    const points = finiteInteger(
      line?.value ?? line?.displayValue,
      'ESPN event contained invalid period scoring.',
    );
    if (period >= 1 && period <= 4) result[`Q${period}` as 'Q1' | 'Q2' | 'Q3' | 'Q4'] = points;
    else if (period >= 5) result.OT += points;
  });

  return result;
};

const normalizeScoredTeam = (
  competitor: unknown,
  state: ScheduledGameState,
): EspnTeamScore => {
  const raw = requireRecord(competitor, 'ESPN event contained an invalid scored team.');
  const quarterScores = normalizeLineScores(raw);
  const score = state === 'pre' && (raw.score == null || raw.score === '')
    ? 0
    : finiteInteger(raw.score, 'ESPN event contained an invalid total score.');
  const calculated = Object.values(quarterScores).reduce((sum, points) => sum + points, 0);
  if (calculated !== score) throw new Error('ESPN period scoring did not match the total score.');
  return { ...normalizeTeam(raw), score, quarterScores };
};

const scoreSnapshotFromParts = (parts: ReturnType<typeof eventParts>): EspnScoreSnapshot => {
  const status = parts.competition.status || parts.event.status;
  const observedPeriods = [parts.home, parts.away].reduce((highest, competitor) => {
    const linescores = Array.isArray(competitor?.linescores) ? competitor.linescores : [];
    return linescores.reduce((teamHighest: number, line: any, index: number) => {
      const period = Number.isInteger(line?.period) ? Number(line.period) : index + 1;
      return Math.max(teamHighest, period);
    }, highest);
  }, 0);
  return {
    eventId: parts.id,
    kickoffAt: parts.kickoffAt,
    state: parts.state,
    period: finiteInteger(status?.period ?? observedPeriods, 'ESPN event contained an invalid period.'),
    clock: String(status?.displayClock || ''),
    detail: String(status?.type?.detail || status?.type?.description || ''),
    homeTeam: normalizeScoredTeam(parts.home, parts.state),
    awayTeam: normalizeScoredTeam(parts.away, parts.state),
  };
};

/**
 * Normalizes an ESPN exact-event summary into team-oriented scoring.
 * Every period after the fourth is accumulated into OT.
 */
export const normalizeEspnScoreSummary = (rawSummary: unknown): EspnScoreSnapshot => {
  const summary = requireRecord(rawSummary, 'ESPN summary was malformed.');
  return scoreSnapshotFromParts(eventParts(summary.header));
};

/** Normalizes a single scoreboard `events[]` entry into the same score shape. */
export const normalizeEspnScoreboardEvent = (rawEvent: unknown): EspnScoreSnapshot =>
  scoreSnapshotFromParts(eventParts(rawEvent));

const parseJsonResponse = async (response: Response, context: string): Promise<any> => {
  if (!response.ok) throw new Error(`${context} failed with HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${context} returned invalid JSON.`);
  }
};

export const fetchEspnSummary = async (
  eventId: string,
  fetchImpl: FetchLike = fetch,
): Promise<any | null> => {
  const normalizedId = String(eventId || '').trim();
  if (!/^\d+$/.test(normalizedId)) return null;
  return withRetry(async () => {
    const response = await fetchImpl(espnSummaryUrl(normalizedId), espnRequestInit());
    if (response.status === 400 || response.status === 404) return null;
    return parseJsonResponse(response, 'ESPN event lookup');
  }, ESPN_RETRY_OPTIONS);
};

export interface LiveScoreboardResult {
  raw: any;
  /** Live/scheduled games keyed by ESPN event id. Malformed events are dropped. */
  games: Map<string, { snapshot: EspnScoreSnapshot; rawEvent: unknown }>;
}

/**
 * Fetches ESPN's current scoreboard once and normalizes every parseable event.
 * This is the single upstream call the score-refresh cron uses to cover the
 * entire live slate, instead of one /summary request per board.
 */
export const fetchLiveScoreboard = async (
  fetchImpl: FetchLike = fetch,
): Promise<LiveScoreboardResult> => {
  const payload = await withRetry(async () => {
    const response = await fetchImpl(ESPN_SCOREBOARD_URL, espnRequestInit());
    return parseJsonResponse(response, 'ESPN scoreboard request');
  }, ESPN_RETRY_OPTIONS);
  if (!Array.isArray(payload?.events)) {
    throw new Error('ESPN scoreboard response did not contain events.');
  }
  const games = new Map<string, { snapshot: EspnScoreSnapshot; rawEvent: unknown }>();
  for (const event of payload.events) {
    try {
      const snapshot = normalizeEspnScoreboardEvent(event);
      games.set(snapshot.eventId, { snapshot, rawEvent: event });
    } catch {
      // Pro Bowl and auxiliary events are not scoreable NFL matchups.
    }
  }
  return { raw: payload, games };
};

export const fetchScheduledGameById = async (
  eventId: string,
  fetchImpl: FetchLike = fetch,
): Promise<ScheduledGame | null> => {
  const summary = await fetchEspnSummary(eventId, fetchImpl);
  if (!summary) return null;
  const game = normalizeEspnEvent(summary.header);
  if (game.id !== String(eventId).trim()) {
    throw new Error('ESPN event lookup returned a different event.');
  }
  return game;
};

const dateKey = (date: Date) =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;

export interface FetchScheduledGamesOptions {
  scope: 'upcoming' | 'completed';
  limit?: number;
  now?: Date;
}

export const fetchScheduledGames = async (
  options: FetchScheduledGamesOptions,
  fetchImpl: FetchLike = fetch,
): Promise<ScheduledGame[]> => {
  if (options.scope !== 'upcoming' && options.scope !== 'completed') {
    throw new Error('Game scope must be upcoming or completed.');
  }
  const limit = options.limit ?? (options.scope === 'completed' ? 5 : 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error('Game limit must be an integer from 1 to 50.');
  }
  const now = options.now ? new Date(options.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('A valid current time is required.');

  const rangeStart = new Date(now);
  const rangeEnd = new Date(now);
  if (options.scope === 'upcoming') rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 240);
  else rangeStart.setUTCDate(rangeStart.getUTCDate() - 240);

  const url = new URL(ESPN_SCOREBOARD_URL);
  url.searchParams.set('dates', `${dateKey(rangeStart)}-${dateKey(rangeEnd)}`);
  url.searchParams.set('limit', '1000');
  const payload = await withRetry(async () => {
    const response = await fetchImpl(url, espnRequestInit());
    return parseJsonResponse(response, 'ESPN schedule request');
  }, ESPN_RETRY_OPTIONS);
  if (!Array.isArray(payload?.events)) throw new Error('ESPN schedule response did not contain events.');

  const games = payload.events.flatMap((event: unknown) => {
    try {
      return [normalizeEspnEvent(event)];
    } catch {
      // The ESPN NFL feed can include the Pro Bowl or malformed auxiliary
      // events. Neither is a selectable 32-team NFL matchup.
      return [];
    }
  });
  if (payload.events.length > 0 && games.length === 0) {
    throw new Error('ESPN schedule response did not contain any valid NFL games.');
  }
  const nowTime = now.getTime();
  return games
    .filter((game: ScheduledGame) => options.scope === 'upcoming'
      ? game.state === 'pre' && new Date(game.kickoffAt).getTime() >= nowTime
      : game.state === 'post' && new Date(game.kickoffAt).getTime() <= nowTime)
    .sort((left: ScheduledGame, right: ScheduledGame) => {
      const difference = new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime();
      return options.scope === 'completed' ? -difference : difference;
    })
    .slice(0, limit);
};
