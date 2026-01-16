
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
    <div className="flex flex-col items-center justify-center w-full h-full gap-6">
      {/* Quarter Selector for Dynamic Boards */}
      {board.isDynamic && (
        <div className="flex items-center gap-1 bg-[#1c1c1e]/90 p-1.5 rounded-xl border border-white/10 shadow-lg animate-in fade-in slide-in-from-bottom-4 backdrop-blur-md">
          <span className="text-[10px] uppercase font-bold text-gray-500 px-3 tracking-wider">Viewing Axis:</span>
          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
            <button
              key={q}
              onClick={() => setViewQuarter(q)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${viewQuarter === q
                ? 'bg-white text-black shadow-md scale-105'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
            >
              {q === 'Q4' ? 'Q4/Final' : q}
            </button>
          ))}
        </div>
      )}

      {/* Main Board Container - Premium Glass Effect */}
      <div className="relative shadow-2xl rounded-2xl overflow-hidden bg-[#1c1c1e]/80 backdrop-blur-xl border border-white/10
                      w-auto h-auto 
                      md:h-[80vh] md:max-h-[80vh] md:aspect-square ring-1 ring-white/5">

        <table className="border-collapse table-fixed w-full h-full">
          <colgroup>
            <col className="w-[8%] md:w-[6%]" />
            <col className="w-[8%] md:w-[6%]" />
            {Array(10).fill(0).map((_, i) => <col key={i} className="w-[8.4%] md:w-[8.8%]" />)}
          </colgroup>

          <thead>
            {/* Top Team Header */}
            <tr className="h-[8%] md:h-[10%]">
              <th colSpan={2} className="bg-transparent border-none"></th>
              <th colSpan={10} className="bg-gradient-to-b from-white/10 to-transparent border-b border-white/10 text-center align-middle p-2 backdrop-blur-sm">
                <div className="w-full flex items-center justify-center">
                  <span
                    className="font-bold tracking-widest uppercase truncate drop-shadow-sm text-white"
                    style={{ fontSize: 'clamp(0.8rem, 2vh, 2.5rem)' }}
                  >
                    {topTeamName}
                  </span>
                </div>
              </th>
            </tr>
            {/* Top Axis Numbers */}
            <tr className="h-[6%] md:h-[8%]">
              <th className="bg-transparent border-none"></th>
              <th className="bg-white/5 text-gray-400 text-[8px] md:text-[1.2vh] font-bold border-r border-b border-white/10 relative p-0">
                <div className="absolute inset-0 flex items-center justify-center rotate-[-45deg] opacity-60">TOP</div>
              </th>
              {currentOppAxis.map((n, i) => (
                <th key={i} className="bg-white/5 border-b border-r border-white/10 last:border-r-0 align-middle transition-colors hover:bg-white/10">
                  <div className="flex items-center justify-center h-full w-full">
                    <span className="font-bold text-white" style={{ fontSize: 'clamp(1rem, 2.5vh, 2rem)' }}>{n}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentBearsAxis.map((leftDigit, rowIndex) => (
              <tr key={rowIndex} className="h-[8.6%] md:h-auto">
                {/* Left Team Header */}
                {rowIndex === 0 && (
                  <th rowSpan={10} className="bg-gradient-to-r from-white/10 to-transparent border-r border-white/10 text-center relative p-0 overflow-hidden backdrop-blur-sm">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="whitespace-nowrap font-bold tracking-widest uppercase drop-shadow-sm text-white"
                        style={{
                          writingMode: 'vertical-rl',
                          transform: 'rotate(180deg)',
                          fontSize: 'clamp(0.8rem, 2vh, 2.5rem)',
                        }}
                      >
                        {leftTeamName}
                      </div>
                    </div>
                  </th>
                )}

                {/* Left Axis Numbers */}
                <th className="bg-white/5 border-r border-b border-white/10 last:border-b-0 align-middle transition-colors hover:bg-white/10">
                  <div className="flex items-center justify-center h-full w-full">
                    <span className="font-bold text-white" style={{ fontSize: 'clamp(1rem, 2.5vh, 2rem)' }}>{leftDigit}</span>
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

                  // Project Jony Cell Styling
                  let cellClass = "relative border-r border-b border-white/5 last:border-r-0 last:border-b-0 transition-all duration-300 p-0.5 md:p-1 overflow-hidden ";

                  if (selectedPlayer && !hasSelectedPlayer) {
                    // Dimmed state
                    cellClass += "bg-black/40 opacity-30 grayscale blur-[0.5px] ";
                  } else {
                    // Default State - Subtle Glow
                    cellClass += "bg-white/[0.03] hover:bg-white/[0.08] ";
                  }

                  // Active States (Replacing borders with Rings/Glows)
                  if (isHighlightedScenario) {
                    cellClass += "z-50 bg-white/20 ring-inset ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-[1.02] ";
                  } else if (isLiveScore) {
                    cellClass += "z-40 bg-orange-500/20 ring-inset ring-2 ring-orange-500 animate-pulse shadow-[0_0_20px_rgba(249,115,22,0.4)] ";
                  } else if (hasFinishedWinner) {
                    cellClass += "z-30 bg-[#FFC72C]/20 ring-inset ring-2 ring-[#FFC72C] shadow-[0_0_15px_rgba(255,199,44,0.3)] ";
                  } else if (hasSelectedPlayer) {
                    cellClass += "z-10 bg-white/10 ring-inset ring-1 ring-white/30 ";
                  }

                  return (
                    <td key={colIndex} className={cellClass}>
                      <div className="w-full h-full flex items-center justify-center">
                        <div
                          className={`text-center leading-tight break-words flex items-center justify-center w-full max-h-full transition-colors ${hasFinishedWinner || isHighlightedScenario || isLiveScore ? 'text-white font-bold' : 'text-white/80 font-medium'
                            }`}
                          style={{ fontSize: 'clamp(8px, 1.2vh, 16px)' }}
                        >
                          {players.join(', ')}
                        </div>
                      </div>

                      {/* Winner Badges - Refined */}
                      <div className="absolute top-0 right-0 flex flex-col items-end p-[2px] md:p-1 gap-0.5 pointer-events-none z-20">
                        {isFinal && winningLabels.includes('Final') && (
                          <div className="drop-shadow-lg animate-in zoom-in" style={{ fontSize: 'clamp(12px, 2.2vh, 24px)' }}>🏆</div>
                        )}
                        {winningLabels.map(label => (
                          <div key={label}
                            className={`rounded-md uppercase font-bold leading-none shadow-sm backdrop-blur-md ${label === 'Final'
                              ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-gold/20'
                              : 'bg-white text-black'
                              }`}
                            style={{ fontSize: 'clamp(6px, 1vh, 11px)', padding: '3px 6px' }}
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
