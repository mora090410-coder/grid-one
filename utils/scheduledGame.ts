/** The part of a provider game that decides a board's matchup. */
export interface ScheduledMatchupSource {
  id: string;
  kickoffAt: string;
  awayTeam: { abbr: string; name: string };
  homeTeam: { abbr: string; name: string };
}

/**
 * The one rule for turning a scheduled NFL game into board fields, shared by
 * the browser (create, workspace) and the server (create, update).
 * The away team is the board's side (left) axis; the home team is the top axis.
 * Swapping them would score every square against the wrong team.
 */
export const matchupFromScheduledGame = (scheduled: ScheduledMatchupSource) => ({
  gameExternalId: scheduled.id,
  kickoffAt: scheduled.kickoffAt,
  leftAbbr: scheduled.awayTeam.abbr,
  leftName: scheduled.awayTeam.name,
  topAbbr: scheduled.homeTeam.abbr,
  topName: scheduled.homeTeam.name,
  // Legacy read compatibility only: the UTC calendar date of kickoff. The kickoff stays canonical.
  dates: scheduled.kickoffAt.slice(0, 10),
});
