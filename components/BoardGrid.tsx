
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
    if (!board.isDynamic) return board.bearsAxis;
    return board.bearsAxisByQuarter?.[viewQuarter] || board.bearsAxis;
  }, [board, viewQuarter]);

  const currentOppAxis = React.useMemo(() => {
    if (!board.isDynamic) return board.oppAxis;
    return board.oppAxisByQuarter?.[viewQuarter] || board.oppAxis;
  }, [board, viewQuarter]);

  // Helper to find highlight key from digit scores
  const getHighlightKey = (topDigit: number, leftDigit: number) => `${topDigit}-${leftDigit}`;

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
      <div className="relative rounded-xl overflow-hidden bg-[#1c1c1e]/60 border border-white/[0.08]
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

                  const scoreKey = getHighlightKey(tDigit, lDigit);
                  const isLiveScore = !isFinal && live && scoreKey === `${live.topScore % 10}-${live.leftScore % 10}` && (
                    !board.isDynamic ||
                    (viewQuarter === (live.period <= 1 ? 'Q1' : live.period === 2 ? 'Q2' : live.period === 3 ? 'Q3' : 'Q4'))
                  );

                  const isHighlightedScenario = highlightedCoords && scoreKey === `${highlightedCoords.top % 10}-${highlightedCoords.left % 10}`;

                  const winningLabels = Object.keys(highlights.quarterWinners).filter(k => {
                    if (highlights.quarterWinners[k] !== scoreKey) return false;
                    if (board.isDynamic) {
                      const quarterKey = k === 'Final' ? 'Q4' : k;
                      return quarterKey === viewQuarter;
                    }
                    return true;
                  });

                  const hasFinishedWinner = winningLabels.length > 0;

                  // Clean cell styling
                  let cellClass = "relative border-r border-b border-white/[0.08] last:border-r-0 transition-all duration-200 p-0.5 overflow-hidden cursor-pointer ";

                  if (selectedPlayer && !hasSelectedPlayer) {
                    cellClass += "bg-black/40 opacity-25 ";
                  } else {
                    cellClass += "bg-white/[0.02] hover:bg-white/[0.06] ";
                  }

                  // Highlight states - gold outline, subtle fill
                  if (isHighlightedScenario) {
                    cellClass += "z-50 bg-white/15 ring-2 ring-inset ring-white ";
                  } else if (isLiveScore) {
                    cellClass += "z-40 bg-orange-500/15 ring-2 ring-inset ring-orange-400 ";
                  } else if (hasFinishedWinner) {
                    cellClass += "z-30 bg-[#FFC72C]/10 ring-2 ring-inset ring-[#FFC72C]/70 ";
                  } else if (hasSelectedPlayer) {
                    cellClass += "z-10 bg-white/[0.08] ring-1 ring-inset ring-white/30 ";
                  }

                  return (
                    <td
                      key={colIndex}
                      className={cellClass}
                      title={players.length > 0 ? `${players.join(', ')}\n${lDigit}/${tDigit}` : `Empty\n${lDigit}/${tDigit}`}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <div
                          className={`text-center leading-tight flex items-center justify-center w-full transition-colors ${hasFinishedWinner || isHighlightedScenario || isLiveScore ? 'text-white font-bold' : 'text-white/70 font-medium'
                            }`}
                          style={{ fontSize: 'clamp(9px, 1.3vh, 14px)' }}
                        >
                          {formatCellDisplay(players)}
                        </div>
                      </div>

                      {/* Winner Badges - Compact */}
                      <div className="absolute top-0 right-0 flex flex-col items-end p-[1px] gap-0.5 pointer-events-none z-20">
                        {isFinal && winningLabels.includes('Final') && (
                          <div className="drop-shadow-sm" style={{ fontSize: 'clamp(10px, 1.8vh, 18px)' }}>🏆</div>
                        )}
                        {winningLabels.map(label => (
                          <div key={label}
                            className={`rounded px-1 uppercase font-bold leading-none ${label === 'Final'
                              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black'
                              : 'bg-white text-black'
                              }`}
                            style={{ fontSize: 'clamp(5px, 0.8vh, 9px)', padding: '2px 4px' }}
                          >
                            {label.replace('Final', 'FIN')}
                          </div>
                        ))}
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

export default BoardGrid;

