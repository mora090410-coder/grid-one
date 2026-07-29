import { BoardData, EntryMeta } from '../types';
import { hasValidAxes } from './boardValidation';

export type OrganizerDestination = 'assign' | 'reconcile' | 'draw' | 'preview' | 'scoring';
export type OrganizerPhase = 'fill' | 'draw' | 'preview' | 'live';

export interface OrganizerProgress {
  phase: OrganizerPhase;
  destination: OrganizerDestination;
  assigned: number;
  open: number;
  paymentReviewCount: number;
  axesReady: boolean;
  actionLabel: string;
}

export const getOrganizerProgress = ({
  board,
  entryMetaByIndex,
  isPublished,
}: {
  board: BoardData;
  entryMetaByIndex: Record<number, EntryMeta>;
  isPublished: boolean;
}): OrganizerProgress => {
  const assignedIndices = board.squares.reduce<number[]>((indices, names, index) => {
    if (names?.length) indices.push(index);
    return indices;
  }, []);
  const assigned = assignedIndices.length;
  const open = Math.max(0, 100 - assigned);
  const paymentReviewCount = assignedIndices.filter(
    (index) => entryMetaByIndex[index]?.paid_status !== 'paid',
  ).length;
  const axesReady = hasValidAxes(board);

  if (isPublished) {
    return {
      phase: 'live',
      destination: 'scoring',
      assigned,
      open,
      paymentReviewCount,
      axesReady,
      actionLabel: 'Open game-day controls',
    };
  }

  if (open > 0) {
    return {
      phase: 'fill',
      destination: 'assign',
      assigned,
      open,
      paymentReviewCount,
      axesReady,
      actionLabel: `Assign ${open} ${open === 1 ? 'square' : 'squares'}`,
    };
  }

  if (!axesReady) {
    return {
      phase: 'draw',
      destination: 'draw',
      assigned,
      open,
      paymentReviewCount,
      axesReady,
      actionLabel: 'Draw board numbers',
    };
  }

  return {
    phase: 'preview',
    destination: 'preview',
    assigned,
    open,
    paymentReviewCount,
    axesReady,
    actionLabel: 'Preview board',
  };
};
