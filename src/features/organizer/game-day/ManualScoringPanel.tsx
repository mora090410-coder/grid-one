import type { GameState } from '../../../../types';
import { CapsuleButton, Glass } from '../../../design/primitives';
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
      <Glass padding="lg">
        <p className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] mb-2 text-tone-cardinal">Ready when the board goes live</p>
        <h5 className="font-display text-2xl text-fg">Every published board gets the full game-day experience.</h5>
        <p className="font-ui mt-3 text-sm text-fg-2">
          Building is free. Once you lock the numbers, live scores, winner emails, and the QR code turn on.
        </p>
      </Glass>
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
        <h5 className="font-ui text-xs font-bold text-fg-3 uppercase tracking-widest">Live Scoring</h5>
        <div className="flex gap-2">
          <CapsuleButton
            type="button"
            variant={!game.useManualScores ? 'primary' : 'quiet'}
            onClick={onEnableAutomaticScoring}
          >
            Auto
          </CapsuleButton>
          <CapsuleButton
            type="button"
            variant={game.useManualScores ? 'primary' : 'quiet'}
            onClick={onEnableManualScoring}
            disabled={scoreSaveStatus === 'saving'}
          >
            Manual
          </CapsuleButton>
        </div>
      </div>

      {!game.useManualScores ? (
        <p className="font-ui text-xs text-fg-3 leading-relaxed">
          Automatic score checks show their source and freshness. Switch to Manual any time you want your entered score to be the official board score.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="manual-game-status" className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-2">Game Status</label>
              <div className="relative">
                <select
                  id="manual-game-status"
                  value={manualState}
                  onChange={(e) => onUpdateManualGameState(e.target.value as ManualGameState)}
                  className="w-full rounded-control bg-panel border border-hairline h-11 px-4 font-ui text-[16px] appearance-none text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
                >
                  <option value="pre">Scheduled</option>
                  <option value="in">In progress</option>
                  <option value="post">Final</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-fg-3">▼</div>
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="manual-current-period" className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-2">Current Period</label>
              <div className="relative">
                <select
                  id="manual-current-period"
                  value={manualPeriod}
                  onChange={(e) => onUpdateManualPeriod(parseInt(e.target.value))}
                  disabled={manualState !== 'in'}
                  className="w-full rounded-control bg-panel border border-hairline h-11 px-4 font-ui text-[16px] appearance-none text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
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
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-fg-3">▼</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center">
              <span></span>
              <span className="font-ui text-[10px] font-bold text-fg-3 uppercase tracking-widest text-center">{game.leftAbbr}</span>
              <span className="font-ui text-[10px] font-bold text-fg-3 uppercase tracking-widest text-center">{game.topAbbr}</span>
            </div>
            {MANUAL_SCORE_PERIODS.map((q) => (
              <div key={q} className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center">
                <span className="font-ui text-xs font-bold text-fg-2">{q}</span>
                <input
                  type="number"
                  min={0}
                  value={game.manualQuarterScores?.[q]?.left ?? 0}
                  onChange={(e) => onUpdateManualQuarter(q, 'left', sanitizeManualScoreInput(parseInt(e.target.value) || 0))}
                  className="w-full rounded-control bg-panel border border-hairline h-11 px-4 font-ui text-[16px] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
                />
                <input
                  type="number"
                  min={0}
                  value={game.manualQuarterScores?.[q]?.top ?? 0}
                  onChange={(e) => onUpdateManualQuarter(q, 'top', sanitizeManualScoreInput(parseInt(e.target.value) || 0))}
                  className="w-full rounded-control bg-panel border border-hairline h-11 px-4 font-ui text-[16px] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
                />
              </div>
            ))}
            <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center pt-1 border-t border-hairline">
              <span className="font-ui text-xs font-bold text-gold">Total</span>
              <span className="font-ui text-sm font-bold text-fg text-center">
                {manualScoreTotal(game.manualQuarterScores, 'left')}
              </span>
              <span className="font-ui text-sm font-bold text-fg text-center">
                {manualScoreTotal(game.manualQuarterScores, 'top')}
              </span>
            </div>
          </div>
          <p className="font-ui text-[11px] text-fg-3 leading-relaxed">
            Enter each quarter's points, not running totals. Publishing a completed period confirms its result and prepares winner emails.
          </p>
          <CapsuleButton
            type="button"
            variant="primary"
            className="w-full"
            onClick={onSaveManualScore}
            disabled={scoreSaveStatus === 'saving'}
          >
            {scoreSaveStatus === 'saving' ? 'Publishing score…' : 'Publish manual score'}
          </CapsuleButton>
        </div>
      )}
    </>
  );
};
