import type { ScheduledGame } from './espnNfl';

/** Legacy `dates` field: the UTC calendar date of kickoff. */
export const legacyDateFromKickoff = (kickoffAt: string) => kickoffAt.slice(0, 10);

/**
 * Game settings with the server-verified schedule identity written over
 * whatever the browser submitted. Used by board create and board update.
 */
export const canonicalizeGameSettings = <T extends Record<string, unknown>>(
  submitted: T,
  scheduled: ScheduledGame,
) => ({
  ...submitted,
  gameExternalId: scheduled.id,
  gameStartsAt: scheduled.kickoffAt,
  kickoffAt: scheduled.kickoffAt,
  gameSeason: scheduled.season,
  gameWeek: scheduled.week,
  dates: legacyDateFromKickoff(scheduled.kickoffAt),
  leftAbbr: scheduled.awayTeam.abbr,
  leftName: scheduled.awayTeam.name,
  topAbbr: scheduled.homeTeam.abbr,
  topName: scheduled.homeTeam.name,
});
