import React from 'react';
import { Glass, CapsuleButton, CapsuleTag } from '../../../design/primitives';

export interface DrawControlProps {
  openCount: number;
  /** The organizer has asked to draw (or to replace an existing draft draw). */
  requested?: boolean;
  acknowledged: boolean;
  drawn: boolean;
  preview: boolean;
  disabled: boolean;
  onAcknowledge: () => void;
  /** Accepts the open squares without staging a fresh draw. */
  onAcknowledgeWithoutDraw: () => void;
  onKeepAssigning: () => void;
  onDraw: () => void;
  onCommit: () => void;
  onAgain: () => void;
  onReplace: () => void;
  onCancelPreview: () => void;
}

/**
 * Glass panel rendered by the workspace only when relevant: the open-square
 * acknowledgement, the preview-numbers review, or the drawn-draft summary.
 *
 * The acknowledgement is checked first and independently of the drawn/preview
 * state: a replacement draw on a board with open squares has to be able to ask
 * the question again, or the organizer dead-ends with no way to answer it.
 */
export default function DrawControl({
  openCount,
  requested = true,
  acknowledged,
  drawn,
  preview,
  disabled,
  onAcknowledge,
  onAcknowledgeWithoutDraw,
  onKeepAssigning,
  onCommit,
  onAgain,
  onReplace,
  onCancelPreview,
}: DrawControlProps) {
  if (requested && openCount > 0 && !acknowledged) {
    const heading = `${openCount} squares are open. Draw anyway?`;
    return (
      <Glass role="group" aria-label={heading} className="flex flex-col gap-3">
        <h2 className="font-display text-[20px] leading-[1.1] text-fg">{heading}</h2>
        <p className="font-ui text-[14px] text-fg-2">
          Open squares stay open. You can still fill them before kickoff.
        </p>
        <div className="flex flex-wrap gap-2">
          <CapsuleButton variant="quiet" onClick={onKeepAssigning} disabled={disabled}>Keep assigning</CapsuleButton>
          <CapsuleButton variant="primary" onClick={onAcknowledge} disabled={disabled}>{`Draw with ${openCount} OPEN`}</CapsuleButton>
        </div>
      </Glass>
    );
  }

  if (preview) {
    return (
      <Glass className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <CapsuleButton variant="primary" onClick={onCommit} disabled={disabled}>Use numbers and continue</CapsuleButton>
          <CapsuleButton variant="quiet" onClick={onAgain} disabled={disabled}>Draw again</CapsuleButton>
          <CapsuleButton variant="ghost" onClick={onCancelPreview} disabled={disabled}>Cancel</CapsuleButton>
        </div>
      </Glass>
    );
  }

  if (drawn) {
    // A square blanked after the numbers were committed reopens the open-square
    // question. Without this prompt the only route to the answer is Replace
    // draft draw, which also stages digits the organizer never asked for, so
    // the question is asked here alongside the draw summary instead.
    const heading = `${openCount} squares are open. Publish with them open?`;
    return (
      <>
        {openCount > 0 && !acknowledged && (
          <Glass role="group" aria-label={heading} className="flex flex-col gap-3">
            <h2 className="font-display text-[20px] leading-[1.1] text-fg">{heading}</h2>
            <p className="font-ui text-[14px] text-fg-2">
              Open squares stay open. You can still fill them before kickoff.
            </p>
            <div className="flex flex-wrap gap-2">
              <CapsuleButton variant="quiet" onClick={onKeepAssigning} disabled={disabled}>Keep assigning</CapsuleButton>
              <CapsuleButton variant="primary" onClick={onAcknowledgeWithoutDraw} disabled={disabled}>{`Keep ${openCount} OPEN`}</CapsuleButton>
            </div>
          </Glass>
        )}
        <div className="flex flex-wrap items-center gap-3 px-1">
          <span className="font-mono text-[14px] text-fg">Numbers set</span>
          <CapsuleTag tone="turf">Drawn</CapsuleTag>
          <CapsuleButton variant="ghost" onClick={onReplace} disabled={disabled}>Replace draft draw</CapsuleButton>
        </div>
      </>
    );
  }

  return null;
}
