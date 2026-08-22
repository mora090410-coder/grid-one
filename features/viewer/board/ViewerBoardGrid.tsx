import React from 'react';
import type { BoardData, GameState, LiveGameData, PendingMilestone, WinnerHighlights, WinnerResolution } from '../../../types';
import { buildBoardGridModel, type ViewerBoardCellModel } from './boardGridModel';

interface ViewerBoardGridProps {
  board: BoardData;
  game: Pick<GameState, 'leftName' | 'leftAbbr' | 'topName' | 'topAbbr'>;
  live: LiveGameData | null;
  highlights: WinnerHighlights;
  winnerHistory: WinnerResolution[];
  pendingMilestones: PendingMilestone[];
  selectedPlayer: string;
  highlightedCoords?: { left: number; top: number } | null;
  showOpenSquares?: boolean;
  onFindSquares: () => void;
}

const controlStyle = { minHeight: 44, minWidth: 44 };

const stateClass = (cell: ViewerBoardCellModel) => {
  const states = cell.states;
  if (states.includes('corrected') && states.includes('current')) return 'bg-cardinal ring-[4px] ring-inset ring-gold text-broadcast-white';
  if (states.includes('corrected')) return 'bg-cardinal ring-[4px] ring-inset ring-cardinal-deep text-broadcast-white';
  if (states.includes('current')) return 'bg-gold ring-[3px] ring-inset ring-gold-deep text-ink';
  if (states.includes('selected')) return 'bg-cardinal-subtle ring-[3px] ring-inset ring-cardinal text-ink';
  if (states.includes('resolved')) return 'bg-broadcast-white ring-[3px] ring-inset ring-gold-deep text-ink';
  if (states.includes('open')) return 'bg-newsprint ring-1 ring-inset ring-ink/35 text-ink/70';
  return 'bg-broadcast-white text-ink/70 hover:bg-newsprint';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ViewerBoardGrid: React.FC<ViewerBoardGridProps> = ({
  board,
  game,
  live,
  highlights,
  winnerHistory,
  pendingMilestones,
  selectedPlayer,
  highlightedCoords = null,
  showOpenSquares = false,
  onFindSquares,
}) => {
  const model = React.useMemo(() => buildBoardGridModel({
    board,
    game,
    live,
    highlights,
    winnerHistory,
    pendingMilestones,
    selectedPlayer,
    highlightedCoords,
    showOpenSquares,
  }), [board, game, live, highlights, winnerHistory, pendingMilestones, selectedPlayer, highlightedCoords, showOpenSquares]);

  const initialFocus = React.useMemo(() => {
    for (const row of model.cells) {
      const selected = row.find((cell) => cell.states.includes('selected') || cell.states.includes('current'));
      if (selected) return { row: selected.rowIndex, col: selected.colIndex };
    }
    return { row: 0, col: 0 };
  }, [model]);

  const [focus, setFocus] = React.useState(initialFocus);
  const [zoom, setZoom] = React.useState(1);
  const cellRefs = React.useRef<Array<Array<HTMLTableCellElement | null>>>([]);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setFocus(initialFocus), [initialFocus]);

  const focusCell = (row: number, col: number, center = false) => {
    const next = { row: clamp(row, 0, 9), col: clamp(col, 0, 9) };
    setFocus(next);
    const cell = cellRefs.current[next.row]?.[next.col];
    cell?.focus({ preventScroll: center });
    if (center && cell && viewportRef.current) {
      const viewport = viewportRef.current;
      const left = cell.offsetLeft - ((viewport.clientWidth - cell.offsetWidth) / 2);
      const top = cell.offsetTop - ((viewport.clientHeight - cell.offsetHeight) / 2);
      if (typeof viewport.scrollTo === 'function') viewport.scrollTo({ left, top, behavior: 'auto' });
      else {
        viewport.scrollLeft = left;
        viewport.scrollTop = top;
      }
    }
  };

  const centerState = (state: 'selected' | 'current') => {
    const cell = model.cells.flat().find((candidate) => candidate.states.includes(state));
    if (cell) focusCell(cell.rowIndex, cell.colIndex, true);
  };

  const fitGrid = () => {
    const available = viewportRef.current?.clientWidth || 760;
    setZoom(clamp(available / 760, 0.5, 1));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
    const { key, ctrlKey } = event;
    const focusedCell = (event.target as HTMLElement).closest<HTMLElement>('[role="gridcell"]');
    const origin = focusedCell
      ? { row: Number(focusedCell.dataset.rowIndex), col: Number(focusedCell.dataset.colIndex) }
      : focus;
    let next = origin;
    if (key === 'ArrowRight') next = { row: origin.row, col: origin.col + 1 };
    else if (key === 'ArrowLeft') next = { row: origin.row, col: origin.col - 1 };
    else if (key === 'ArrowDown') next = { row: origin.row + 1, col: origin.col };
    else if (key === 'ArrowUp') next = { row: origin.row - 1, col: origin.col };
    else if (key === 'Home') next = ctrlKey ? { row: 0, col: 0 } : { row: origin.row, col: 0 };
    else if (key === 'End') next = ctrlKey ? { row: 9, col: 9 } : { row: origin.row, col: 9 };
    else return;
    event.preventDefault();
    focusCell(next.row, next.col);
  };

  const currentLabel = live && live.state !== 'pre' ? `${model.topTeamName} ${live.topScore % 10} / ${model.sideTeamName} ${live.leftScore % 10}` : 'No current score';

  return (
    <div className="grid gap-3" data-testid="viewer-board-grid-v2">
      <div className="flex flex-wrap items-center gap-2" aria-label="Board controls">
        <button type="button" className="oa-slab border border-ink px-3 text-ink" style={controlStyle} onClick={() => setZoom((value) => Math.max(0.75, value - 0.1))}>Zoom out</button>
        <button type="button" className="oa-slab border border-ink px-3 text-ink" style={controlStyle} onClick={() => centerState('current')}>Center current result</button>
        <button type="button" className="oa-slab border border-ink px-3 text-ink" style={controlStyle} onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}>Zoom in</button>
        <button type="button" className="oa-slab border border-ink px-3 text-ink" style={controlStyle} onClick={fitGrid}>Fit board</button>
        <button type="button" className="oa-slab border border-ink px-3 text-ink" style={controlStyle} onClick={onFindSquares}>Find</button>
        <button type="button" className="oa-slab border border-ink px-3 text-ink" style={controlStyle} onClick={() => centerState('selected')}>Center selected</button>
        <output className="oa-data flex min-h-11 min-w-11 items-center justify-center border border-ink px-2 text-ink" aria-label="Current zoom">{Math.round(zoom * 100)}%</output>
        <span className="oa-data text-xs text-ink/60" aria-live="polite">{currentLabel}</span>
      </div>

      <div ref={viewportRef} className="gridone-viewer-board-viewport overflow-auto border border-ink bg-broadcast-white p-1">
        <table
          role="grid"
          aria-label={`Football squares board, Top team ${model.topTeamName}, Side team ${model.sideTeamName}`}
          aria-rowcount={11}
          aria-colcount={12}
          className="gridone-board-grid w-full min-w-[760px] table-fixed border-collapse bg-broadcast-white text-ink"
          style={{ width: 760 * zoom, minWidth: 760 * zoom }}
          onKeyDown={onKeyDown}
        >
          <colgroup>
            <col style={{ width: 44 }} />
            <col style={{ width: 44 }} />
            {model.topAxis.map((_, index) => <col key={`data-col-${index}`} style={{ width: 67.2 }} />)}
          </colgroup>
          <thead>
            <tr aria-rowindex={1}>
              <th className="sticky left-0 top-0 z-40 bg-chyron p-2 text-broadcast-white" style={{ width: 88, minWidth: 88 }} colSpan={2}>Top team</th>
              {model.topAxis.map((digit, index) => (
                <th key={`top-${index}`} role="columnheader" scope="col" aria-colindex={index + 3} data-sticky-axis="top" aria-label={`${model.topTeamName} top digit ${digit ?? 'unknown'}`} className="oa-board-axis sticky top-0 z-30 border border-cardinal bg-cardinal-deep p-2 text-broadcast-white">
                  {digit}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.cells.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} role="row" aria-rowindex={rowIndex + 2}>
                {rowIndex === 0 && (
                  <th rowSpan={10} className="sticky left-0 z-30 w-11 min-w-11 border border-ink bg-chyron p-0 text-broadcast-white">
                    <div className="flex h-full min-h-[44px] items-center justify-center px-2" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Side team</div>
                  </th>
                )}
                <th role="rowheader" scope="row" aria-colindex={2} data-sticky-axis="side" aria-label={`${model.sideTeamName} side digit ${model.sideAxis[rowIndex] ?? 'unknown'}`} className="oa-board-axis sticky left-11 z-20 w-11 min-w-11 border border-cardinal bg-cardinal-deep p-2 text-broadcast-white">
                  {model.sideAxis[rowIndex]}
                </th>
                {row.map((cell) => (
                  <td
                    key={cell.id}
                    ref={(node) => {
                      cellRefs.current[cell.rowIndex] = cellRefs.current[cell.rowIndex] ?? [];
                      cellRefs.current[cell.rowIndex][cell.colIndex] = node;
                    }}
                    role="gridcell"
                    aria-colindex={cell.colIndex + 3}
                    aria-label={cell.ariaName}
                    aria-selected={cell.states.includes('selected') ? 'true' : 'false'}
                    data-current={cell.states.includes('current') ? 'true' : 'false'}
                    data-resolved={cell.states.includes('resolved') ? 'true' : 'false'}
                    data-corrected={cell.states.includes('corrected') ? 'true' : 'false'}
                    data-open={cell.states.includes('open') ? 'true' : 'false'}
                    data-milestone={cell.states.includes('milestone') ? 'true' : 'false'}
                    data-row-index={cell.rowIndex}
                    data-col-index={cell.colIndex}
                    tabIndex={focus.row === cell.rowIndex && focus.col === cell.colIndex ? 0 : -1}
                    className={`relative h-14 border border-newsprint p-1 text-center align-middle focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-cardinal ${stateClass(cell)}`}
                    onFocus={() => setFocus({ row: cell.rowIndex, col: cell.colIndex })}
                  >
                    <span className="oa-board-name flex h-full min-h-11 items-center justify-center text-xs font-bold">{cell.displayText}</span>
                    {cell.states.includes('current') && <span className={`absolute right-1 top-1 oa-data text-[10px] ${cell.states.includes('corrected') ? 'text-gold' : 'text-ink'}`} aria-hidden="true">NOW</span>}
                    {cell.states.includes('corrected') && <span className="absolute bottom-1 right-1 oa-data text-[10px] text-broadcast-white" aria-hidden="true">C</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ViewerBoardGrid;
