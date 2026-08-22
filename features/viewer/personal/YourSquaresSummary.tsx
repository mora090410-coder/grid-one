import React from 'react';
import type { BoardData, GameState, LiveGameData } from '../../../types';
import { buildScenarioModel, playersForDigits, quarterForLive } from '../scenarios/scenarioModel';

interface SquareRow {
  index: number;
  top: number | null;
  left: number | null;
  matchesCurrent: boolean;
  nextLabels: string[];
}

const selectedRows = (board: BoardData, game: Pick<GameState, 'leftAbbr' | 'topAbbr'>, live: LiveGameData | null, selectedPlayer: string): SquareRow[] => {
  if (!selectedPlayer) return [];
  const scenarioModel = buildScenarioModel({ board, game, live });
  return board.squares.flatMap((names, index) => {
    if (!names.includes(selectedPlayer)) return [];
    const row = Math.floor(index / 10);
    const col = index % 10;
    const top = board.topAxis[col] ?? null;
    const left = board.leftAxis[row] ?? null;
    const matchesCurrent = Boolean(live && top === live.topScore % 10 && left === live.leftScore % 10);
    const nextLabels = scenarioModel.scenarios
      .filter((scenario) => scenario.top === top && scenario.left === left)
      .map((scenario) => `${scenario.team || 'Team'} ${scenario.label} +${scenario.points}`);
    return [{ index, top, left, matchesCurrent, nextLabels }];
  });
};

export interface YourSquaresSummaryProps {
  board: BoardData;
  game: Pick<GameState, 'leftAbbr' | 'topAbbr'>;
  live: LiveGameData | null;
  selectedPlayer: string;
  onViewSquare: (coords: { left: number; top: number } | null) => void;
}

const YourSquaresSummary: React.FC<YourSquaresSummaryProps> = ({ board, game, live, selectedPlayer, onViewSquare }) => {
  if (!selectedPlayer) return null;
  const rows = selectedRows(board, game, live, selectedPlayer);
  const currentQuarter = quarterForLive(live);
  const currentNames = live ? playersForDigits(board, live.topScore % 10, live.leftScore % 10, currentQuarter) : [];
  const currentStatus = currentNames.includes(selectedPlayer)
    ? 'Current result matches now.'
    : 'Current result: none of the selected squares match now.';

  return (
    <section className="border-t border-broadcast-white/20 py-5" role="region" aria-label={`${selectedPlayer} square summary`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="oa-slab text-xs uppercase tracking-[0.18em] text-gold">Selected name</p>
          <h2 className="oa-headline text-2xl text-broadcast-white">{selectedPlayer}</h2>
        </div>
        <strong className="oa-data text-broadcast-white">{rows.length} {rows.length === 1 ? 'square' : 'squares'}</strong>
      </div>
      <p className="oa-body mt-3 text-sm text-broadcast-white">{currentStatus}</p>
      <ul className="mt-4 grid gap-3">
        {rows.map((row) => (
          <li key={row.index} className="border border-broadcast-white/20 bg-ink/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="oa-data text-broadcast-white">top {row.top} / side {row.left}</span>
              {row.top !== null && row.left !== null && (
                <button
                  type="button"
                  className="oa-slab min-h-11 border border-broadcast-white/30 px-3 text-broadcast-white"
                  style={{ minHeight: 44 }}
                  onClick={() => onViewSquare({ top: row.top as number, left: row.left as number })}
                >
                  View on board top {row.top} side {row.left}
                </button>
              )}
            </div>
            <p className="oa-body mt-2 text-sm text-broadcast-white/70">
              {row.matchesCurrent ? 'Current result row.' : row.nextLabels.length ? `Next score: ${row.nextLabels[0]}` : 'Next score: none of the standard outcomes match this square.'}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default YourSquaresSummary;
