import React from 'react';
import type { BoardData, GameState, LiveGameData, PendingMilestone, WinnerHighlights, WinnerResolution } from '../../../../types';
import { BOARD_ZOOM, boardFitWidth, boardGeometry, buildBoardGridModel, type ViewerBoardCellModel } from './boardGridModel';
import TeamStripe from '../teams/TeamStripe';
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

const isWinner = (cell: ViewerBoardCellModel) => cell.states.includes('current') || cell.states.includes('resolved');

/**
 * Gold means winner: the current match and every published winner are solid
 * gold with ink text, and nothing else on the board is gold. NOW, C, and the
 * accessible name carry the difference between them, never color alone.
 */
const stateClass = (cell: ViewerBoardCellModel) => {
  const states = cell.states;
  const selected = states.includes('selected') ? ' ring-2 ring-inset ring-fg' : '';
  if (isWinner(cell)) {
    const now = states.includes('current') ? (selected ? ' ring-ink' : ' ring-2 ring-inset ring-ink') : '';
    return `gridone-winner bg-gold text-ink font-medium border border-ink/20${selected}${now}`;
  }
  if (states.includes('corrected')) return `bg-chyron text-broadcast-white border border-cell-edge${selected}`;
  if (states.includes('selected')) return 'bg-panel-hover text-fg border border-cell-edge ring-2 ring-inset ring-fg';
  if (states.includes('open')) return 'bg-cell text-fg-3 border border-cell-edge';
  return 'bg-panel text-fg border border-cell-edge';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Plain-language line for the square a viewer tapped or moved to. */
const squareDetail = (cell: ViewerBoardCellModel, topLabel: string, sideLabel: string) => {
  const who = cell.names.length ? cell.names.join(', ') : cell.isOpen ? 'OPEN' : 'No name yet';
  const parts = [who, `${topLabel} ${cell.topDigit ?? '?'} across`, `${sideLabel} ${cell.sideDigit ?? '?'} down`];
  if (cell.states.includes('current')) parts.push('Winning now');
  if (cell.states.includes('resolved')) parts.push('Past winner');
  return parts.join(' · ');
};

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
  const [zoom, setZoom] = React.useState<number>(BOARD_ZOOM.min);
  const [fitWidth, setFitWidth] = React.useState(() => boardFitWidth(0));
  const [showDetail, setShowDetail] = React.useState(false);
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

  // 100% always means "the whole board fits the box", so track the box.
  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const padding = parseFloat(getComputedStyle(viewport).paddingLeft || '0') + parseFloat(getComputedStyle(viewport).paddingRight || '0');
      const available = viewport.clientWidth - padding;
      if (available > 0) setFitWidth(boardFitWidth(available));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const geometry = boardGeometry(fitWidth, zoom);
  const zoomed = zoom > BOARD_ZOOM.min;
  const changeZoom = (delta: number) => setZoom((value) => clamp(value + delta, BOARD_ZOOM.min, BOARD_ZOOM.max));

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
    setShowDetail(true);
    focusCell(next.row, next.col);
  };

  const pulsingIds = new Set(pulsing.split('|').filter(Boolean));
  const topLabel = game.topAbbr || model.topTeamName;
  const sideLabel = game.leftAbbr || model.sideTeamName;
  const orientationLabel = live && live.state !== 'pre'
    ? `Columns: ${model.topTeamName} — digit ${live.topScore % 10}. Rows: ${model.sideTeamName} — digit ${live.leftScore % 10}. Current square: ${topLabel} ${live.topScore % 10} across × ${sideLabel} ${live.leftScore % 10} down.`
    : `Columns: ${model.topTeamName}. Rows: ${model.sideTeamName}. Winning digits read across, then down.`;

  const focusedCell = model.cells[focus.row]?.[focus.col];
  const cellStyle = { width: geometry.cell, height: geometry.cell, fontSize: geometry.cellFont };
  const axisStyle = { fontSize: geometry.axisFont };
  const badgeStyle = { fontSize: geometry.badgeFont };

  return (
    <div className="grid gap-3" data-testid="viewer-board-grid">
      <p className="font-ui text-[14px] text-fg-2">{orientationLabel}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] uppercase tracking-[0.08em] text-fg-2" data-testid="board-team-key">
        <span className="inline-flex items-center gap-1.5"><TeamStripe abbr={game.topAbbr} />Top · {topLabel} <span aria-hidden="true">→</span></span>
        <span className="inline-flex items-center gap-1.5"><TeamStripe abbr={game.leftAbbr} />Side · {sideLabel} <span aria-hidden="true">↓</span></span>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Board controls">
        <CapsuleButton variant="quiet" className="min-w-11" style={controlStyle} aria-label="Zoom out" disabled={!zoomed} onClick={() => changeZoom(-BOARD_ZOOM.step)}><span aria-hidden="true">−</span></CapsuleButton>
        <output className="font-mono tabular-nums inline-flex min-h-11 min-w-11 items-center justify-center px-3 rounded-capsule border border-hairline text-fg" aria-label="Current zoom">{Math.round(zoom * 100)}%</output>
        <CapsuleButton variant="quiet" className="min-w-11" style={controlStyle} aria-label="Zoom in" disabled={zoom >= BOARD_ZOOM.max} onClick={() => changeZoom(BOARD_ZOOM.step)}><span aria-hidden="true">+</span></CapsuleButton>
        {zoomed && <CapsuleButton variant="quiet" className="min-w-11" style={controlStyle} onClick={() => setZoom(BOARD_ZOOM.min)}>Fit</CapsuleButton>}
        {zoomed && <CapsuleButton variant="quiet" className="min-w-11" style={controlStyle} onClick={() => centerState('current')}>Center current result</CapsuleButton>}
        {zoomed && selectedPlayer && <CapsuleButton variant="quiet" className="min-w-11" style={controlStyle} onClick={() => centerState('selected')}>Center selected square</CapsuleButton>}
      </div>

      <div ref={viewportRef} className={`gridone-viewer-board-viewport overflow-auto rounded-card border border-hairline bg-ground p-2${chrome === 'stage' ? ' board-stage-frame' : ''}`}>
        <table
          role="grid"
          aria-label={`Football squares board, Top team ${model.topTeamName}, Side team ${model.sideTeamName}`}
          aria-rowcount={11}
          aria-colcount={11}
          className="gridone-board-grid table-fixed border-separate border-spacing-[2px] text-fg"
          style={{ width: geometry.width, minWidth: geometry.width }}
          onKeyDown={onKeyDown}
        >
          <colgroup>
            <col style={{ width: geometry.axis }} />
            {model.topAxis.map((_, index) => <col key={`data-col-${index}`} style={{ width: geometry.cell }} />)}
          </colgroup>
          <thead>
            <tr aria-rowindex={1}>
              <th scope="col" aria-colindex={1} className="sticky left-0 top-0 z-40 bg-chyron rounded-cell p-0" style={{ height: geometry.axis }}>
                <span className="sr-only">{sideLabel} digits</span>
              </th>
              {model.topAxis.map((digit, index) => (
                <th key={`top-${index}`} role="columnheader" scope="col" aria-colindex={index + 2} data-sticky-axis="top" aria-label={`${model.topTeamName} top digit ${digit ?? 'unknown'}`} className="sticky top-0 z-30 bg-chyron text-broadcast-white font-mono tabular-nums rounded-cell p-0" style={{ ...axisStyle, height: geometry.axis }}>
                  {digit}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.cells.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} role="row" aria-rowindex={rowIndex + 2}>
                <th role="rowheader" scope="row" aria-colindex={1} data-sticky-axis="side" aria-label={`${model.sideTeamName} side digit ${model.sideAxis[rowIndex] ?? 'unknown'}`} className="sticky left-0 z-20 bg-chyron text-broadcast-white font-mono tabular-nums rounded-cell p-0" style={axisStyle}>
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
                    aria-colindex={cell.colIndex + 2}
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
                    className={`group relative rounded-cell p-0 text-center align-middle font-ui leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action ${stateClass(cell)}`}
                    style={cellStyle}
                    onFocus={() => setFocus({ row: cell.rowIndex, col: cell.colIndex })}
                    onClick={(event) => { setShowDetail(true); event.currentTarget.focus(); }}
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-full z-40 mt-1 hidden w-max max-w-[220px] -translate-x-1/2 whitespace-normal rounded-control bg-chyron px-2 py-1 font-ui text-[12px] text-broadcast-white shadow-[var(--g-shadow)] [@media(hover:hover)]:group-hover:block">{(cell.names.length ? cell.names.join(', ') : 'OPEN')} · {topLabel} {cell.topDigit ?? '?'} across · {sideLabel} {cell.sideDigit ?? '?'} down</span>
                    <span className="flex h-full flex-col items-center justify-center gap-0.5 overflow-hidden font-medium">
                      {cell.states.includes('current') && <span className="font-mono leading-none text-ink" style={badgeStyle} aria-hidden="true">NOW</span>}
                      {cell.displayText}
                    </span>
                    {cell.states.includes('corrected') && <span className={`absolute bottom-0.5 right-0.5 font-mono leading-none ${isWinner(cell) ? 'text-ink' : 'text-broadcast-white'}`} style={badgeStyle} aria-hidden="true">C</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-ui text-[14px] text-fg-2" aria-live="polite" data-testid="board-square-detail">
        {showDetail && focusedCell ? squareDetail(focusedCell, topLabel, sideLabel) : 'Tap a square to see the full name.'}
      </p>
    </div>
  );
};

export default ViewerBoardGrid;
