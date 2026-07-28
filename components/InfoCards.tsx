
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
    <div className="flex items-center justify-between px-4 py-3 bg-broadcast-white border-b-[3px] border-ink">
      {/* Matchup */}
      <div className="flex items-center gap-3">
        <span className="oa-slab text-ink">{game.leftAbbr}</span>
        <span className="oa-data text-xs text-ink/40">vs</span>
        <span className="oa-slab text-ink">{game.topAbbr}</span>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {isLive && (
          <span className="oa-slab flex items-center gap-1.5 text-live">
            <span className="w-1.5 h-1.5 bg-live animate-pulse"></span>
            {live?.detail || live?.clock || 'Live'}
          </span>
        )}
        {isFinal && <span className="oa-slab text-ink/60">Final</span>}
        {!isLive && !isFinal && live?.state === 'pre' && (
          <span className="oa-data text-xs text-ink/50">Waiting for kickoff{game.dates ? ` - ${formatGameDate(game.dates)}` : ''}</span>
        )}
      </div>

      {/* Right side: digits + toggle */}
      <div className="flex items-center gap-4">
        {/* Current digits */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-newsprint">
            <span className="oa-slab text-ink/50">{game.leftAbbr}</span>
            <span className="oa-data text-base font-bold text-ink">{leftDigit}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-newsprint">
            <span className="oa-slab text-ink/50">{game.topAbbr}</span>
            <span className="oa-data text-base font-bold text-ink">{topDigit}</span>
          </div>
          {isSynced && <span className="w-2 h-2 bg-live" title="Live sync"></span>}
        </div>

        {/* Live|Board Toggle - Desktop only, integrated into strip */}
        {onTabChange && (
          <div className="hidden md:flex gap-px bg-ink p-px">
            <button
              onClick={() => onTabChange('live')}
              className={`oa-slab px-3 py-1 transition-colors ${activeTab === 'live' ? 'bg-cardinal text-broadcast-white' : 'bg-broadcast-white text-ink/60 hover:bg-newsprint'}`}
            >
              Live
            </button>
            <button
              onClick={() => onTabChange('board')}
              className={`oa-slab px-3 py-1 transition-colors ${activeTab === 'board' ? 'bg-cardinal text-broadcast-white' : 'bg-broadcast-white text-ink/60 hover:bg-newsprint'}`}
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
      <div className="p-8 bg-broadcast-white ring-[3px] ring-ink text-center">
        <p className="oa-headline !text-lg text-ink/50">Waiting for game to start</p>
        <p className="oa-data text-sm text-ink/40 mt-1">{game.dates || 'Date not set'}</p>
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
    <div className="p-6 md:p-8 bg-cardinal relative overflow-hidden">
      <div className="mb-4 h-[3px] w-full bg-gold" aria-hidden />
      <div className="relative z-10">
        {/* Label */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {isLive && <span className="w-2 h-2 bg-live animate-pulse"></span>}
          <span className="oa-slab text-broadcast-white/80">
            {getMilestoneLabel(currentMilestone, isLive)}
          </span>
        </div>
        {live.state === 'pre' && (
          <p className="oa-data text-xs text-broadcast-white/70 text-center mb-4">
            Game has not started yet. Waiting for kickoff{game.dates ? ` on ${formatGameDate(game.dates)}` : ''}.
          </p>
        )}

        {/* Winner name - hero size */}
        <h2 className="oa-headline !text-3xl md:!text-4xl text-broadcast-white text-center mb-4">
          {winners.length > 0 ? winners[0] : 'No owner'}
          {winners.length > 1 && <span className="oa-data text-broadcast-white/60 text-xl ml-2">+{winners.length - 1}</span>}
        </h2>

        {/* Digits display */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-cardinal-deep">
            <img src={getLogoUrl(game.leftAbbr)} alt="" className="w-6 h-6 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
            <span className="oa-data text-2xl font-bold text-broadcast-white">{leftDigit}</span>
          </div>
          <span className="oa-data text-broadcast-white/40 text-lg">/</span>
          <div className="flex items-center gap-2 px-4 py-2 bg-cardinal-deep">
            <img src={getLogoUrl(game.topAbbr)} alt="" className="w-6 h-6 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
            <span className="oa-data text-2xl font-bold text-broadcast-white">{topDigit}</span>
          </div>
        </div>

        {/* Coordinate key */}
        <div className="text-center mt-3">
          <span className="oa-data text-xs text-broadcast-white/70 px-2 py-1 bg-cardinal-deep">{currentKey}</span>
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
      <div className="bg-broadcast-white ring-[3px] ring-ink overflow-hidden">
        <div className="grid grid-cols-4 gap-px bg-ink">
          {milestones.map(({ key, qKey }) => (
            <div key={key} className="p-3 md:p-4 text-center bg-broadcast-white opacity-50">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="oa-slab text-ink/50">{key === 'Half' ? 'Half' : key}</span>
              </div>
              <p className="oa-data text-[11px] text-ink/40 mb-0.5">—</p>
              <p className="oa-data text-[11px] font-bold text-cardinal">{getPayout(qKey)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-broadcast-white ring-[3px] ring-ink overflow-hidden">
      <div className="grid grid-cols-4 gap-px bg-ink">
        {milestones.map(({ key, qKey }) => {
          const data = getMilestoneData(key, qKey);
          return (
            <div key={key} className={`p-3 md:p-4 text-center bg-broadcast-white ${data.state === 'pending' ? 'opacity-40' : ''} ${data.state === 'locked' ? 'bg-gold' : ''}`}>
              {/* Label with state indicator */}
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {data.state === 'live' && (
                  <span className="w-1.5 h-1.5 bg-live animate-pulse"></span>
                )}
                {data.state === 'locked' && (
                  <svg className="w-3 h-3 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span className={`oa-slab ${data.state === 'locked' ? 'text-ink' : 'text-ink/50'}`}>{data.label}</span>
              </div>

              {/* Winner name */}
              <p className={`oa-slab truncate mb-0.5 ${data.state === 'locked' ? 'text-ink' : 'text-ink/90'}`}>{data.winner}</p>

              {/* Payout amount - always visible */}
              <p className={`oa-data text-[11px] font-bold ${data.state === 'locked' ? 'text-ink' : 'text-cardinal'}`}>{getPayout(qKey)}</p>
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
      <div key={qKey} className={`flex items-center justify-between py-3 ${!isFinal ? 'border-b border-newsprint' : ''}`}>
        <div className="flex-1">
          <div className="oa-slab text-ink/80">{label}</div>
          {status !== 'blank' && status !== 'awaiting' && winners.length > 0 && (
            <div className="oa-data text-xs text-ink/50 mt-0.5">{winners.join(', ')}</div>
          )}
        </div>
        <div className={`oa-data font-bold ${isFinal ? 'text-cardinal' : 'text-ink/70'}`}>${amount}</div>
      </div>
    );
  };

  return (
    <div className="bg-broadcast-white ring-[3px] ring-ink overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-broadcast-white hover:bg-newsprint transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="oa-slab text-ink/80">Payouts</span>
          <span className="oa-data text-xs text-ink/50">${total} total</span>
        </div>
        <svg className={`w-4 h-4 text-ink/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-5 pb-4 border-t border-ink">
          {renderRow('1st quarter', p.Q1, 'Q1')}
          {renderRow('2nd quarter', p.Q2, 'Q2')}
          {renderRow('3rd quarter', p.Q3, 'Q3')}
          {renderRow('Final score', p.Final, 'Final', true)}

          <div className="flex items-center justify-between pt-3 mt-2 border-t border-newsprint oa-data text-xs text-ink/50">
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
    <div className="bg-broadcast-white ring-[3px] ring-ink p-6 md:p-8 flex flex-col justify-between relative overflow-hidden">
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="flex-1">
          <h4 className="oa-headline !text-xl md:!text-2xl flex items-center gap-3 text-ink">
            {game.title || `${game.leftAbbr} vs ${game.topAbbr}`}
            {live?.isManual && (
              <span className="oa-slab bg-cardinal text-broadcast-white px-2 py-0.5">MANUAL</span>
            )}
          </h4>
          <p className="oa-slab text-ink/50 mt-1">{game.meta}</p>
        </div>
        <div className="flex items-center gap-3">
          {live && (
            <div className={`oa-slab px-3 py-1.5 ${live.state === 'in' ? 'bg-live text-ink animate-pulse' : 'bg-newsprint text-ink/60'}`}>
              {live.state === 'post' ? 'Final' : (live.isOvertime ? `OT ${live.clock}` : (live.detail || live.clock))}
            </div>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-2 bg-broadcast-white ring-1 ring-inset ring-ink text-ink hover:bg-newsprint transition-colors ${isRefreshing ? 'animate-spin opacity-50' : ''}`}
            title="Refresh Live Scores"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {!game.dates && !live?.isManual && (
        <div className="mb-6 p-4 bg-newsprint text-center relative z-10">
          <p className="oa-slab text-ink">
            Game Date Not Set
          </p>
          <p className="oa-data text-[11px] text-ink/60 mt-1">
            Organizer must set a date to enable live scores.
          </p>
        </div>
      )}

      <div className="mb-3 oa-slab text-center text-ink/50 relative z-10">
        Squares Scoreboard (Last Digit)
      </div>

      <table className="w-full text-center border-separate border-spacing-x-0 relative z-10">
        <thead>
          <tr className="oa-slab text-ink/50">
            <th className="text-left py-3 pl-4">Team</th>
            <th className="w-14">Q1</th>
            <th className="w-14">Q2</th>
            <th className="w-14">Q3</th>
            <th className="w-20 text-ink">{finalHeader}</th>
          </tr>
        </thead>
        <tbody>
          {/* Left Team Row */}
          <tr className="group/row transition-colors hover:bg-newsprint">
            <td className="oa-headline !text-xl py-4 pl-4 text-left flex items-center gap-4 text-ink">
              <img src={getLogoUrl(game.leftAbbr)} alt={game.leftAbbr} className="w-10 h-10 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              {game.leftAbbr}
            </td>
            <td className="oa-data font-bold text-xl text-ink/90 border-b border-newsprint">{getSquaresDigit('left', 'Q1')}</td>
            <td className="oa-data font-bold text-xl text-ink/90 border-b border-newsprint">{getSquaresDigit('left', 'Q2')}</td>
            <td className="oa-data font-bold text-xl text-ink/90 border-b border-newsprint">{getSquaresDigit('left', 'Q3')}</td>
            <td className={`oa-data font-bold text-2xl ${isFinal ? 'bg-gold text-ink' : 'text-ink'}`}>
              {live?.isManual ? (live.leftScore % 10) : getSquaresDigit('left', 'Final')}
            </td>
          </tr>

          {/* Top Team Row */}
          <tr className="group/row transition-colors hover:bg-newsprint">
            <td className="oa-headline !text-xl py-4 pl-4 text-left flex items-center gap-4 text-ink">
              <img src={getLogoUrl(game.topAbbr)} alt={game.topAbbr} className="w-10 h-10 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              {game.topAbbr}
            </td>
            <td className="oa-data font-bold text-xl text-ink/90 border-t border-newsprint">{getSquaresDigit('top', 'Q1')}</td>
            <td className="oa-data font-bold text-xl text-ink/90 border-t border-newsprint">{getSquaresDigit('top', 'Q2')}</td>
            <td className="oa-data font-bold text-xl text-ink/90 border-t border-newsprint">{getSquaresDigit('top', 'Q3')}</td>
            <td className={`oa-data font-bold text-2xl ${isFinal ? 'bg-gold text-ink' : 'text-ink'}`}>
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
      <div className={`group flex flex-col gap-1 ${isFinal ? 'mt-4 pt-4 border-t border-ink' : 'pb-4 border-b border-newsprint last:border-0'}`}>
        <div className="flex justify-between items-center">
          <span className="oa-slab text-ink/60 group-hover:text-ink transition-colors">{label}</span>
          <span className={`oa-data font-bold ${isFinal ? 'text-cardinal text-lg' : 'text-ink'}`}>{amount}</span>
        </div>

        {/* Status Area */}
        {status === 'awaiting' ? (
          <div className="flex items-center gap-2 mt-1 opacity-50">
            <div className="w-1 h-1 bg-ink/50"></div>
            <span className="oa-slab text-ink/50">Awaiting Kickoff</span>
          </div>
        ) : winnerData ? (
          <div className={`flex flex-col mt-2 p-3 ${isActive ? 'bg-cardinal' : 'bg-newsprint'}`}>

            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                {isActive && <span className="w-2 h-2 bg-live animate-pulse"></span>}
                <span className={`oa-slab ${isActive ? 'text-broadcast-white' : 'text-ink/70'}`}>
                  {winnerData.statusText}
                </span>
              </div>
              <span className={`oa-data text-[10px] px-2 py-0.5 ${isActive ? 'bg-cardinal-deep text-broadcast-white' : 'bg-broadcast-white text-ink/60'}`}>{winnerData.key}</span>
            </div>

            <div className={`oa-slab truncate ${isActive ? 'text-broadcast-white' : 'text-ink'}`}>
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
    <div className="bg-broadcast-white ring-[3px] ring-ink p-6 md:p-8 h-auto flex flex-col">
      <div className="oa-slab text-ink/50 mb-6 px-1">Prize Structure</div>
      <div className="flex flex-col justify-start gap-1">
        {renderWinnerLine('1st Quarter', `$${p.Q1}`, getRowStatus(false, 1, currentStatus, currentPeriod), 'Q1')}
        {renderWinnerLine('2nd Quarter', `$${p.Q2}`, getRowStatus(false, 2, currentStatus, currentPeriod), 'Q2')}
        {renderWinnerLine('3rd Quarter', `$${p.Q3}`, getRowStatus(false, 3, currentStatus, currentPeriod), 'Q3')}
        {renderWinnerLine('Final Score', `$${p.Final}`, getRowStatus(true, 4, currentStatus, currentPeriod), 'Final', true)}
      </div>

      <div className="mt-6 pt-4 border-t border-newsprint flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 ${liveStatus.includes('Error') || liveStatus.includes('Required') ? 'bg-cardinal' : 'bg-live'}`}></div>
          <span className="oa-slab text-ink/60">{liveStatus}</span>
        </div>
        <span className="oa-data text-[10px] text-ink/50">Synced {lastUpdated || 'Never'}</span>
      </div>
    </div>
  );
};

export default { Scoreboard, Payouts, LiveStrip, WinningNowHero, PayoutsAccordion };
