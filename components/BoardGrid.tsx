
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
    <div className="flex flex-col items-center justify-center w-full h-full gap-4">
      {/* Quarter Selector for Dynamic Boards */}
      {board.isDynamic && (
        <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-lg border border-white/10 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-[10px] uppercase font-black text-white/50 px-2">Viewing Axes For:</span>
          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
            <button
              key={q}
              onClick={() => setViewQuarter(q)}
              className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${viewQuarter === q
                  ? 'bg-gold text-black shadow-lg scale-105'
                  : 'text-white/70 hover:bg-white/10'
                }`}
            >
              {q === 'Q4' ? 'Q4/Final' : q}
            </button>
          ))}
        </div>
      )}

      <div className="relative shadow-2xl rounded-xl overflow-hidden liquid-glass
                      w-auto h-auto 
                      md:h-[80vh] md:max-h-[80vh] md:aspect-square">

        <table className="border-collapse table-fixed w-full h-full">
          <colgroup>
            <col className="w-[8%] md:w-[6%]" />
            <col className="w-[8%] md:w-[6%]" />
            {Array(10).fill(0).map((_, i) => <col key={i} className="w-[8.4%] md:w-[8.8%]" />)}
          </colgroup>

          <thead>
            <tr className="h-[8%] md:h-[10%]">
              <th colSpan={2} className="bg-transparent border-none"></th>
              <th colSpan={10} className="glass-top border-b border-white/10 text-center align-middle p-1 backdrop-blur-md">
                <div className="w-full flex items-center justify-center">
                  <span
                    className="font-black tracking-[0.2em] uppercase truncate drop-shadow-sm"
                    style={{ fontSize: 'clamp(0.6rem, 1.5vh, 2rem)', color: 'var(--text-contrast-top)' }}
                  >
                    {topTeamName}
                  </span>
                </div>
              </th>
            </tr>
            <tr className="h-[6%] md:h-[8%]">
              <th className="bg-transparent border-none"></th>
              <th className="glass-top text-white/50 text-[8px] md:text-[1.2vh] font-bold border-r border-b border-white/10 relative p-0">
                <div className="absolute inset-0 flex items-center justify-center rotate-[-45deg]">TOP</div>
              </th>
              {currentOppAxis.map((n, i) => (
                <th key={i} className="glass-top font-black border-b border-r border-white/10 last:border-r-0 align-middle">
                  <span style={{ fontSize: 'clamp(0.8rem, 2vh, 1.5rem)', color: 'var(--text-contrast-top)' }}>{n}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentBearsAxis.map((leftDigit, rowIndex) => (
              <tr key={rowIndex} className="h-[8.6%] md:h-auto">
                {rowIndex === 0 && (
                  <th rowSpan={10} className="glass-left border-r border-white/10 text-center relative p-0 overflow-hidden backdrop-blur-md">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="whitespace-nowrap font-black tracking-[0.2em] uppercase drop-shadow-sm"
                        style={{
                          writingMode: 'vertical-rl',
                          transform: 'rotate(180deg)',
                          fontSize: 'clamp(0.6rem, 1.5vh, 2rem)',
                          color: 'var(--text-contrast-left)'
                        }}
                      >
                        {leftTeamName}
                      </div>
                    </div>
                  </th>
                )}

                <th className="glass-left font-black border-r border-b border-white/10 last:border-b-0 align-middle">
                  <span style={{ fontSize: 'clamp(0.8rem, 2vh, 1.5rem)', color: 'var(--text-contrast-left)' }}>{leftDigit}</span>
                </th>

                {currentOppAxis.map((topDigit, colIndex) => {
                  // Ensure we handle null digits safely (though should be 0-9)
                  const tDigit = topDigit ?? -1;
                  const lDigit = leftDigit ?? -1;

                  const cellIndex = (rowIndex * 10) + colIndex;
                  const players = board.squares[cellIndex] || [];
                  const hasSelectedPlayer = selectedPlayer && players.some(p => p.toLowerCase().includes(selectedPlayer.toLowerCase()));

                  const scoreKey = getHighlightKey(tDigit, lDigit);
                  const isLiveScore = !isFinal && live && scoreKey === `${live.topScore % 10}-${live.leftScore % 10}` && (
                    // Only show live score highlight if we are viewing the CORRECT quarter for the live game
                    // OR if it's not dynamic (standard board works for all quarters)
                    !board.isDynamic ||
                    (viewQuarter === (live.period <= 1 ? 'Q1' : live.period === 2 ? 'Q2' : live.period === 3 ? 'Q3' : 'Q4'))
                  );

                  const isHighlightedScenario = highlightedCoords && scoreKey === `${highlightedCoords.top % 10}-${highlightedCoords.left % 10}`;

                  // Filter winners that match THIS quarter's axis numbers
                  const winningLabels = Object.keys(highlights.quarterWinners).filter(k => {
                    // Check if exact match
                    if (highlights.quarterWinners[k] !== scoreKey) return false;
                    // For dynamic boards, only show the winner badge if we are viewing that specific quarter
                    if (board.isDynamic) {
                      const quarterKey = k === 'Final' ? 'Q4' : k;
                      return quarterKey === viewQuarter;
                    }
                    return true;
                  });

                  const hasFinishedWinner = winningLabels.length > 0;

                  let cellClass = "relative border-r border-b border-white/5 last:border-r-0 last:border-b-0 transition-all duration-200 p-0.5 md:p-1 overflow-hidden ";

                  if (selectedPlayer && !hasSelectedPlayer) {
                    cellClass += "bg-[#050101]/80 opacity-40 grayscale ";
                  } else {
                    cellClass += "bg-transparent ";
                  }

                  if (isHighlightedScenario) {
                    cellClass += "z-50 border-2 border-white scale-[1.02] shadow-[0_0_15px_rgba(255,255,255,0.5)] ";
                  } else if (isLiveScore) {
                    cellClass += "z-40 border-2 border-orange-500 animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.6)] ";
                  } else if (hasFinishedWinner) {
                    cellClass += "z-10 border-2 border-[#FFC72C]/40 shadow-[0_0_10px_rgba(255,199,44,0.3)] ";
                  } else if (hasSelectedPlayer) {
                    cellClass += "z-10 glass-left border border-white/20 ";
                  }

                  return (
                    <td key={colIndex} className={cellClass}>
                      <div className="w-full h-full flex items-center justify-center">
                        <div
                          className={`text-center leading-tight break-words flex items-center justify-center w-full max-h-full ${hasFinishedWinner || isHighlightedScenario || isLiveScore ? 'text-white font-black' : 'text-white/80 font-medium'}`}
                          style={{ fontSize: 'clamp(7px, 1.1vh, 14px)' }}
                        >
                          {players.join(', ')}
                        </div>
                      </div>

                      <div className="absolute top-0 right-0 flex flex-col items-end p-[1px] md:p-1 gap-0.5 pointer-events-none z-20">
                        {isFinal && winningLabels.includes('Final') && (
                          <div className="drop-shadow-md animate-in zoom-in" style={{ fontSize: 'clamp(10px, 2vh, 20px)' }}>🏆</div>
                        )}
                        {winningLabels.map(label => (
                          <div key={label}
                            className={`rounded uppercase font-bold leading-none shadow-sm ${label === 'Final' ? 'glass-top text-white border border-white/20' : 'bg-white text-black'}`}
                            style={{ fontSize: 'clamp(5px, 0.8vh, 10px)', padding: '2px 4px' }}
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
