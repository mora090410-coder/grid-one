import React from 'react';
import type { BoardData, GameState, LiveGameData } from '../../../../types';
import { buildScenarioModel, playersForDigits, quarterForLive } from '../scenarios/scenarioModel';
import { CapsuleButton, Eyebrow, Glass } from '../../../design/primitives';

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
  const [expanded, setExpanded] = React.useState(false);
  const listId = React.useId();
  React.useEffect(() => setExpanded(false), [selectedPlayer]);
  if (!selectedPlayer) return null;
  const rows = selectedRows(board, game, live, selectedPlayer)
    .sort((a, b) => Number(b.matchesCurrent) - Number(a.matchesCurrent));
  const visibleRows = expanded ? rows : rows.slice(0, 4);
  const currentQuarter = quarterForLive(live);
  const currentNames = live ? playersForDigits(board, live.topScore % 10, live.leftScore % 10, currentQuarter) : [];
  const winsNow = currentNames.includes(selectedPlayer);
  // The one answer a returning buyer wants: what score would make me win next.
  const nextWin = rows.find((row) => row.nextLabels.length)?.nextLabels[0] ?? null;
  const topLabel = game.topAbbr || 'Top';
  const leftLabel = game.leftAbbr || 'Side';

  return (
    <section className="flex flex-col gap-4" role="region" aria-label={`${selectedPlayer} square summary`}>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Your squares · {selectedPlayer}</Eyebrow>
        <span className="whitespace-nowrap font-mono tabular-nums text-[15px] text-fg">{rows.length} {rows.length === 1 ? 'square' : 'squares'}</span>
      </div>
      <p className={`font-ui text-[17px] font-medium ${winsNow ? 'text-gold' : 'text-fg-2'}`}>
        {winsNow ? 'You’re winning right now.' : nextWin ? `Not winning right now. Next winning score: ${nextWin}.` : 'Not winning right now.'}
      </p>
      <ul id={listId} className="flex flex-col gap-2" aria-label="Your squares">
        {visibleRows.map((row) => (
          <li key={`row-${row.index}`}>
            <Glass padding="md" className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-mono tabular-nums text-[15px] text-fg">{topLabel} column {row.top} × {leftLabel} row {row.left}</span>
                <span className="font-ui text-[14px] text-fg-2">
                  {row.matchesCurrent ? 'Winning right now.' : row.nextLabels.length ? `Next score: ${row.nextLabels[0]}` : 'Not one score away yet.'}
                </span>
              </div>
              {row.top !== null && row.left !== null && (
                <CapsuleButton variant="quiet" className="shrink-0 whitespace-nowrap" onClick={() => onViewSquare({ top: row.top as number, left: row.left as number })}>
                  <span aria-hidden="true">View on board</span>
                  <span className="sr-only">View on board top {row.top} side {row.left}</span>
                </CapsuleButton>
              )}
            </Glass>
          </li>
        ))}
      </ul>
      {rows.length > 4 && (
        <CapsuleButton variant="quiet" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer squares' : `Show all ${rows.length} squares`}
        </CapsuleButton>
      )}
    </section>
  );
};

export default YourSquaresSummary;
