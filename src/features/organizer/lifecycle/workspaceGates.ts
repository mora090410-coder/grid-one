import type { BoardData, EntryMeta } from '../../../../types';
import type { LifecycleHardBlocker, OrganizerLifecycleModel } from './organizerLifecycle';

/**
 * The organizer workspace's gates and next steps, as pure rules over the
 * lifecycle model. The workspace renders what these return.
 */

/** Plain-language reason for each hard blocker, shown in the island and the publish sheet. */
export const BLOCKER_NOTES: Record<LifecycleHardBlocker, string> = {
  missing_owner: 'The board owner could not be verified. Reload and try again.',
  missing_board_identity: 'Add a board name before publishing.',
  missing_scheduled_game: 'Choose the scheduled game before publishing.',
  invalid_board_shape: 'This board could not be checked. Reload and try again.',
  duplicate_or_ambiguous_public_identity: 'Make each public name unique so families can find the right squares.',
  open_square_acknowledgement_required: 'Confirm that the remaining open squares should stay open.',
  invalid_committed_axes: 'Draw one complete set of numbers before publishing.',
  dynamic_axes_not_supported: 'This older board uses changing number sets and cannot be published in this version.',
  save_clean: 'Review this board before publishing.',
  save_dirty: 'Save the latest changes before publishing.',
  save_saving: 'Wait for the board to finish saving.',
  save_save_failed: 'The latest changes did not save. Reload or try again.',
  save_conflicted: 'This board changed in another session. Reload the latest version.',
  save_recovered: 'Review and save the recovered draft before publishing.',
};

export const blockerMessage = (blocker: LifecycleHardBlocker | undefined) =>
  blocker ? BLOCKER_NOTES[blocker] || 'Review this board before publishing.' : undefined;

/**
 * The draw may start with unsaved edits (they save on the way) and without the
 * open-square acknowledgement (DrawControl asks it inline, right before the draw).
 * Anything else, or a save conflict, holds the draw.
 */
const DRAW_TOLERATED = new Set<LifecycleHardBlocker>([
  'open_square_acknowledgement_required',
  'save_dirty',
  'save_saving',
  'invalid_committed_axes',
]);

export const canEnterDraw = (model: Pick<OrganizerLifecycleModel, 'hardBlockers'>, conflicted: boolean) =>
  !conflicted && model.hardBlockers.every((blocker) => DRAW_TOLERATED.has(blocker));

/** Save states resolve on their own (the publish flow flushes first); every other blocker holds publishing. */
export const publishBlocked = (model: Pick<OrganizerLifecycleModel, 'hardBlockers'>) =>
  model.hardBlockers.some((blocker) => !String(blocker).startsWith('save_'));

/**
 * Collapse a display label to the identity a viewer would search by, so one
 * person holding several squares reads as one participant.
 */
export const normalizedIdentity = (label: string) => label
  .trim()
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '');

/**
 * Lifecycle cells carry the real private notes so the checklist can speak to
 * payment and seller gaps, and a durable participant id for every assigned
 * cell. Drafts routinely have no `participants` array yet, so an id is
 * synthesized from the normalized label: same person -> one id, different
 * people -> different ids. Two *different* labels that collapse to the same
 * identity (`Jose` / `José`) cannot be told apart, so their id is dropped and
 * the lifecycle reports them as ambiguous.
 */
export const lifecycleCells = (board: BoardData, entryMeta: Record<number, EntryMeta>) => {
  const labelsById = new Map<string, Set<string>>();
  const cells = board.squares.map((names, index) => {
    const label = names[0]?.trim();
    if (!label) return null;
    const participant = board.participants?.find((item) => item.displayName === label || item.publicLabel === label);
    const participantId = participant?.id ?? `label:${normalizedIdentity(label)}`;
    const byId = labelsById.get(participantId) ?? new Set<string>();
    byId.add(label.toLocaleLowerCase());
    labelsById.set(participantId, byId);
    const meta = entryMeta[index];
    return {
      publicLabel: label,
      participantId,
      paidStatus: meta?.paid_status ?? 'unknown',
      sellerLabel: meta?.seller_label ?? undefined,
    };
  });
  return cells.map((cell) => (
    cell && (labelsById.get(cell.participantId)?.size ?? 0) > 1
      ? { ...cell, participantId: undefined }
      : cell
  ));
};

export type DraftPrimaryAction =
  | { id: 'copy_link'; label: 'Copy link' }
  | { id: 'fill_board'; label: 'Fill the board' }
  | { id: 'preview'; label: 'Review game numbers' | 'Preview and publish' }
  | { id: 'draw'; label: 'Prepare to publish'; disabled: boolean };

/** The one next step the draft workspace offers. */
export const draftPrimaryAction = (input: {
  justPublished: boolean;
  assignedCount: number;
  axesCommitted: boolean;
  isShared: boolean;
  drawAllowed: boolean;
}): DraftPrimaryAction => {
  if (input.justPublished) return { id: 'copy_link', label: 'Copy link' };
  if (input.assignedCount === 0) return { id: 'fill_board', label: 'Fill the board' };
  if (input.axesCommitted) return { id: 'preview', label: input.isShared ? 'Review game numbers' : 'Preview and publish' };
  return { id: 'draw', label: 'Prepare to publish', disabled: !input.drawAllowed };
};

export type GameDayPrimaryAction = { id: 'review_score'; label: 'Review score' } | { id: 'review_delivery'; label: 'Review delivery issue' };

/** On game day the island only asks for attention when the score or email delivery needs it. */
export const gameDayPrimaryAction = (input: { scoreFreshness?: string | null; deliveryIssueCount: number }): GameDayPrimaryAction | null => {
  if (['stale', 'offline', 'rejected'].includes(input.scoreFreshness ?? '')) return { id: 'review_score', label: 'Review score' };
  if (input.deliveryIssueCount > 0) return { id: 'review_delivery', label: 'Review delivery issue' };
  return null;
};
