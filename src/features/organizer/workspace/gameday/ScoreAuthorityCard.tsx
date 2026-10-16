import React from 'react';
import { Eyebrow, Glass, Numeral } from '../../../../design/primitives';
import type { GameState, LiveGameData } from '../../../../../types';
import { ManualScoringPanel } from '../../game-day/ManualScoringPanel';
import { formatViewerFreshness, viewerAuthorityLabel } from '../../../viewer/score/viewerScoreModel';
import type { ManualGameState, ManualQuarterKey, ManualScoreSide } from '../../game-day/manualScoringModel';

export interface ScoreAuthorityCardProps {
  game: GameState;
  liveData: LiveGameData | null;
  scoreSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  isActivated: boolean;
  onEnableAutomaticScoring: () => void;
  onEnableManualScoring: () => void;
  onUpdateManualGameState: (state: ManualGameState) => void;
  onUpdateManualPeriod: (period: number) => void;
  onUpdateManualQuarter: (quarter: ManualQuarterKey, side: ManualScoreSide, value: number | null) => void;
  onSaveManualScore: () => void;
}

export default function ScoreAuthorityCard({
  game,
  liveData,
  scoreSaveStatus,
  isActivated,
  onEnableAutomaticScoring,
  onEnableManualScoring,
  onUpdateManualGameState,
  onUpdateManualPeriod,
  onUpdateManualQuarter,
  onSaveManualScore,
}: ScoreAuthorityCardProps) {
  const isManual = game.useManualScores || liveData?.isManual;
  // A score is never shown without where it came from and when it was
  // retrieved, so both are read off the same snapshot the viewer reads.
  const authority = viewerAuthorityLabel(liveData, '', false);
  const retrieved = formatViewerFreshness(liveData) || 'Checked time unavailable';
  return (
    <Glass padding="lg" className="flex flex-col gap-4">
      <Eyebrow>Score authority</Eyebrow>
      <p className="font-ui text-[15px] text-fg-2">
        {isManual ? 'Manual scoring authority' : 'Automatic scoring authority'}
      </p>
      {liveData ? (
        <div className="flex flex-col gap-1">
          <Numeral
            value={`${liveData.leftScore} – ${liveData.topScore}`}
            secondary={`${game.leftAbbr} at ${game.topAbbr}`}
            size="md"
            label={`${game.leftAbbr} ${liveData.leftScore}, ${game.topAbbr} ${liveData.topScore}`}
          />
          <p className="font-mono text-[13px] text-fg-3">{authority.detail} · {retrieved}</p>
        </div>
      ) : (
        <p className="font-mono text-[13px] text-fg-3">Score unavailable · {retrieved}</p>
      )}
      <ManualScoringPanel
        isActivated={isActivated}
        game={game}
        scoreSaveStatus={scoreSaveStatus}
        onEnableAutomaticScoring={onEnableAutomaticScoring}
        onEnableManualScoring={onEnableManualScoring}
        onUpdateManualGameState={onUpdateManualGameState}
        onUpdateManualPeriod={onUpdateManualPeriod}
        onUpdateManualQuarter={onUpdateManualQuarter}
        onSaveManualScore={onSaveManualScore}
      />
    </Glass>
  );
}
