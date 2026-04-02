
import React from 'react';
import { GameState, BoardData, LiveGameData } from '../types';

interface ScenarioProps {
  game: GameState;
  board: BoardData;
  live: LiveGameData | null;
  onScenarioHover: (coords: { left: number, top: number } | null) => void;
}

const ScenarioCard: React.FC<{
  label: string;
  top: number;
  left: number;
  names: string[];
  payout: string;
  onHover: (coords: { left: number, top: number } | null) => void;
}> = ({ label, top, left, names, payout, onHover }) => (
  <div
    className="bg-white/5 border border-white/5 rounded-xl p-3 hover:bg-cardinal/30 transition-all cursor-pointer group hover:border-gold-glass hover:shadow-[0_0_15px_rgba(157,34,53,0.3)] backdrop-blur-sm"
    onMouseEnter={() => onHover({ left, top })}
    onMouseLeave={() => onHover(null)}
    onTouchStart={() => onHover({ left, top })}
  >
    <div className="flex justify-between items-center mb-1">
      <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider group-hover:text-white transition-colors">{label}</div>
      <div className="text-xs font-black text-gold group-hover:scale-110 transition-transform">{top}-{left}</div>
    </div>
    <div className="flex justify-between items-center">
      <div className="text-[11px] text-white/80 font-medium truncate max-w-[70%]">
        {names.length > 0 ? names.join(', ') : '—'}
      </div>
      <div className="text-[9px] font-bold text-green-400 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
        Wins {payout}
      </div>
    </div>
  </div>
);

const getIndexedPlayers = (board: BoardData, topDigit: number, leftDigit: number) => {
  const colIdx = board.oppAxis.indexOf(topDigit);
  const rowIdx = board.bearsAxis.indexOf(leftDigit);
  if (colIdx === -1 || rowIdx === -1) return [];
  return board.squares[rowIdx * 10 + colIdx] || [];
};

const LeftScenarios: React.FC<ScenarioProps> = ({ game, board, live, onScenarioHover }) => {
  const [expanded, setExpanded] = React.useState(false);
  const currentLeft = live?.leftScore || 0;
  const currentTop = live?.topScore || 0;
  const payout = (live?.period || 1) >= 4 ? (game.payouts?.Final ? `$${game.payouts.Final}` : '$250') : (game.payouts?.Q1 ? `$${game.payouts.Q1}` : '$125');

  const scenarios = [
    { label: 'Safety (+2)', addLeft: 2 },
    { label: 'Field Goal (+3)', addLeft: 3 },
    { label: 'TD Miss XP (+6)', addLeft: 6 },
    { label: 'TD + Kick (+7)', addLeft: 7 },
    { label: 'TD + 2pt (+8)', addLeft: 8 },
  ];

  const visibleScenarios = expanded ? scenarios : scenarios.slice(0, 3);

  return (
    <div className="premium-glass p-5 rounded-3xl transition-all duration-500">
      <div className="flex items-center justify-between mb-4 pl-1">
        <h5 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-team-left shadow-[0_0_8px_var(--team-left)]"></span>
          <span style={{ color: 'var(--team-left)' }}>If {game.leftAbbr} Scores...</span>
        </h5>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[9px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
        >
          {expanded ? 'Show Less' : 'View All'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {visibleScenarios.map((s, i) => {
          const lDigit = (currentLeft + s.addLeft) % 10;
          const tDigit = currentTop % 10;
          const names = getIndexedPlayers(board, tDigit, lDigit);
          return (
            <ScenarioCard
              key={i}
              label={s.label}
              top={tDigit}
              left={lDigit}
              names={names}
              payout={payout}
              onHover={onScenarioHover}
            />
          );
        })}
      </div>
    </div>
  );
};

const TopScenarios: React.FC<ScenarioProps> = ({ game, board, live, onScenarioHover }) => {
  const [expanded, setExpanded] = React.useState(false);
  const currentLeft = live?.leftScore || 0;
  const currentTop = live?.topScore || 0;
  const payout = (live?.period || 1) >= 4 ? (game.payouts?.Final ? `$${game.payouts.Final}` : '$250') : (game.payouts?.Q1 ? `$${game.payouts.Q1}` : '$125');

  const scenarios = [
    { label: 'Safety (+2)', addTop: 2 },
    { label: 'Field Goal (+3)', addTop: 3 },
    { label: 'TD Miss XP (+6)', addTop: 6 },
    { label: 'TD + Kick (+7)', addTop: 7 },
    { label: 'TD + 2pt (+8)', addTop: 8 },
  ];

  const visibleScenarios = expanded ? scenarios : scenarios.slice(0, 3);

  return (
    <div className="premium-glass p-5 rounded-3xl transition-all duration-500">
      <div className="flex items-center justify-between mb-4 pl-1">
        <h5 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-team-top shadow-[0_0_8px_var(--team-top)]"></span>
          <span style={{ color: 'var(--team-top)' }}>If {game.topAbbr} Scores...</span>
        </h5>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[9px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
        >
          {expanded ? 'Show Less' : 'View All'}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {visibleScenarios.map((s, i) => {
          const lDigit = currentLeft % 10;
          const tDigit = (currentTop + s.addTop) % 10;
          const names = getIndexedPlayers(board, tDigit, lDigit);
          return (
            <ScenarioCard
              key={i}
              label={s.label}
              top={tDigit}
              left={lDigit}
              names={names}
              payout={payout}
              onHover={onScenarioHover}
            />
          );
        })}
      </div>
    </div>
  );
};

export default { LeftScenarios, TopScenarios };
