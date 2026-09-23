import { fetchApiSportsScoreboard, findApiSportsGame, providerScoreFromApiSportsGame } from './apiSportsNfl';
import type { ProviderScoreResult } from './scoreRefresh';

/** Request-scoped caches also retain failures, so an outage cannot multiply
 * upstream calls by the number of boards watching the same game/date. */
export const createScoreProviderRecovery = (
  env: { API_SPORTS_KEY?: string },
  fetchImpl: typeof fetch = fetch,
) => {
  const dates = new Map<string, ReturnType<typeof fetchApiSportsScoreboard>>();
  const games = new Map<string, Promise<ProviderScoreResult>>();
  return (contest: any, primary: () => Promise<ProviderScoreResult>): Promise<ProviderScoreResult> => {
    const identity = JSON.stringify([
      contest.game_external_id, contest.game_starts_at, contest.side_team_abbr, contest.top_team_abbr,
    ]);
    let result = games.get(identity);
    if (!result) {
      result = (async () => {
        try {
          return await primary();
        } catch (error) {
          const key = env.API_SPORTS_KEY?.trim();
          if (!key) throw error;
          const kickoff = new Date(contest.game_starts_at);
          if (Number.isNaN(kickoff.getTime()) || !/^\d+$/.test(String(contest.game_external_id || ''))) {
            throw new Error('Independent scoring requires a linked scheduled NFL game.');
          }
          const date = kickoff.toISOString().slice(0, 10);
          let scoreboard = dates.get(date);
          if (!scoreboard) {
            scoreboard = fetchApiSportsScoreboard(date, key, fetchImpl);
            dates.set(date, scoreboard);
          }
          const alternate = await scoreboard;
          return providerScoreFromApiSportsGame(
            contest, findApiSportsGame(contest, alternate.games), alternate.observedAt,
          );
        }
      })();
      games.set(identity, result);
    }
    return result;
  };
};
