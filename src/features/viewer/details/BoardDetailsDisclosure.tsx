import React from 'react';
import type { BoardData, GameState, PendingMilestone, WinnerResolution } from '../../../../types';
import { Eyebrow, Glass } from '../../../design/primitives';
import { milestoneLabel } from '../milestones/milestoneViewModel';

export interface BoardDetailsDisclosureProps {
  game: GameState;
  /** Kept for call-site compatibility; the board is summarized above the grid. */
  board?: BoardData;
  winnerHistory: WinnerResolution[];
  final: boolean;
  pendingMilestones?: PendingMilestone[];
}

const ResultRecord: React.FC<{ winnerHistory: WinnerResolution[]; game: GameState; final?: boolean }> = ({ winnerHistory, game, final = false }) => (
  <Glass as="section" padding="lg" className="flex flex-col gap-3" role="region" aria-labelledby={final ? 'final-record-title' : 'completed-results-title'}>
    <h2 id={final ? 'final-record-title' : 'completed-results-title'} className="font-display text-[26px] leading-[1.1] text-fg">{final ? 'Final record' : 'Completed results'}</h2>
    {winnerHistory.length ? (
      <ol className="flex flex-col gap-2">
        {winnerHistory.map((winner) => {
          const isOpenSquare = Boolean(winner.openSquare) && !winner.participantName;
          const notes = game.payoutDescriptions?.notes?.trim();
          const previousVersion = winner.versions?.length ? winner.versions[winner.versions.length - 1] : undefined;
          const previousName = previousVersion?.participantName ?? (previousVersion?.openSquare ? 'Open square' : undefined);
          const currentName = winner.participantName ?? (winner.openSquare ? 'Open square' : undefined);
          const showPrevious = winner.corrected && previousName && previousName !== currentName;
          return (
            <li key={`${winner.milestone}-${winner.resolvedAt}-${winner.resolutionVersion || 1}`} className="flex flex-col gap-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-ui text-[15px] text-fg">
                  <span className="font-medium">{milestoneLabel(winner.milestone)}</span> ·{' '}
                  {isOpenSquare ? (
                    <>
                      Open square
                      {notes && (
                        <>
                          {' '}
                          <a href="#board-rules" className="underline underline-offset-2">see board rules</a>
                        </>
                      )}
                    </>
                  ) : (
                    winner.participantName || (winner.openSquare ? 'Open square' : 'Unassigned')
                  )}
                </span>
                <span className="font-mono tabular-nums text-[14px] text-fg-3">{winner.topDigit} across · {winner.sideDigit} down{winner.corrected ? ' · corrected' : ''}</span>
              </span>
              {winner.corrected && (
                <span className="font-ui text-[13px] text-fg-2">
                  Corrected
                  {winner.correctedAt ? ` ${new Date(winner.correctedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
                  {winner.correctionReason ? ` · ${winner.correctionReason}` : ''}
                  {showPrevious ? ` · Previously ${previousName}` : ''}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    ) : (
      <p className="font-ui text-[15px] text-fg-2">No quarter winners yet.</p>
    )}
  </Glass>
);

export const FinalRecord: React.FC<{ winnerHistory: WinnerResolution[]; game: GameState }> = (props) => <ResultRecord {...props} final />;

export const CompletedResults: React.FC<{ winnerHistory: WinnerResolution[]; game: GameState }> = (props) => (
  props.winnerHistory.length ? <ResultRecord {...props} /> : null
);

const PAYOUT_ROWS = [
  ['Q1', 'Q1'],
  ['HALF', 'Halftime'],
  ['Q3', 'Q3'],
  ['FINAL', 'Final'],
] as const;

export const PayoutsAndRules: React.FC<{ game: GameState; winnerHistory?: WinnerResolution[]; pendingMilestones?: PendingMilestone[] }> = ({ game, winnerHistory = [], pendingMilestones = [] }) => {
  const rows = PAYOUT_ROWS.flatMap(([key, label]) => {
    const description = game.payoutDescriptions?.[key]?.trim();
    const milestone = key === 'HALF' ? 'Q2' : key;
    const winner = winnerHistory.find((result) => result.milestone === milestone);
    const pending = pendingMilestones.some((result) => result.milestone === milestone);
    const status = winner
      ? `${winner.participantName || (winner.openSquare ? 'Open square' : 'Unassigned')}${winner.corrected ? ' · corrected' : ''}`
      : pending ? 'Pending confirmation' : 'Not yet confirmed';
    return description ? [{ key, label, description, status }] : [];
  });
  const notes = game.payoutDescriptions?.notes?.trim();

  if (!rows.length && !notes) return null;

  return (
    <Glass as="section" padding="lg" className="flex flex-col gap-3" id="board-rules" aria-labelledby="board-rules-title">
      <h2 id="board-rules-title" className="font-display text-[26px] leading-[1.1] text-fg">Payouts</h2>
      {rows.length > 0 && (
        <dl className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.key}>
              <dt><Eyebrow as="span">{row.label}</Eyebrow></dt>
              <dd className="font-ui text-[15px] text-fg mt-1">{row.description}<span className="block text-fg-2">{row.status}</span></dd>
            </div>
          ))}
        </dl>
      )}
      {notes && (
        <div>
          <Eyebrow as="span">Board rules</Eyebrow>
          <p className="font-ui text-[15px] text-fg mt-1">{notes}</p>
        </div>
      )}
      <p className="font-ui text-[13px] text-fg-3">
        GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.
      </p>
    </Glass>
  );
};

/**
 * What sits after the board: the final record once the game ends, then
 * payouts and board rules when the organizer published any. Teams, the
 * assigned count, and the number mode already show above the board, so this
 * block adds nothing when there is nothing to add.
 */
const BoardDetailsDisclosure: React.FC<BoardDetailsDisclosureProps> = ({ game, winnerHistory, final, pendingMilestones }) => (
  <>
    {final && <FinalRecord winnerHistory={winnerHistory} game={game} />}
    <PayoutsAndRules game={game} winnerHistory={winnerHistory} pendingMilestones={pendingMilestones} />
  </>
);

export default BoardDetailsDisclosure;
