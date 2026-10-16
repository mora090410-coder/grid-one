import React from 'react';
import { Eyebrow, CapsuleButton, Glass } from '../../../../design/primitives';
import type { WinnerResolution } from '../../../../../types';
import type { MilestoneCorrectionDraft } from '../../services/corrections/milestoneCorrectionService';
import { milestoneLabel } from '../../../viewer/milestones/milestoneViewModel';

export interface CorrectionsCardProps {
  winnerHistory: WinnerResolution[];
  draft: MilestoneCorrectionDraft | null;
  pending?: boolean;
  onDraftChange: (draft: MilestoneCorrectionDraft | null) => void;
  onPublishCorrection: (notify: boolean) => void;
}

export default function CorrectionsCard({
  winnerHistory,
  draft,
  pending = false,
  onDraftChange,
  onPublishCorrection,
}: CorrectionsCardProps) {
  const selected = draft?.milestone ? winnerHistory.find((w) => w.milestone === draft.milestone) : null;
  const canPublish = Boolean(draft && draft.reason.trim() && !pending);

  return (
    <Glass padding="lg" className="flex flex-col gap-4">
      <Eyebrow>Correct a published result</Eyebrow>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 font-ui text-[14px] text-fg-2">
          <span>Result to correct</span>
          <select
            className="rounded-control bg-panel border border-hairline h-11 px-4 font-ui text-[16px] text-fg"
            value={draft?.milestone || ''}
            disabled={pending || !winnerHistory.length}
            onChange={(event) => {
              const milestone = event.target.value as WinnerResolution['milestone'];
              const current = winnerHistory.find((w) => w.milestone === milestone);
              onDraftChange(current ? { milestone, expectedVersion: current.resolutionVersion ?? 1, sideScore: current.sideScore ?? 0, topScore: current.topScore ?? 0, reason: '' } : null);
            }}
          >
            <option value="">Select a result</option>
            {winnerHistory.map((w) => <option key={w.milestone} value={w.milestone}>{w.milestone}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-ui text-[14px] text-fg-2">
          <span>Side score</span>
          <input
            type="number"
            min={0}
            className="rounded-control bg-panel border border-hairline h-11 px-4 font-ui text-[16px] text-center"
            value={draft?.sideScore ?? 0}
            disabled={!draft || pending}
            onChange={(event) => draft && onDraftChange({ ...draft, sideScore: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
        <label className="flex flex-col gap-1 font-ui text-[14px] text-fg-2">
          <span>Top score</span>
          <input
            type="number"
            min={0}
            className="rounded-control bg-panel border border-hairline h-11 px-4 font-ui text-[16px] text-center"
            value={draft?.topScore ?? 0}
            disabled={!draft || pending}
            onChange={(event) => draft && onDraftChange({ ...draft, topScore: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
        <label className="flex flex-col gap-1 font-ui text-[14px] text-fg-2">
          <span>Why this changed (shown publicly)</span>
          <textarea
            className="rounded-control bg-panel border border-hairline px-4 py-3 font-ui text-[16px]"
            value={draft?.reason || ''}
            disabled={!draft || pending}
            onChange={(event) => draft && onDraftChange({ ...draft, reason: event.target.value })}
          />
        </label>
        {selected && (
          <p className="font-ui text-[14px] text-fg-2">
            Current winner: {selected.participantName || 'OPEN'}. Emailing notifies verified subscribers of {selected.participantName || 'the previous winner'} and of the corrected winner. Correct without notifying publishes the public reason and sends no email.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <CapsuleButton type="button" className="self-start" disabled={!canPublish} aria-busy={pending} onClick={() => onPublishCorrection(true)}>
            {pending ? 'Publishing correction…' : 'Publish correction and email both people'}
          </CapsuleButton>
          <CapsuleButton type="button" variant="quiet" className="self-start" disabled={!canPublish} aria-busy={pending} onClick={() => onPublishCorrection(false)}>
            Correct without notifying
          </CapsuleButton>
        </div>
      </div>
      {winnerHistory.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-hairline pt-4" aria-label="Result history">
          {winnerHistory.map((w) => (
            <p key={`${w.milestone}-${w.resolvedAt}`} className="font-ui text-[13px] text-fg-2">
              {milestoneLabel(w.milestone)}: {w.participantName || 'OPEN'}
              {w.corrected ? ` — corrected: ${w.correctionReason || 'reason recorded'}` : ''}
            </p>
          ))}
        </div>
      )}
    </Glass>
  );
}
