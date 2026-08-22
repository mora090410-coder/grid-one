import type { GameState } from '../../../types';
import {
  MANUAL_SCORE_PERIODS,
  manualPeriodForState,
  manualScoreTotal,
  sanitizeManualScoreInput,
  type ManualGameState,
  type ManualQuarterKey,
  type ManualScoreSide,
} from './manualScoringModel';

interface ManualScoringPanelProps {
  isActivated: boolean;
  game: GameState;
  scoreSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onEnableAutomaticScoring: () => void;
  onEnableManualScoring: () => void;
  onUpdateManualGameState: (state: ManualGameState) => void;
  onUpdateManualPeriod: (period: number) => void;
  onUpdateManualQuarter: (quarter: ManualQuarterKey, side: ManualScoreSide, value: number) => void;
  onSaveManualScore: () => void;
}

export const ManualScoringPanel = ({
  isActivated,
  game,
  scoreSaveStatus,
  onEnableAutomaticScoring,
  onEnableManualScoring,
  onUpdateManualGameState,
  onUpdateManualPeriod,
  onUpdateManualQuarter,
  onSaveManualScore,
}: ManualScoringPanelProps) => {
  if (!isActivated) {
    return (
      <div className="border border-gold bg-gold/20 p-5 text-ink">
        <p className="oa-slab mb-2 text-cardinal">Ready when the board goes live</p>
        <h5 className="oa-headline !text-2xl">Every published board gets the full game-day experience.</h5>
        <p className="oa-body mt-3 text-sm text-ink/70">
          Keep building and previewing for free. After you publish, scores, scenarios, winner emails, the QR code, and the viewer link all work together.
        </p>
      </div>
    );
  }

  const manualState = game.manualGameState ?? 'in';
  const manualPeriod = manualPeriodForState(
    manualState,
    game.manualPeriod,
    game.manualQuarterScores,
  );

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h5 className="text-xs font-bold text-ink/50 uppercase tracking-widest">Live Scoring</h5>
        <div className="flex rounded-control bg-newsprint p-1 border border-newsprint">
          <button
            onClick={onEnableAutomaticScoring}
            className={`min-h-11 px-3 py-2 rounded-control text-[11px] font-bold transition-all ${!game.useManualScores ? 'bg-broadcast-white text-ink' : 'text-ink/50 hover:text-ink'}`}
          >
            Auto
          </button>
          <button
            onClick={onEnableManualScoring}
            disabled={scoreSaveStatus === 'saving'}
            className={`min-h-11 px-3 py-2 rounded-control text-[11px] font-bold transition-all ${game.useManualScores ? 'bg-broadcast-white text-ink' : 'text-ink/50 hover:text-ink'}`}
          >
            Manual
          </button>
        </div>
      </div>

      {!game.useManualScores ? (
        <p className="text-xs text-ink/50 leading-relaxed">
          Automatic score checks are a beta convenience and always show their source and freshness. Switch to Manual whenever you want the organizer to be authoritative.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="manual-game-status" className="oa-slab text-ink/60">Game Status</label>
              <div className="relative">
                <select
                  id="manual-game-status"
                  value={manualState}
                  onChange={(e) => onUpdateManualGameState(e.target.value as ManualGameState)}
                  className="w-full oa-input appearance-none text-ink"
                >
                  <option value="pre">Scheduled</option>
                  <option value="in">In progress</option>
                  <option value="post">Final</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink/50">▼</div>
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="manual-current-period" className="oa-slab text-ink/60">Current Period</label>
              <div className="relative">
                <select
                  id="manual-current-period"
                  value={manualPeriod}
                  onChange={(e) => onUpdateManualPeriod(parseInt(e.target.value))}
                  disabled={manualState !== 'in'}
                  className="w-full oa-input appearance-none text-ink"
                >
                  {manualState === 'pre' && (
                    <option value={0}>Not started</option>
                  )}
                  <option value={1}>Q1</option>
                  <option value={2}>Q2</option>
                  <option value={3}>Q3</option>
                  <option value={4}>Q4</option>
                  <option value={5}>Overtime</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink/50">▼</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center">
              <span></span>
              <span className="text-[10px] font-bold text-ink/50 uppercase tracking-widest text-center">{game.leftAbbr}</span>
              <span className="text-[10px] font-bold text-ink/50 uppercase tracking-widest text-center">{game.topAbbr}</span>
            </div>
            {MANUAL_SCORE_PERIODS.map((q) => (
              <div key={q} className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center">
                <span className="text-xs font-bold text-ink/60">{q}</span>
                <input
                  type="number"
                  min={0}
                  value={game.manualQuarterScores?.[q]?.left ?? 0}
                  onChange={(e) => onUpdateManualQuarter(q, 'left', sanitizeManualScoreInput(parseInt(e.target.value) || 0))}
                  className="w-full oa-input text-center"
                />
                <input
                  type="number"
                  min={0}
                  value={game.manualQuarterScores?.[q]?.top ?? 0}
                  onChange={(e) => onUpdateManualQuarter(q, 'top', sanitizeManualScoreInput(parseInt(e.target.value) || 0))}
                  className="w-full oa-input text-center"
                />
              </div>
            ))}
            <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center pt-1 border-t border-newsprint">
              <span className="text-xs font-bold text-gold">Total</span>
              <span className="text-sm font-bold text-ink text-center">
                {manualScoreTotal(game.manualQuarterScores, 'left')}
              </span>
              <span className="text-sm font-bold text-ink text-center">
                {manualScoreTotal(game.manualQuarterScores, 'top')}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-ink/50 leading-relaxed">
            Enter each quarter's points (not running totals). Publishing a settled period confirms its result and queues verified winner notifications.
          </p>
          <button
            type="button"
            onClick={onSaveManualScore}
            disabled={scoreSaveStatus === 'saving'}
            className="oa-btn oa-btn-primary w-full"
          >
            {scoreSaveStatus === 'saving' ? 'Publishing score…' : 'Publish manual score'}
          </button>
        </div>
      )}
    </>
  );
};
