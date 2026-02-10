
import React, { useState } from 'react';
import { GameState, LiveGameData, BoardData, WinnerHighlights } from '../types';
import { getAxisForQuarter } from '../utils/winnerLogic';

const getLogoUrl = (abbr: string) => {
  const code = abbr.toLowerCase() === 'was' ? 'wsh' : abbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${code}.png`;
};

const formatGameDate = (isoDate?: string): string => {
  if (!isoDate) return 'TBD';
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

type WinnerQuarter = 'Q1' | 'Q2' | 'Q3' | 'Final';

const getPlayersAtScoreForQuarter = (board: BoardData, key: string, quarter: WinnerQuarter): string[] => {
  if (!key) return [];
  const [topDigit, leftDigit] = key.split('-').map(Number);
  const topAxis = getAxisForQuarter(board, 'top', quarter);
  const leftAxis = getAxisForQuarter(board, 'left', quarter);
  const colIdx = topAxis.indexOf(topDigit);
  const rowIdx = leftAxis.indexOf(leftDigit);
  if (colIdx === -1 || rowIdx === -1) return [];
  return board.squares[rowIdx * 10 + colIdx] || [];
};

// ========== NEW PLAYER VIEW COMPONENTS ==========

// Compact live strip for top of player view with integrated Live|Board toggle
const LiveStrip: React.FC<{
  game: GameState;
  live: LiveGameData | null;
  isSynced?: boolean;
  activeTab?: 'live' | 'board';
  onTabChange?: (tab: 'live' | 'board') => void;
}> = ({ game, live, isSynced, activeTab = 'live', onTabChange }) => {
  const leftDigit = live ? live.leftScore % 10 : '–';
  const topDigit = live ? live.topScore % 10 : '–';
  const isLive = live?.state === 'in';
  const isFinal = live?.state === 'post';

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
      {/* Matchup */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white">{game.leftAbbr}</span>
        <span className="text-xs text-white/40">vs</span>
        <span className="text-sm font-semibold text-white">{game.topAbbr}</span>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            {live?.detail || live?.clock || 'Live'}
          </span>
        )}
        {isFinal && <span className="text-xs font-semibold text-white/60">Final</span>}
        {!isLive && !isFinal && live?.state === 'pre' && (
          <span className="text-xs text-white/40">Waiting for kickoff{game.dates ? ` - ${formatGameDate(game.dates)}` : ''}</span>
        )}
      </div>

      {/* Right side: digits + toggle */}
      <div className="flex items-center gap-4">
        {/* Current digits */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10">
            <span className="text-[10px] text-white/50 font-medium">{game.leftAbbr}</span>
            <span className="text-base font-bold text-white tabular-nums">{leftDigit}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10">
            <span className="text-[10px] text-white/50 font-medium">{game.topAbbr}</span>
            <span className="text-base font-bold text-white tabular-nums">{topDigit}</span>
          </div>
          {isSynced && <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" title="Live sync"></span>}
        </div>

        {/* Live|Board Toggle - Desktop only, integrated into strip */}
        {onTabChange && (
          <div className="hidden md:flex p-0.5 bg-white/[0.06] border border-white/10 rounded-full">
            <button
              onClick={() => onTabChange('live')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${activeTab === 'live' ? 'bg-white text-black' : 'text-white/50 hover:text-white'}`}
            >
              Live
            </button>
            <button
              onClick={() => onTabChange('board')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${activeTab === 'board' ? 'bg-white text-black' : 'text-white/50 hover:text-white'}`}
            >
              Board
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Milestone type for winner tracking
type Milestone = 'Q1' | 'Half' | 'Q3' | 'Final';
type MilestoneState = 'live' | 'locked' | 'pending';

interface MilestoneData {
  label: string;
  winner: string;
  digits: string;
  state: MilestoneState;
  prize?: string;
}

// Derive current milestone from game state
const getCurrentMilestone = (live: LiveGameData | null): Milestone => {
  if (!live) return 'Q1';
  const { state, period } = live;
  if (state === 'post') return 'Final';
  if (period <= 1) return 'Q1';
  if (period === 2) return 'Half';
  if (period === 3) return 'Q3';
  return 'Final';
};

// Get milestone display label
const getMilestoneLabel = (milestone: Milestone, isLive: boolean): string => {
  const labels: Record<Milestone, string> = {
    'Q1': 'Q1 Winner',
    'Half': 'Halftime Winner',
    'Q3': 'Q3 Winner',
    'Final': 'Final Winner'
  };
  return labels[milestone] + (isLive ? ' (Live)' : '');
};

// Hero card showing the currently relevant milestone winner
const WinnerHeroCard: React.FC<{
  game: GameState;
  board: BoardData;
  live: LiveGameData | null;
  highlights: WinnerHighlights;
}> = ({ game, board, live, highlights }) => {
  if (!live) {
    return (
      <div className="p-8 rounded-[20px] bg-white/[0.03] border border-white/10 text-center">
        <p className="text-lg font-medium text-white/40">Waiting for game to start</p>
        <p className="text-sm text-white/25 mt-1">{game.dates || 'Date not set'}</p>
      </div>
    );
  }

  const currentMilestone = getCurrentMilestone(live);
  const isFinal = live.state === 'post';
  const isLive = live.state === 'in';

  // Get the current score key - map Half to Q2 for data lookup
  const qKey = currentMilestone === 'Half' ? 'Q2' : currentMilestone;
  const currentKey = isFinal
    ? `${live.topScore % 10}-${live.leftScore % 10}`
    : highlights.quarterWinners[qKey] || `${live.topScore % 10}-${live.leftScore % 10}`;

  // Parse digits from key
  const [topDigitStr, leftDigitStr] = currentKey.split('-');
  const topDigit = parseInt(topDigitStr) || 0;
  const leftDigit = parseInt(leftDigitStr) || 0;

  const winnerQuarter: WinnerQuarter = currentMilestone === 'Half'
    ? 'Q2'
    : (currentMilestone as WinnerQuarter);
  const winners = getPlayersAtScoreForQuarter(board, currentKey, winnerQuarter);

  return (
    <div className="p-6 md:p-8 rounded-[20px] bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 relative overflow-hidden">
      <div className="relative z-10">
        {/* Label */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {isLive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>}
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            {getMilestoneLabel(currentMilestone, isLive)}
          </span>
        </div>
        {live.state === 'pre' && (
          <p className="text-xs text-white/40 text-center mb-4">
            Game has not started yet. Waiting for kickoff{game.dates ? ` on ${formatGameDate(game.dates)}` : ''}.
          </p>
        )}

        {/* Winner name - hero size */}
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4 tracking-tight">
          {winners.length > 0 ? winners[0] : 'No owner'}
          {winners.length > 1 && <span className="text-white/40 text-xl ml-2">+{winners.length - 1}</span>}
        </h2>

        {/* Digits display */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/20 border border-white/10">
            <img src={getLogoUrl(game.leftAbbr)} alt="" className="w-6 h-6 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
            <span className="text-2xl font-bold text-white tabular-nums">{leftDigit}</span>
          </div>
          <span className="text-white/30 text-lg">/</span>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/20 border border-white/10">
            <img src={getLogoUrl(game.topAbbr)} alt="" className="w-6 h-6 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
            <span className="text-2xl font-bold text-white tabular-nums">{topDigit}</span>
          </div>
        </div>

        {/* Coordinate key */}
        <div className="text-center mt-3">
          <span className="text-xs font-mono text-white/30 px-2 py-1 rounded bg-black/20">{currentKey}</span>
        </div>
      </div>
    </div>
  );
};

// Compact milestone row showing Q1, Half, Q3, Final winner status
// Compact milestone row showing Q1, Half, Q3, Final winner status with payouts
const WinnersMilestoneRow: React.FC<{
  game: GameState;
  board: BoardData;
  live: LiveGameData | null;
  highlights: WinnerHighlights;
}> = ({ game, board, live, highlights }) => {
  const currentMilestone = getCurrentMilestone(live);
  const isFinal = live?.state === 'post';
  const period = live?.period || 0;

  // Payout amounts per milestone (use game.payouts or defaults)
  const payouts = game.payouts || { Q1: 125, Q2: 125, Q3: 125, Final: 250 };
  const getPayout = (qKey: string): string => {
    const amount = payouts[qKey as keyof typeof payouts] || 0;
    return `$${amount}`;
  };

  // Build milestone data array
  const milestones: { key: Milestone; label: string; qKey: string }[] = [
    { key: 'Q1', label: 'Q1', qKey: 'Q1' },
    { key: 'Half', label: 'Half', qKey: 'Q2' },
    { key: 'Q3', label: 'Q3', qKey: 'Q3' },
    { key: 'Final', label: 'Final', qKey: 'Final' },
  ];

  const getMilestoneState = (key: Milestone): MilestoneState => {
    if (isFinal) return 'locked';

    // Map milestone to period number for comparison
    const milestonePeriods: Record<Milestone, number> = {
      'Q1': 1, 'Half': 2, 'Q3': 3, 'Final': 4
    };
    const msNumber = milestonePeriods[key];

    if (period > msNumber || (key === 'Half' && period > 2)) return 'locked';
    if (key === currentMilestone) return 'live';
    return 'pending';
  };

  const getMilestoneData = (key: Milestone, qKey: string): MilestoneData => {
    const state = getMilestoneState(key);
    const scoreKey = qKey === 'Final'
      ? (live ? `${live.topScore % 10}-${live.leftScore % 10}` : null)
      : highlights.quarterWinners[qKey];

    if (!scoreKey || state === 'pending') {
      return { label: key === 'Half' ? 'Half' : key, winner: '—', digits: '—', state };
    }

    // Parse digits and get winner
    const [topDigitStr, leftDigitStr] = scoreKey.split('-');
    const topDigit = parseInt(topDigitStr) || 0;
    const leftDigit = parseInt(leftDigitStr) || 0;
    const winners = getPlayersAtScoreForQuarter(board, scoreKey, qKey as WinnerQuarter);

    return {
      label: key === 'Half' ? 'Half' : key,
      winner: winners.length > 0 ? winners[0] : 'No owner',
      digits: `${leftDigit}/${topDigit}`,
      state,
    };
  };

  if (!live) {
    // Show payouts even when game hasn't started
    return (
      <div className="rounded-[20px] bg-white/[0.03] border border-white/10 overflow-hidden">
        <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
          {milestones.map(({ key, qKey }) => (
            <div key={key} className="p-3 md:p-4 text-center opacity-50">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">{key === 'Half' ? 'Half' : key}</span>
              </div>
              <p className="text-[11px] font-semibold text-white/40 mb-0.5">—</p>
              <p className="text-[11px] font-semibold text-green-400/70">{getPayout(qKey)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] bg-white/[0.03] border border-white/10 overflow-hidden">
      <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
        {milestones.map(({ key, qKey }) => {
          const data = getMilestoneData(key, qKey);
          return (
            <div key={key} className={`p-3 md:p-4 text-center ${data.state === 'pending' ? 'opacity-40' : ''}`}>
              {/* Label with state indicator */}
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {data.state === 'live' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                )}
                {data.state === 'locked' && (
                  <svg className="w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">{data.label}</span>
              </div>

              {/* Winner name */}
              <p className="text-xs md:text-sm font-semibold text-white truncate mb-0.5">{data.winner}</p>

              {/* Payout amount - always visible */}
              <p className="text-[11px] font-semibold text-green-400/70">{getPayout(qKey)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Keep legacy WinningNowHero for backwards compatibility (wraps new components)
const WinningNowHero: React.FC<{
  game: GameState;
  board: BoardData;
  live: LiveGameData | null;
  highlights: WinnerHighlights;
}> = (props) => {
  return (
    <div className="space-y-4">
      <WinnerHeroCard {...props} />
      <WinnersMilestoneRow {...props} />
    </div>
  );
};


// Collapsible payouts accordion
const PayoutsAccordion: React.FC<{
  liveStatus: string;
  lastUpdated: string;
  highlights: WinnerHighlights;
  board: BoardData;
  live: LiveGameData | null;
  game: GameState;
}> = ({ liveStatus, lastUpdated, highlights, board, live, game }) => {
  const [isOpen, setIsOpen] = useState(false);

  type RowStatus = 'awaiting' | 'blank' | 'current' | 'winner';

  const getRowStatus = (isFinal: boolean, qNum: number, state: 'pre' | 'in' | 'post', period: number): RowStatus => {
    if (state === 'pre') return 'awaiting';
    if (state === 'post') return 'winner';
    if (isFinal) return period >= 4 ? 'current' : 'blank';
    if (period < qNum) return 'blank';
    if (period === qNum) return 'current';
    return 'winner';
  };

  const currentStatus = live ? live.state : 'pre';
  const currentPeriod = live ? live.period : 0;
  const p = game.payouts || { Q1: 125, Q2: 125, Q3: 125, Final: 250 };
  const total = Number(p.Q1) + Number(p.Q2) + Number(p.Q3) + Number(p.Final);

  const renderRow = (label: string, amount: number, qKey: string, isFinal = false) => {
    const status = getRowStatus(isFinal, parseInt(qKey.slice(1)) || 4, currentStatus, currentPeriod);
    const lockedKey = status === 'winner' && !live?.isManual ? highlights.quarterWinners[qKey] : null;
    const currentKey = live ? `${live.topScore % 10}-${live.leftScore % 10}` : null;
    const winnerKey = lockedKey || (status === 'current' ? currentKey : null);
    const winners = winnerKey ? getPlayersAtScoreForQuarter(board, winnerKey, qKey as WinnerQuarter) : [];

    return (
      <div key={qKey} className={`flex items-center justify-between py-3 ${!isFinal ? 'border-b border-white/5' : ''}`}>
        <div className="flex-1">
          <div className="text-sm font-medium text-white/80">{label}</div>
          {status !== 'blank' && status !== 'awaiting' && winners.length > 0 && (
            <div className="text-xs text-white/40 mt-0.5">{winners.join(', ')}</div>
          )}
        </div>
        <div className={`text-sm font-semibold ${isFinal ? 'text-[#FFC72C]' : 'text-white/60'}`}>${amount}</div>
      </div>
    );
  };

  return (
    <div className="rounded-[20px] bg-white/[0.03] border border-white/10 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white/80">Payouts</span>
          <span className="text-xs font-medium text-white/40">${total} total</span>
        </div>
        <svg className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-5 pb-4 border-t border-white/5">
          {renderRow('1st quarter', p.Q1, 'Q1')}
          {renderRow('2nd quarter', p.Q2, 'Q2')}
          {renderRow('3rd quarter', p.Q3, 'Q3')}
          {renderRow('Final score', p.Final, 'Final', true)}

          <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5 text-xs text-white/30">
            <span>{liveStatus}</span>
            <span>{lastUpdated || 'Never synced'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ========== END NEW COMPONENTS ==========

const Scoreboard: React.FC<{
  game: GameState;
  live: LiveGameData | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  liveStatus?: string;
}> = ({ game, live, onRefresh, isRefreshing, liveStatus: _liveStatus }) => {
  const isOvertime = live?.period && live.period > 4;
  const isFinal = live?.state === 'post';
  const finalHeader = isOvertime ? 'Final/OT' : 'Final';

  const getSquaresDigit = (team: 'left' | 'top', checkpoint: string) => {
    if (!live || live.isManual) return '—';
    const { period, state, quarterScores, leftScore, topScore } = live;

    if (checkpoint === 'Final') {
      if (state === 'post' || period >= 4) {
        return (team === 'left' ? leftScore : topScore) % 10;
      }
      return '—';
    }

    const qNum = parseInt(checkpoint.slice(1));
    if (state !== 'post' && period < qNum) return '—';
    if (state === 'in' && period === qNum) {
      return (team === 'left' ? leftScore : topScore) % 10;
    }

    let cumulativeTotal = 0;
    for (let i = 1; i <= qNum; i++) {
      const qKey = `Q${i}` as keyof typeof quarterScores;
      cumulativeTotal += quarterScores[qKey][team];
    }

    return cumulativeTotal % 10;
  };

  return (
    <div className="premium-glass p-6 md:p-8 rounded-3xl flex flex-col justify-between shadow-2xl relative overflow-hidden group">
      {/* Subtle Team Glows (Background) */}
      <div className="absolute top-[-50%] left-[-20%] w-[60%] h-[100%] bg-team-left blur-[120px] opacity-[0.07] group-hover:opacity-[0.1] transition-opacity duration-700 pointer-events-none"></div>
      <div className="absolute bottom-[-50%] right-[-20%] w-[60%] h-[100%] bg-team-top blur-[120px] opacity-[0.07] group-hover:opacity-[0.1] transition-opacity duration-700 pointer-events-none"></div>

      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="flex-1">
          <h4 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-3 drop-shadow-sm text-white">
            {game.title || `${game.leftAbbr} vs ${game.topAbbr}`}
            {live?.isManual && (
              <span className="text-[10px] font-bold bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20">MANUAL</span>
            )}
          </h4>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mt-1">{game.meta}</p>
        </div>
        <div className="flex items-center gap-3">
          {live && (
            <div className={`font-bold text-[10px] uppercase px-3 py-1.5 rounded-full tracking-widest shadow-sm border ${live.state === 'in' ? 'bg-green-500/10 border-green-500/20 text-green-400 animate-pulse' : 'bg-white/5 border-white/10 text-gray-400'}`}>
              {live.state === 'post' ? 'Final' : (live.isOvertime ? `OT ${live.clock}` : (live.detail || live.clock))}
            </div>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-2 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 transition-all ${isRefreshing ? 'animate-spin opacity-50' : ''}`}
            title="Refresh Live Scores"
          >
            <svg className="w-4 h-4 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {!game.dates && !live?.isManual && (
        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-2xl text-center backdrop-blur-md relative z-10">
          <p className="text-xs font-bold text-white uppercase tracking-widest">
            Game Date Not Set
          </p>
          <p className="text-[10px] text-gray-400 font-medium mt-1">
            Organizer must set a date to enable live scores.
          </p>
        </div>
      )}

      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-center text-gray-500 relative z-10">
        Squares Scoreboard (Last Digit)
      </div>

      <table className="w-full text-center border-separate border-spacing-x-0 relative z-10">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <th className="text-left py-3 pl-4">Team</th>
            <th className="w-14">Q1</th>
            <th className="w-14">Q2</th>
            <th className="w-14">Q3</th>
            <th className="w-20 text-white">{finalHeader}</th>
          </tr>
        </thead>
        <tbody className="text-base font-medium">
          {/* Left Team Row */}
          <tr className="group/row transition-colors hover:bg-white/5">
            <td className="py-4 pl-4 text-left font-black uppercase tracking-tighter text-xl flex items-center gap-4 text-white rounded-l-2xl">
              <img src={getLogoUrl(game.leftAbbr)} alt={game.leftAbbr} className="w-10 h-10 object-contain drop-shadow-lg" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <span className="relative">
                {game.leftAbbr}
                <div className="absolute -bottom-1 left-0 w-full h-[2px] bg-team-left opacity-50 rounded-full"></div>
              </span>
            </td>
            <td className="font-bold text-xl text-white/90 border-b border-white/5 group-hover/row:border-transparent">{getSquaresDigit('left', 'Q1')}</td>
            <td className="font-bold text-xl text-white/90 border-b border-white/5 group-hover/row:border-transparent">{getSquaresDigit('left', 'Q2')}</td>
            <td className="font-bold text-xl text-white/90 border-b border-white/5 group-hover/row:border-transparent">{getSquaresDigit('left', 'Q3')}</td>
            <td className={`font-black text-2xl text-white rounded-r-2xl transition-transform ${isFinal ? 'scale-110 drop-shadow-glow' : ''}`}>
              {live?.isManual ? (live.leftScore % 10) : getSquaresDigit('left', 'Final')}
            </td>
          </tr>

          {/* Top Team Row */}
          <tr className="group/row transition-colors hover:bg-white/5">
            <td className="py-4 pl-4 text-left font-black uppercase tracking-tighter text-xl flex items-center gap-4 text-white rounded-l-2xl">
              <img src={getLogoUrl(game.topAbbr)} alt={game.topAbbr} className="w-10 h-10 object-contain drop-shadow-lg" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <span className="relative">
                {game.topAbbr}
                <div className="absolute -bottom-1 left-0 w-full h-[2px] bg-team-top opacity-50 rounded-full"></div>
              </span>
            </td>
            <td className="font-bold text-xl text-white/90 border-t border-white/5 group-hover/row:border-transparent">{getSquaresDigit('top', 'Q1')}</td>
            <td className="font-bold text-xl text-white/90 border-t border-white/5 group-hover/row:border-transparent">{getSquaresDigit('top', 'Q2')}</td>
            <td className="font-bold text-xl text-white/90 border-t border-white/5 group-hover/row:border-transparent">{getSquaresDigit('top', 'Q3')}</td>
            <td className={`font-black text-2xl text-white rounded-r-2xl transition-transform ${isFinal ? 'scale-110 drop-shadow-glow' : ''}`}>
              {live?.isManual ? (live.topScore % 10) : getSquaresDigit('top', 'Final')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

type RowStatus = 'awaiting' | 'blank' | 'current' | 'winner';

const getRowStatus = (isFinal: boolean, qNum: number, state: 'pre' | 'in' | 'post', period: number): RowStatus => {
  if (state === 'pre') return 'awaiting';
  if (state === 'post') return 'winner';
  if (isFinal) return period >= 4 ? 'current' : 'blank';
  if (period < qNum) return 'blank';
  if (period === qNum) return 'current';
  return 'winner';
};

const getPlayersAtScore = (board: BoardData, key: string, quarter: WinnerQuarter) => {
  return getPlayersAtScoreForQuarter(board, key, quarter);
};

const Payouts: React.FC<{
  liveStatus: string;
  lastUpdated: string;
  highlights: WinnerHighlights;
  board: BoardData;
  live: LiveGameData | null;
  game: GameState;
}> = ({ liveStatus, lastUpdated, highlights, board, live, game }) => {

  const renderWinnerLine = (label: string, amount: string, status: RowStatus, qKey: string, isFinal: boolean = false) => {
    if (status === 'blank') return null;
    let winnerData: { names: string[], statusText: string, key: string } | null = null;
    let isActive = false;

    if (status === 'winner' && !live?.isManual) {
      const lockedKey = highlights.quarterWinners[qKey];
      if (lockedKey) {
        winnerData = { names: getPlayersAtScore(board, lockedKey, qKey as WinnerQuarter), statusText: 'Winner', key: lockedKey };
      }
    } else if (status === 'current' || live?.isManual) {
      if (live) {
        isActive = true;
        const currentKey = `${live.topScore % 10}-${live.leftScore % 10}`;
        winnerData = { names: getPlayersAtScore(board, currentKey, qKey as WinnerQuarter), statusText: live.isManual ? 'Current Score' : 'Current Holder', key: currentKey };
      }
    }

    return (
      <div className={`group flex flex-col gap-1 transition-all duration-300 ${isFinal ? 'mt-4 pt-4 border-t border-white/10' : 'pb-4 border-b border-white/5 last:border-0'}`}>
        <div className="flex justify-between items-center text-sm">
          <span className={`font-bold uppercase tracking-wide text-gray-400 group-hover:text-white transition-colors`}>{label}</span>
          <span className={`font-black tracking-tight ${isFinal ? 'text-[#FFC72C] text-lg' : 'text-white'}`}>{amount}</span>
        </div>

        {/* Status Area */}
        {status === 'awaiting' ? (
          <div className="flex items-center gap-2 mt-1 opacity-50">
            <div className="w-1 h-1 rounded-full bg-gray-500"></div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Awaiting Kickoff</span>
          </div>
        ) : winnerData ? (
          <div className={`flex flex-col mt-2 p-3 rounded-2xl border backdrop-blur-md transition-all duration-500 ${isActive
            ? 'bg-gradient-to-r from-[#9D2235]/20 to-transparent border-[#9D2235]/30 shadow-sm'
            : 'bg-white/5 border-white/5'
            }`}>

            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                {isActive && <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>}
                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-red-400' : 'text-[#FFC72C]'}`}>
                  {winnerData.statusText}
                </span>
              </div>
              <span className="text-[10px] font-mono text-gray-500 bg-black/20 px-2 py-0.5 rounded-lg border border-white/5">{winnerData.key}</span>
            </div>

            <div className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-gray-200'}`}>
              {winnerData.names.length > 0 ? winnerData.names.join(', ') : 'No Owner'}
            </div>
          </div>
        ) : <div className="h-1"></div>}
      </div>
    );
  };

  const currentStatus = live ? live.state : 'pre';
  const currentPeriod = live ? live.period : 0;
  const p = game.payouts || { Q1: 125, Q2: 125, Q3: 125, Final: 250 };

  return (
    <div className="premium-glass p-6 md:p-8 rounded-3xl h-auto flex flex-col shadow-2xl">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 px-1">Prize Structure</div>
      <div className="flex flex-col justify-start gap-1">
        {renderWinnerLine('1st Quarter', `$${p.Q1}`, getRowStatus(false, 1, currentStatus, currentPeriod), 'Q1')}
        {renderWinnerLine('2nd Quarter', `$${p.Q2}`, getRowStatus(false, 2, currentStatus, currentPeriod), 'Q2')}
        {renderWinnerLine('3rd Quarter', `$${p.Q3}`, getRowStatus(false, 3, currentStatus, currentPeriod), 'Q3')}
        {renderWinnerLine('Final Score', `$${p.Final}`, getRowStatus(true, 4, currentStatus, currentPeriod), 'Final', true)}
      </div>

      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between opacity-50 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${liveStatus.includes('Error') || liveStatus.includes('Required') ? 'bg-red-500' : 'bg-green-500 live-indicator'}`}></div>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{liveStatus}</span>
        </div>
        <span className="text-[9px] text-gray-600 font-medium italic">Synced {lastUpdated || 'Never'}</span>
      </div>
    </div>
  );
};

export default { Scoreboard, Payouts, LiveStrip, WinningNowHero, PayoutsAccordion };
