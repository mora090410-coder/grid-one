import React from 'react';
import type { BoardData, GameState, LiveGameData, PendingMilestone, WinnerHighlights, WinnerResolution } from '../../../../types';
import { buildBoardGridModel, type ViewerBoardCellModel } from './boardGridModel';
import { CapsuleButton, scrollBehavior, useReducedMotion } from '../../../design/primitives';
import type { ViewerQuarter } from '../scenarios/scenarioModel';

interface ViewerBoardGridProps {
  selectedQuarter?: ViewerQuarter;
  board: BoardData;
  game: Pick<GameState, 'leftName' | 'leftAbbr' | 'topName' | 'topAbbr'>;
  live: LiveGameData | null;
  highlights: WinnerHighlights;
  winnerHistory: WinnerResolution[];
  pendingMilestones: PendingMilestone[];
  selectedPlayer: string;
  highlightedCoords?: { left: number; top: number } | null;
  viewSquareRequest?: { row: number; col: number } | null;
  showOpenSquares?: boolean;
  /** Demo board chrome. Does not change cell geometry. */
  chrome?: 'default' | 'stage';
}

const controlStyle = { minHeight: 44, minWidth: 44 };

const stateClass = (cell: ViewerBoardCellModel) => {
  const states = cell.states;
  if (states.includes('corrected') && states.includes('current')) return 'bg-cardinal text-broadcast-white ring-2 ring-inset ring-gold';
  if (states.includes('corrected')) return 'bg-cardinal text-broadcast-white';
  if (states.includes('current')) return 'bg-gold text-ink font-medium';
  if (states.includes('selected') && states.includes('resolved')) return 'bg-panel text-fg border border-gold ring-2 ring-inset ring-tone-cardinal';
  if (states.includes('selected')) return 'bg-panel-hover text-fg ring-2 ring-inset ring-tone-cardinal';
  if (states.includes('resolved')) return 'bg-panel text-fg border border-gold';
  if (states.includes('open')) return 'bg-transparent text-fg-3';
  return 'bg-panel text-fg';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ViewerBoardGrid: React.FC<ViewerBoardGridProps> = ({
  selectedQuarter,
  board,
  game,
  live,
  highlights,
  winnerHistory,
  pendingMilestones,
  selectedPlayer,
  highlightedCoords = null,
  viewSquareRequest = null,
  showOpenSquares = false,
  chrome = 'default',
}) => {
  const model = React.useMemo(() => buildBoardGridModel({
    selectedQuarter,
    board,
    game,
    live,
    highlights,
    winnerHistory,
    pendingMilestones,
    selectedPlayer,
    highlightedCoords,
    showOpenSquares,
  }), [selectedQuarter, board, game, live, highlights, winnerHistory, pendingMilestones, selectedPlayer, highlightedCoords, showOpenSquares]);

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
  const reducedMotion = useReducedMotion();
  const emphasisIds = model.cells.flat().filter((cell) => cell.states.includes('current') || cell.states.includes('scenario')).map((cell) => cell.id).join('|');
  const seenEmphasis = React.useRef<string | null>(null);
  const [pulsing, setPulsing] = React.useState('');

  React.useEffect(() => {
    const previous = seenEmphasis.current;
    seenEmphasis.current = emphasisIds;
    if (previous === null || previous === emphasisIds || reducedMotion) {
      if (reducedMotion) setPulsing('');
      return;
    }
    const before = new Set(previous.split('|').filter(Boolean));
    const added = emphasisIds.split('|').filter((id) => id && !before.has(id));
    setPulsing(added.join('|'));
  }, [emphasisIds, reducedMotion]);

  // Follow the current or selected square only when it actually moves. A score
  // poll rebuilds the model with the same square; that must not yank the
  // keyboard position back.
  React.useEffect(() => setFocus({ row: initialFocus.row, col: initialFocus.col }), [initialFocus.row, initialFocus.col]);

  const focusCell = React.useCallback((row: number, col: number, center = false) => {
    const next = { row: clamp(row, 0, 9), col: clamp(col, 0, 9) };
    setFocus(next);
    const cell = cellRefs.current[next.row]?.[next.col];
    cell?.focus({ preventScroll: center });
    if (center && cell && viewportRef.current) {
      const viewport = viewportRef.current;
      const left = cell.offsetLeft - ((viewport.clientWidth - cell.offsetWidth) / 2);
      const top = cell.offsetTop - ((viewport.clientHeight - cell.offsetHeight) / 2);
      const behavior = scrollBehavior(reducedMotion);
      if (typeof viewport.scrollTo === 'function') viewport.scrollTo({ left, top, behavior });
      else {
        viewport.scrollLeft = left;
        viewport.scrollTop = top;
      }
    }
  }, [reducedMotion]);

  React.useEffect(() => {
    if (!viewSquareRequest) return;
    const { row, col } = viewSquareRequest;
    focusCell(row, col, true);
    // Explicit navigation must reveal the board in the page as well as its
    // internal scroll viewport. Immediate scrolling also respects reduced motion.
    cellRefs.current[row]?.[col]?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: scrollBehavior(reducedMotion) });
  }, [viewSquareRequest, focusCell, reducedMotion]);

  const centerState = (state: 'selected' | 'current') => {
    const cell = model.cells.flat().find((candidate) => candidate.states.includes(state));
    if (cell) focusCell(cell.rowIndex, cell.colIndex, true);
  };

  const fitGrid = React.useCallback(() => {
    const available = viewportRef.current?.clientWidth || 760;
    setZoom(clamp(available / 786, 0.5, 1));
  }, []);

  React.useLayoutEffect(() => {
    if ((viewportRef.current?.clientWidth || 0) > 0) fitGrid();
  }, [fitGrid]);

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

  const pulsingIds = new Set(pulsing.split('|').filter(Boolean));
  const topLabel = game.topAbbr || model.topTeamName;
  const sideLabel = game.leftAbbr || model.sideTeamName;
  const orientationLabel = live && live.state !== 'pre'
    ? `Columns: ${model.topTeamName} — digit ${live.topScore % 10}. Rows: ${model.sideTeamName} — digit ${live.leftScore % 10}. Current square: ${topLabel} ${live.topScore % 10} across × ${sideLabel} ${live.leftScore % 10} down.`
    : `Columns: ${model.topTeamName}. Rows: ${model.sideTeamName}. Winning digits read across, then down.`;

  return (
    <div className="grid gap-3" data-testid="viewer-board-grid">
      <p className="font-ui text-[14px] text-fg-2">{orientationLabel}</p>
      <div className="flex flex-wrap items-center gap-2" aria-label="Board controls">
        <CapsuleButton variant="quiet" className="min-w-11" style={controlStyle} onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}>Zoom out</CapsuleButton>
        <CapsuleButton variant="quiet" className="min-w-11" style={controlStyle} onClick={() => centerState('current')}>Center current result</CapsuleButton>
        <CapsuleButton variant="quiet" className="min-w-11" style={controlStyle} onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}>Zoom in</CapsuleButton>
        <CapsuleButton variant="quiet" className="min-w-11" style={controlStyle} onClick={fitGrid}>Fit</CapsuleButton>
        {selectedPlayer && <CapsuleButton variant="quiet" className="min-w-11" style={controlStyle} onClick={() => centerState('selected')}>Center selected square</CapsuleButton>}
        <output className="font-mono tabular-nums inline-flex min-h-11 min-w-11 items-center justify-center px-3 rounded-capsule border border-hairline text-fg" aria-label="Current zoom">{Math.round(zoom * 100)}%</output>
      </div>

      <div ref={viewportRef} className={`gridone-viewer-board-viewport overflow-auto rounded-card border border-hairline bg-ground p-2${chrome === 'stage' ? ' board-stage-frame' : ''}`}>
        <table
          role="grid"
          aria-label={`Football squares board, Top team ${model.topTeamName}, Side team ${model.sideTeamName}`}
          aria-rowcount={11}
          aria-colcount={12}
          className="gridone-board-grid w-[760px] min-w-[760px] table-fixed border-separate border-spacing-[2px] text-fg"
          style={{ zoom } as React.CSSProperties}
          onKeyDown={onKeyDown}
        >
          <colgroup>
            <col style={{ width: 44 }} />
            <col style={{ width: 44 }} />
            {model.topAxis.map((_, index) => <col key={`data-col-${index}`} style={{ width: 67.2 }} />)}
          </colgroup>
          <thead>
            <tr aria-rowindex={1}>
              <th className="sticky left-0 top-0 z-40 bg-chyron text-broadcast-white rounded-cell font-mono text-[12px] uppercase tracking-[0.08em] p-2" style={{ width: 88, minWidth: 88 }} colSpan={2}>Top · {topLabel}</th>
              {model.topAxis.map((digit, index) => (
                <th key={`top-${index}`} role="columnheader" scope="col" aria-colindex={index + 3} data-sticky-axis="top" aria-label={`${model.topTeamName} top digit ${digit ?? 'unknown'}`} className="sticky top-0 z-30 bg-chyron text-gold font-mono tabular-nums text-[15px] rounded-cell p-2">
                  {digit}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.cells.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} role="row" aria-rowindex={rowIndex + 2}>
                {rowIndex === 0 && (
                  <th rowSpan={10} className="sticky left-0 z-30 w-11 min-w-11 bg-chyron text-broadcast-white rounded-cell font-mono text-[12px] uppercase tracking-[0.08em] p-0">
                    <div className="flex h-[578px] items-center justify-center px-2" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Side · {sideLabel}</div>
                  </th>
                )}
                <th role="rowheader" scope="row" aria-colindex={2} data-sticky-axis="side" aria-label={`${model.sideTeamName} side digit ${model.sideAxis[rowIndex] ?? 'unknown'}`} className="sticky left-11 z-20 w-11 min-w-11 bg-chyron text-gold font-mono tabular-nums text-[15px] rounded-cell p-2">
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
                    data-match-emphasis={pulsingIds.has(cell.id) ? 'on' : undefined}
                    data-match-tone={pulsingIds.has(cell.id) ? (cell.states.includes('current') ? 'ink' : 'gold') : undefined}
                    tabIndex={focus.row === cell.rowIndex && focus.col === cell.colIndex ? 0 : -1}
                    className={`group relative h-14 rounded-cell p-1 text-center align-middle font-ui text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action ${stateClass(cell)}`}
                    onFocus={() => setFocus({ row: cell.rowIndex, col: cell.colIndex })}
                    onClick={(event) => event.currentTarget.focus()}
                  >
                    <span className="flex h-full min-h-11 items-center justify-center font-medium">{cell.displayText}</span>
                    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-full z-40 mt-1 hidden w-max max-w-[220px] -translate-x-1/2 whitespace-normal rounded-control bg-chyron px-2 py-1 font-ui text-[12px] text-broadcast-white shadow-[var(--g-shadow)] group-hover:block group-focus-within:block">{(cell.names.length ? cell.names.join(', ') : 'OPEN')} · {topLabel} {cell.topDigit ?? '?'} across · {sideLabel} {cell.sideDigit ?? '?'} down</span>
                    {cell.states.includes('current') && <span className={`absolute right-1 top-1 font-mono text-[10px] ${cell.states.includes('corrected') ? 'text-gold' : 'text-ink'}`} aria-hidden="true">NOW</span>}
                    {cell.states.includes('corrected') && <span className="absolute bottom-1 right-1 font-mono text-[10px] text-broadcast-white" aria-hidden="true">C</span>}
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
