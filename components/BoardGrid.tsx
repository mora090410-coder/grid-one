
import React from 'react';
import { BoardData, WinnerHighlights, LiveGameData } from '../types';

interface BoardGridProps {
  board: BoardData;
  highlights: WinnerHighlights;
  live: LiveGameData | null;
  selectedPlayer: string;
  leftTeamName: string;
  topTeamName: string;
  highlightedCoords?: { left: number; top: number } | null;
  showOpenSquares?: boolean;
}

// Get initials from a name (first letter of first and last name)
const getInitials = (name: string): string => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Format players for cell display - show initials, truncate if multiple
const formatCellDisplay = (players: string[]): string => {
  if (players.length === 0) return '';
  if (players.length === 1) return getInitials(players[0]);
  return `${getInitials(players[0])}+${players.length - 1}`;
};

const BoardGrid: React.FC<BoardGridProps> = ({ board, highlights, live, selectedPlayer, leftTeamName, topTeamName, highlightedCoords, showOpenSquares = false }) => {
  const isFinal = live?.state === 'post';
  const isFilteringByPlayer = selectedPlayer.trim().length > 0;
  const [viewQuarter, setViewQuarter] = React.useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');

  // Auto-switch view to current quarter during live game
  React.useEffect(() => {
    if (live && board.isDynamic) {
      if (live.state === 'post' || live.period === 4) setViewQuarter('Q4');
      else if (live.period === 3) setViewQuarter('Q3');
      else if (live.period === 2) setViewQuarter('Q2');
      else setViewQuarter('Q1');
    }
  }, [live?.period, live?.state, board.isDynamic]);

  // Determine current axes to display
  const currentLeftAxis = React.useMemo(() => {
    if (!board.isDynamic) return board.leftAxis.slice(0, 10);
    return (board.leftAxisByQuarter?.[viewQuarter] || board.leftAxis).slice(0, 10);
  }, [board, viewQuarter]);

  const currentTopAxis = React.useMemo(() => {
    if (!board.isDynamic) return board.topAxis.slice(0, 10);
    return (board.topAxisByQuarter?.[viewQuarter] || board.topAxis).slice(0, 10);
  }, [board, viewQuarter]);

  // Build a map of winning cell IDs to their milestone labels
  // Cell ID format: `${topDigit}:${leftDigit}` (using : to avoid confusion with score format)
  const winningCellsMap = React.useMemo(() => {
    const map: Record<string, string[]> = {};

    Object.entries(highlights.quarterWinners).forEach(([milestone, scoreKey]) => {
      // scoreKey is in format "topDigit-leftDigit"
      const parts = scoreKey.split('-');
      if (parts.length !== 2) return;

      const [topDigit, leftDigit] = parts;
      const cellId = `${topDigit}:${leftDigit}`;

      // For dynamic boards, only include milestones for current view quarter
      if (board.isDynamic) {
        const quarterKey = milestone === 'Final' ? 'Q4' : milestone;
        if (quarterKey !== viewQuarter) return;
      }

      if (!map[cellId]) map[cellId] = [];
      map[cellId].push(milestone);
    });

    return map;
  }, [highlights.quarterWinners, board.isDynamic, viewQuarter]);

  // Helper to create cell ID from digits
  const getCellId = (topDigit: number, leftDigit: number) => `${topDigit}:${leftDigit}`;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-3 md:gap-4">
      {/* Quarter Selector for Dynamic Boards — hard segmented control */}
      {board.isDynamic && (
        <div className="flex items-center gap-px bg-ink p-px border border-ink">
          <span className="oa-slab text-ink/50 px-3 bg-broadcast-white self-stretch flex items-center">Axis</span>
          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
            <button
              key={q}
              onClick={() => setViewQuarter(q)}
              className={`oa-slab px-4 py-2 transition-colors ${viewQuarter === q
                ? 'bg-cardinal text-broadcast-white'
                : 'bg-broadcast-white text-ink/60 hover:bg-newsprint hover:text-ink'
                }`}
            >
              {q === 'Q4' ? 'Final' : q}
            </button>
          ))}
        </div>
      )}

      {/* Main Board Container — deliberately sharp, 3px ink rule, no radius/shadow */}
      <div className={`gridone-board-frame relative overflow-visible bg-broadcast-white w-full max-w-[920px] aspect-square mx-auto ${
        isFilteringByPlayer
          ? 'ring-[3px] ring-inset ring-cardinal'
          : 'ring-[3px] ring-inset ring-ink'
      }`}>

        <table className="gridone-board-grid border-collapse table-fixed w-full h-full">
          <colgroup>
            <col className="w-[7%] md:w-[5%]" />
            <col className="w-[7%] md:w-[5%]" />
            {Array(10).fill(0).map((_, i) => <col key={i} className="w-[8.6%] md:w-[9%]" />)}
          </colgroup>

          <thead>
            {/* Top Team Header — opaque chyron slab */}
            <tr className="h-8 md:h-10">
              <th colSpan={2} className="bg-transparent border-none sticky top-0 z-40"></th>
              <th colSpan={10} className="oa-slab bg-chyron text-broadcast-white text-center align-middle p-1 sticky top-0 z-40">
                {topTeamName}
              </th>
            </tr>
            {/* Top Axis Numbers */}
            <tr className="h-9 md:h-11">
              <th className="bg-transparent border-none sticky top-8 md:top-10 z-40"></th>
              <th className="oa-board-axis bg-cardinal-deep text-broadcast-white/40 border-r border-b border-cardinal-deep relative p-0 sticky top-8 md:top-10 z-40">
                <div className="absolute inset-0 flex items-center justify-center rotate-[-45deg]">TOP</div>
              </th>
              {currentTopAxis.map((n, i) => (
                <th key={i} className="oa-board-axis bg-cardinal-deep text-broadcast-white border-b border-r border-cardinal last:border-r-0 align-middle sticky top-8 md:top-10 z-40">
                  <div className="flex items-center justify-center h-9 md:h-11 w-full">{n}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentLeftAxis.map((leftDigit, rowIndex) => (
              <tr key={rowIndex} className="h-[8.6%] md:h-auto">
                {/* Left Team Header — opaque chyron slab, vertical */}
                {rowIndex === 0 && (
                  <th rowSpan={10} className="bg-chyron border-r border-ink text-center relative p-0 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="oa-slab whitespace-nowrap text-broadcast-white"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                      >
                        {leftTeamName}
                      </div>
                    </div>
                  </th>
                )}

                {/* Left Axis Numbers */}
                <th className="oa-board-axis bg-cardinal-deep text-broadcast-white border-r border-b border-cardinal last:border-b-0 align-middle">
                  <div className="flex items-center justify-center h-full w-full">{leftDigit}</div>
                </th>

                {/* The Squares */}
                {currentTopAxis.map((topDigit, colIndex) => {
                  const tDigit = topDigit ?? -1;
                  const lDigit = leftDigit ?? -1;

                  const cellIndex = (rowIndex * 10) + colIndex;
                  const players = board.squares[cellIndex] || [];
                  const isOpenSquare = showOpenSquares && players.length === 0;
                  const hasSelectedPlayer = Boolean(
                    selectedPlayer
                    && players.includes(selectedPlayer)
                  );

                  // Use new cell ID based approach for winner matching
                  const cellId = getCellId(tDigit, lDigit);
                  const winningLabels = winningCellsMap[cellId] || [];
                  const hasFinishedWinner = winningLabels.length > 0;

                  // Live score matching  
                  const isLiveScore = !isFinal && live &&
                    tDigit === (live.topScore % 10) &&
                    lDigit === (live.leftScore % 10) && (
                      !board.isDynamic ||
                      (viewQuarter === (live.period <= 1 ? 'Q1' : live.period === 2 ? 'Q2' : live.period === 3 ? 'Q3' : 'Q4'))
                    );

                  // Scenario highlight matching
                  const isHighlightedScenario = highlightedCoords &&
                    tDigit === (highlightedCoords.top % 10) &&
                    lDigit === (highlightedCoords.left % 10);

                  // On Air cell — opaque planes, hard rules, gold = resolved
                  let cellClass = "oa-q relative border-r border-b border-newsprint last:border-r-0 p-0.5 cursor-pointer ";

                  if (isFilteringByPlayer && !hasSelectedPlayer) {
                    // Dimmed out of filter — a flat newsprint knockout, no black wash
                    cellClass += "bg-newsprint opacity-40 ";
                  } else {
                    cellClass += "bg-broadcast-white hover:bg-newsprint ";
                  }
                  if (isOpenSquare) cellClass += "ring-1 ring-inset ring-ink/35 ";

                  // Highlight states — opaque fills + inset key lines, never glow
                  if (isHighlightedScenario) {
                    // Scenario hover — ink key line
                    cellClass += "z-50 bg-newsprint ring-[3px] ring-inset ring-ink ";
                  } else if (isLiveScore) {
                    // Current winning cell — gold fill, the resolution color live
                    cellClass += "z-40 bg-gold ring-[3px] ring-inset ring-gold-deep ";
                  } else if (hasSelectedPlayer) {
                    // Player search match — cardinal key line (off-system blue removed)
                    cellClass += "z-30 bg-cardinal-subtle ring-[3px] ring-inset ring-cardinal ";
                  } else if (hasFinishedWinner) {
                    // Past winner cell — settled gold
                    cellClass += "z-30 bg-gold ring-1 ring-inset ring-gold-deep ";
                  }

                  const isWonCell = isLiveScore || hasFinishedWinner;

                  return (
                    <td
                      key={colIndex}
                      className={`${cellClass} group focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-cardinal`}
                      tabIndex={0}
                      aria-label={`${players.length > 0 ? players.join(', ') : isOpenSquare ? 'Open square' : 'Unassigned square'}, ${topTeamName} ${tDigit}, ${leftTeamName} ${lDigit}${winningLabels.length ? `, winner for ${winningLabels.join(', ')}` : ''}`}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <div
                          className={`oa-board-name text-center flex items-center justify-center w-full ${isWonCell ? 'text-ink font-bold' : hasSelectedPlayer ? 'text-ink font-bold' : isHighlightedScenario ? 'text-ink font-bold' : 'text-ink/70'
                            }`}
                        >
                          {isOpenSquare ? <span className="oa-slab text-[9px] text-ink/65 md:text-[10px]">OPEN</span> : formatCellDisplay(players)}
                        </div>
                      </div>

                      {/* Live winning cell — a small opaque gold-deep square marker */}
                      {isLiveScore && (
                        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-gold-deep pointer-events-none" />
                      )}

                      {/* Tooltip — opaque chyron slab, hard corners */}
                      <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1.5 bg-chyron ring-[3px] ring-ink opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity duration-150 pointer-events-none whitespace-nowrap">
                        <div className="oa-slab text-broadcast-white">
                          {players.length > 0 ? players.join(', ') : isOpenSquare ? 'OPEN' : 'Empty'}
                        </div>
                        <div className="oa-data text-[10px] text-broadcast-white/60">
                          {lDigit}/{tDigit}
                        </div>
                        {winningLabels.length > 0 && (
                          <div className="oa-slab text-[10px] text-gold mt-0.5">
                            Won: {winningLabels.map(l => l === 'Q2' ? 'Half' : l).join(', ')}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

  );
};

const arePropsEqual = (prev: BoardGridProps, next: BoardGridProps) => {
  // 1. Generic props check (shallow)
  // Check board reference (should change if board updates)
  if (prev.board !== next.board) return false;
  if (prev.selectedPlayer !== next.selectedPlayer) return false;
  if (prev.leftTeamName !== next.leftTeamName) return false;
  if (prev.topTeamName !== next.topTeamName) return false;
  if (prev.showOpenSquares !== next.showOpenSquares) return false;

  // Highlighted Coords deep check
  const pCoords = prev.highlightedCoords;
  const nCoords = next.highlightedCoords;
  if (pCoords !== nCoords) {
    if (!pCoords || !nCoords) return false;
    if (pCoords.left !== nCoords.left || pCoords.top !== nCoords.top) return false;
  }

  // Highlights ref check (updates via useMemo in parent)
  if (prev.highlights !== next.highlights) return false;

  // 2. Live Data Check - The Critical Part
  // If one is null and other isn't, re-render
  if (!prev.live && !next.live) return true;
  if (!prev.live || !next.live) return false;

  // Deep compare only visual fields (IGNORE CLOCK)
  return (
    prev.live.state === next.live.state &&
    prev.live.period === next.live.period &&
    prev.live.leftScore === next.live.leftScore &&
    prev.live.topScore === next.live.topScore &&
    // Check quarter scores length/values if needed, but current/total scores usually suffice for grid winning cells
    // Technically quarter scores might change late? Let's check keys length just in case
    Object.keys(prev.live.quarterScores).length === Object.keys(next.live.quarterScores).length
  );
};

export default React.memo(BoardGrid, arePropsEqual);
