
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

const BoardGrid: React.FC<BoardGridProps> = ({ board, highlights, live, selectedPlayer, leftTeamName, topTeamName, highlightedCoords }) => {
  const isFinal = live?.state === 'post';
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
  const currentBearsAxis = React.useMemo(() => {
    if (!board.isDynamic) return board.bearsAxis.slice(0, 10);
    return (board.bearsAxisByQuarter?.[viewQuarter] || board.bearsAxis).slice(0, 10);
  }, [board, viewQuarter]);

  const currentOppAxis = React.useMemo(() => {
    if (!board.isDynamic) return board.oppAxis.slice(0, 10);
    return (board.oppAxisByQuarter?.[viewQuarter] || board.oppAxis).slice(0, 10);
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

  // Helper for live score matching (still uses dash format for backwards compat)
  const getLiveScoreKey = (topScore: number, leftScore: number) => `${topScore % 10}-${leftScore % 10}`;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-4">
      {/* Quarter Selector for Dynamic Boards */}
      {board.isDynamic && (
        <div className="flex items-center gap-1 bg-[#1c1c1e]/90 p-1 rounded-lg border border-white/10 shadow-lg">
          <span className="text-[10px] uppercase font-semibold text-white/40 px-2 tracking-wide">Axis:</span>
          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
            <button
              key={q}
              onClick={() => setViewQuarter(q)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewQuarter === q
                ? 'bg-white text-black'
                : 'text-white/50 hover:text-white hover:bg-white/10'
                }`}
            >
              {q === 'Q4' ? 'Final' : q}
            </button>
          ))}
        </div>
      )}

      {/* Main Board Container */}
      <div className="relative rounded-xl overflow-visible bg-[#1c1c1e]/60 border border-white/[0.08]
                      w-auto h-auto 
                      md:h-[75vh] md:max-h-[75vh] md:aspect-square">

        <table className="border-collapse table-fixed w-full h-full">
          <colgroup>
            <col className="w-[7%] md:w-[5%]" />
            <col className="w-[7%] md:w-[5%]" />
            {Array(10).fill(0).map((_, i) => <col key={i} className="w-[8.6%] md:w-[9%]" />)}
          </colgroup>

          <thead>
            {/* Top Team Header - Compact */}
            <tr className="h-[6%] md:h-[7%]">
              <th colSpan={2} className="bg-transparent border-none"></th>
              <th colSpan={10} className="bg-white/[0.03] border-b border-white/[0.08] text-center align-middle p-1">
                <span className="font-bold tracking-wider uppercase text-white/80" style={{ fontSize: 'clamp(0.65rem, 1.5vh, 1.2rem)' }}>
                  {topTeamName}
                </span>
              </th>
            </tr>
            {/* Top Axis Numbers */}
            <tr className="h-[5%] md:h-[6%]">
              <th className="bg-transparent border-none"></th>
              <th className="bg-white/[0.03] text-white/30 text-[7px] md:text-[9px] font-medium border-r border-b border-white/[0.08] relative p-0">
                <div className="absolute inset-0 flex items-center justify-center rotate-[-45deg] opacity-50">TOP</div>
              </th>
              {currentOppAxis.map((n, i) => (
                <th key={i} className="bg-white/[0.03] border-b border-r border-white/[0.08] last:border-r-0 align-middle transition-colors hover:bg-white/[0.06]">
                  <div className="flex items-center justify-center h-full w-full">
                    <span className="font-bold text-white" style={{ fontSize: 'clamp(0.8rem, 2vh, 1.5rem)' }}>{n}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentBearsAxis.map((leftDigit, rowIndex) => (
              <tr key={rowIndex} className="h-[8.6%] md:h-auto">
                {/* Left Team Header - Compact */}
                {rowIndex === 0 && (
                  <th rowSpan={10} className="bg-white/[0.03] border-r border-white/[0.08] text-center relative p-0 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="whitespace-nowrap font-bold tracking-wider uppercase text-white/80"
                        style={{
                          writingMode: 'vertical-rl',
                          transform: 'rotate(180deg)',
                          fontSize: 'clamp(0.65rem, 1.5vh, 1.2rem)',
                        }}
                      >
                        {leftTeamName}
                      </div>
                    </div>
                  </th>
                )}

                {/* Left Axis Numbers */}
                <th className="bg-white/[0.03] border-r border-b border-white/[0.08] last:border-b-0 align-middle transition-colors hover:bg-white/[0.06]">
                  <div className="flex items-center justify-center h-full w-full">
                    <span className="font-bold text-white" style={{ fontSize: 'clamp(0.8rem, 2vh, 1.5rem)' }}>{leftDigit}</span>
                  </div>
                </th>

                {/* The Squares */}
                {currentOppAxis.map((topDigit, colIndex) => {
                  const tDigit = topDigit ?? -1;
                  const lDigit = leftDigit ?? -1;

                  const cellIndex = (rowIndex * 10) + colIndex;
                  const players = board.squares[cellIndex] || [];
                  const hasSelectedPlayer = selectedPlayer && players.some(p => p.toLowerCase().includes(selectedPlayer.toLowerCase()));

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

                  // Clean cell styling - Apple-clean, minimal
                  let cellClass = "relative border-r border-b border-white/[0.06] last:border-r-0 transition-all duration-200 p-0.5 cursor-pointer ";

                  if (selectedPlayer && !hasSelectedPlayer) {
                    cellClass += "bg-black/40 opacity-20 ";
                  } else {
                    cellClass += "bg-white/[0.02] hover:bg-white/[0.05] ";
                  }

                  // Highlight states - thin outlines, subtle fills
                  if (isHighlightedScenario) {
                    // Scenario hover - white outline
                    cellClass += "z-50 bg-white/10 ring-1 ring-inset ring-white/80 ";
                  } else if (isLiveScore) {
                    // Current winning cell - thin gold outline + subtle gold fill
                    cellClass += "z-40 bg-[#FFC72C]/12 ring-1 ring-inset ring-[#FFC72C] ";
                  } else if (hasFinishedWinner) {
                    // Past winner cell - subtle gold hint  
                    cellClass += "z-30 bg-[#FFC72C]/8 ring-1 ring-inset ring-[#FFC72C]/50 ";
                  } else if (hasSelectedPlayer) {
                    cellClass += "z-10 bg-white/[0.06] ring-1 ring-inset ring-white/20 ";
                  }

                  return (
                    <td
                      key={colIndex}
                      className={`${cellClass} group`}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <div
                          className={`text-center leading-tight flex items-center justify-center w-full transition-colors ${isLiveScore ? 'text-[#FFC72C] font-bold' : hasFinishedWinner || isHighlightedScenario ? 'text-white font-semibold' : 'text-white/60 font-medium'
                            }`}
                          style={{ fontSize: 'clamp(9px, 1.3vh, 14px)' }}
                        >
                          {formatCellDisplay(players)}
                        </div>
                      </div>

                      {/* Small gold dot indicator for current winning cell only */}
                      {isLiveScore && (
                        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#FFC72C] pointer-events-none" />
                      )}

                      {/* Custom tooltip - appears on hover */}
                      <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1.5 bg-[#2c2c2e] border border-white/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none whitespace-nowrap">
                        <div className="text-[11px] font-semibold text-white">
                          {players.length > 0 ? players.join(', ') : 'Empty'}
                        </div>
                        <div className="text-[10px] text-white/50 font-mono">
                          {lDigit}/{tDigit}
                        </div>
                        {winningLabels.length > 0 && (
                          <div className="text-[10px] text-[#FFC72C] font-medium mt-0.5">
                            Won: {winningLabels.map(l => l === 'Q2' ? 'Half' : l).join(', ')}
                          </div>
                        )}
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2c2c2e]" />
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

