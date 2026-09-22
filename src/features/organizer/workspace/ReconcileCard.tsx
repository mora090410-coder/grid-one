import React from 'react';
import { DigitFlow, Eyebrow, Glass } from '../../../design/primitives';
import type { OrganizerLifecycleModel } from '../lifecycle/organizerLifecycle';

export interface ReconcileCardProps {
  model: OrganizerLifecycleModel;
  unpaidCount: number;
  unknownCount?: number;
  highlightOpen: boolean;
  onToggleHighlightOpen: () => void;
}

// Copied from ReconcileChecklist.tsx (do not import from the old shell; it is deleted later).
const advisoryText: Record<string, string> = {
  open_squares_remaining: 'OPEN squares remain. You can publish if you are okay leaving them OPEN.',
  unpaid_or_unknown_payment_status: 'Some private payment notes still need follow-up.',
};
const blockerText: Record<string, string> = {
  missing_owner: 'The board owner could not be verified. Reload and try again.',
  missing_board_identity: 'Add a board title before publishing.',
  missing_scheduled_game: 'Choose the scheduled game before publishing.',
  invalid_board_shape: 'This board could not be checked. Reload and try again.',
  duplicate_or_ambiguous_public_identity: 'Make each public name unique so families can find the right squares.',
  open_square_acknowledgement_required: 'Confirm that the remaining OPEN squares should stay OPEN.',
  invalid_committed_axes: 'Draw one complete set of numbers before publishing.',
  dynamic_axes_not_supported: 'This older board uses changing number sets and cannot be published in this version.',
  save_dirty: 'Save the latest changes before publishing.',
  save_saving: 'Wait for the board to finish saving.',
  save_save_failed: 'The latest changes did not save. Reload or try again.',
  save_conflicted: 'This board changed in another session. Reload the latest version.',
  save_recovered: 'Review and save the recovered draft before publishing.',
};

export default function ReconcileCard({ model, unpaidCount, unknownCount = 0, highlightOpen, onToggleHighlightOpen }: ReconcileCardProps) {
  return (
    <Glass padding="lg" className="flex flex-col gap-4">
      <Eyebrow>Reconcile</Eyebrow>
      <button
        type="button"
        aria-pressed={highlightOpen}
        onClick={onToggleHighlightOpen}
        className="min-h-11 w-full rounded-control px-2 text-left font-ui text-[15px] text-fg hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
      >
        <DigitFlow value={model.assignedCount} /> filled · <DigitFlow value={model.openCount} /> open · {unpaidCount} unpaid · {unknownCount} not asked yet
      </button>
      <div role="region" aria-label="Before you can publish" className="border border-hairline rounded-control p-4">
        <h3 className="font-semibold">Before you can publish</h3>
        {model.hardBlockers.length ? (
          <ul>
            {model.hardBlockers.map((blocker) => (
              <li key={blocker}>{blockerText[blocker] || 'Review this board before publishing.'}</li>
            ))}
          </ul>
        ) : (
          <p>{model.canPublish
            ? 'Ready for preview.'
            : model.assignedCount === 0
              ? 'Allocate squares to a person or family, then draw game numbers when ready.'
              : model.canEnterDraw
                ? 'When sales are finished, draw game numbers, then review and finalize the board.'
                : 'Continue setting up the board before finalizing.'}</p>
        )}
      </div>
      <div role="region" aria-label="Private follow-up" className="border border-hairline rounded-control p-4">
        <h3 className="font-semibold">Private follow-up</h3>
        {model.advisories.filter((advisory) => advisory !== 'seller_attribution_gaps').length ? (
          <ul>
            {model.advisories.filter((advisory) => advisory !== 'seller_attribution_gaps').map((advisory) => (
              <li key={advisory}>{advisoryText[advisory] || 'Review this private note.'}</li>
            ))}
          </ul>
        ) : (
          <p>No private follow-up.</p>
        )}
      </div>
    </Glass>
  );
}
