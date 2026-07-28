
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
    className="bg-broadcast-white ring-1 ring-inset ring-ink p-3 hover:bg-newsprint transition-colors cursor-pointer group"
    onMouseEnter={() => onHover({ left, top })}
    onMouseLeave={() => onHover(null)}
    onTouchStart={() => onHover({ left, top })}
  >
    <div className="flex justify-between items-center mb-1">
      <div className="oa-slab text-ink/60 group-hover:text-ink transition-colors">{label}</div>
      <div className="oa-data text-xs font-bold text-cardinal">{top}-{left}</div>
    </div>
    <div className="flex justify-between items-center">
      <div className="oa-data text-[11px] text-ink/80 truncate max-w-[70%]">
        {names.length > 0 ? names.join(', ') : '—'}
      </div>
      <div className="oa-slab text-ink bg-gold px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
    <div className="bg-broadcast-white ring-[3px] ring-ink p-5">
      <div className="flex items-center justify-between mb-4 pl-1">
        <h5 className="oa-slab flex items-center gap-2 text-ink">
          <span className="w-1.5 h-1.5 bg-cardinal"></span>
          If {game.leftAbbr} Scores...
        </h5>
        <button
          onClick={() => setExpanded(!expanded)}
          className="oa-slab text-ink/50 hover:text-ink transition-colors"
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
    <div className="bg-broadcast-white ring-[3px] ring-ink p-5">
      <div className="flex items-center justify-between mb-4 pl-1">
        <h5 className="oa-slab flex items-center gap-2 text-ink">
          <span className="w-1.5 h-1.5 bg-ink"></span>
          If {game.topAbbr} Scores...
        </h5>
        <button
          onClick={() => setExpanded(!expanded)}
          className="oa-slab text-ink/50 hover:text-ink transition-colors"
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
