import React from 'react';
import { Eyebrow, Glass, Numeral } from '../../../../design/primitives';
import type { WinnerResolution } from '../../../../../types';
import { buildResolvedMilestoneRows } from '../../../viewer/milestones/milestoneViewModel';

export interface FinalRecordCardProps {
  winnerHistory: WinnerResolution[];
  onCreateAnotherBoard?: () => void;
}

/** The locked record shown once the game reaches its final state: milestones, winners, and a path to the next board. */
export default function FinalRecordCard({ winnerHistory, onCreateAnotherBoard }: FinalRecordCardProps) {
  const rows = buildResolvedMilestoneRows(winnerHistory);
  return (
    <Glass padding="lg" className="flex flex-col gap-4">
      <Eyebrow>Final record</Eyebrow>
      <h2 className="font-display text-2xl text-fg">This board is locked as the Final record.</h2>
      <p className="font-ui text-[15px] text-fg-2">
        This board is done. Scores, winners, and any fixes stay here for everyone to see. Start a new board for your next game.
      </p>
      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 font-ui text-[14px] text-fg-2">
              <span>{row.label} · {row.openSquare ? 'Open square' : row.name}</span>
              <Numeral value={row.digits} size="sm" />
            </li>
          ))}
        </ul>
      )}
      <a
        href="/create"
        onClick={onCreateAnotherBoard ? (event) => { event.preventDefault(); onCreateAnotherBoard(); } : undefined}
        className="inline-flex items-center justify-center gap-2 self-start rounded-capsule bg-action px-5 h-11 font-ui text-[15px] font-semibold leading-none text-action-text transition-[color,background-color,border-color,scale] hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground motion-safe:active:scale-[0.98]"
      >
        Create another board
      </a>
    </Glass>
  );
}
