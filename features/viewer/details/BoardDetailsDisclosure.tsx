import React from 'react';
import type { BoardData, GameState, WinnerResolution } from '../../../types';

export interface BoardDetailsDisclosureProps {
  game: GameState;
  board: BoardData;
  winnerHistory: WinnerResolution[];
  final: boolean;
}

const BoardDetailsDisclosure: React.FC<BoardDetailsDisclosureProps> = ({ game, board, winnerHistory, final }) => (
  <section className="border-t border-broadcast-white/20 py-5" aria-labelledby="board-details-title">
    {final && (
      <div className="mb-4 border border-gold p-3">
        <h2 className="oa-headline text-2xl text-broadcast-white">Final record</h2>
        {winnerHistory.length ? (
          <ol className="mt-2 grid gap-2 text-broadcast-white">
            {winnerHistory.map((winner) => (
              <li key={`${winner.milestone}-${winner.resolvedAt}-${winner.resolutionVersion || 1}`}>
                <strong>{winner.milestone}</strong> · {winner.participantName || (winner.openSquare ? 'Open square' : 'Unassigned')} · digits {winner.topDigit}/{winner.sideDigit}
              </li>
            ))}
          </ol>
        ) : (
          <p className="oa-body text-broadcast-white/70">No resolved winner records have been published yet.</p>
        )}
      </div>
    )}
    <details>
      <summary id="board-details-title" className="oa-slab min-h-11 cursor-pointer text-broadcast-white" style={{ minHeight: 44 }}>Board details</summary>
      <dl className="mt-3 grid gap-2 text-sm text-broadcast-white/75">
        <div><dt className="oa-slab text-gold">Teams</dt><dd>{game.leftName || game.leftAbbr} at {game.topName || game.topAbbr}</dd></div>
        <div><dt className="oa-slab text-gold">Squares assigned</dt><dd>{board.squares.filter((names) => names.length > 0).length} of 100</dd></div>
        <div><dt className="oa-slab text-gold">Digits</dt><dd>Top axis and side axis use organizer-published digits.</dd></div>
      </dl>
    </details>
  </section>
);

export default BoardDetailsDisclosure;
