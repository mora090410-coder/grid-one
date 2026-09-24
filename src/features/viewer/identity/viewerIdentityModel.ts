import type { BoardData } from '../../../../types';
import { distinctAssignedNames } from '../../../../utils/playerNameMatching';

export interface ViewerIdentity {
  status: 'none' | 'resolved' | 'ambiguous' | 'missing';
  participantId: string | null;
  displayName: string;
  publicLabel: string | null;
  ambiguous: boolean;
  explanation?: string;
}

/**
 * Saved "Find my squares" selection, keyed by share code in localStorage.
 * `participantId` is null on boards without participants and when two
 * participants share the chosen display name.
 */
export interface StoredViewerIdentitySelection {
  version: 2;
  participantId: string | null;
  displayName: string;
}

/** The selection before participant ids existed: display name only. */
interface LegacyStoredViewerIdentitySelection {
  version: 1;
  displayName: string;
}

export interface ViewerIdentitySelection {
  participantId: string | null;
  displayName: string;
}

export interface RestoredViewerIdentitySelection {
  action: 'restore' | 'clear' | 'empty';
  participantId: string | null;
  displayName: string;
  explanation?: string;
}

type Participant = NonNullable<BoardData['participants']>[number];

const participantsForDisplayName = (board: BoardData, displayName: string): Participant[] => (
  (board.participants || []).filter((participant) => participant.displayName === displayName)
);

export const resolveViewerIdentity = (
  board: BoardData,
  displayName: string,
  participantId?: string | null,
): ViewerIdentity => {
  if (!displayName) {
    return { status: 'none', participantId: null, displayName: '', publicLabel: null, ambiguous: false };
  }

  const participants = board.participants || [];
  if (participantId) {
    const durable = participants.find((participant) => participant.id === participantId && participant.displayName === displayName);
    if (durable) {
      return {
        status: 'resolved',
        participantId: durable.id,
        displayName: durable.displayName,
        publicLabel: durable.publicLabel,
        ambiguous: false,
      };
    }
    return {
      status: 'missing',
      participantId: null,
      displayName,
      publicLabel: null,
      ambiguous: false,
      explanation: 'Saved viewer selection no longer matches this board.',
    };
  }

  const matches = participantsForDisplayName(board, displayName);
  if (matches.length === 1) {
    const [participant] = matches;
    return {
      status: 'resolved',
      participantId: participant.id,
      displayName: participant.displayName,
      publicLabel: participant.publicLabel,
      ambiguous: false,
    };
  }
  if (matches.length > 1) {
    return {
      status: 'ambiguous',
      participantId: null,
      displayName,
      publicLabel: null,
      ambiguous: true,
      explanation: 'Multiple board participants use this display name. Choose the exact organizer-entered person.',
    };
  }

  return {
    status: 'missing',
    participantId: null,
    displayName,
    publicLabel: null,
    ambiguous: false,
    explanation: 'Selected viewer is not assigned on this board.',
  };
};

export const serializeViewerIdentitySelection = ({
  participantId,
  displayName,
}: ViewerIdentitySelection): string => JSON.stringify({ version: 2, participantId, displayName } satisfies StoredViewerIdentitySelection);

/**
 * The selection a viewer makes by picking a display name. A unique
 * participant is recorded by id; a shared name (or a board without
 * participants) stays a display-name selection so no one is silently
 * picked. Choosing the same name again keeps an already-resolved person.
 */
export const selectViewerIdentity = (
  board: BoardData,
  displayName: string,
  previous?: ViewerIdentitySelection | null,
): ViewerIdentitySelection => {
  if (!displayName) return { participantId: null, displayName: '' };
  if (previous?.participantId && previous.displayName === displayName) {
    const kept = resolveViewerIdentity(board, displayName, previous.participantId);
    if (kept.status === 'resolved') return { participantId: kept.participantId, displayName };
  }
  const identity = resolveViewerIdentity(board, displayName);
  return { participantId: identity.status === 'resolved' ? identity.participantId : null, displayName };
};

const CLEARED: RestoredViewerIdentitySelection = {
  action: 'clear',
  participantId: null,
  displayName: '',
  explanation: 'Saved viewer selection no longer matches this board.',
};

/**
 * Restores a display-name selection: a unique participant upgrades to its
 * id, a shared participant name or a board without participants keeps the
 * display name when it is still assigned, anything else clears.
 */
const restoreByDisplayName = (board: BoardData, displayName: string): RestoredViewerIdentitySelection => {
  const identity = resolveViewerIdentity(board, displayName);
  if (identity.status === 'resolved') {
    return { action: 'restore', participantId: identity.participantId, displayName: identity.displayName };
  }
  if (identity.status === 'ambiguous' || distinctAssignedNames(board.squares).includes(displayName)) {
    return { action: 'restore', participantId: null, displayName };
  }
  return CLEARED;
};

const isLegacySelection = (saved: unknown): saved is LegacyStoredViewerIdentitySelection => (
  Boolean(saved) && typeof saved === 'object'
  && (saved as { version?: unknown }).version === 1
  && typeof (saved as { displayName?: unknown }).displayName === 'string'
  && (saved as { displayName: string }).displayName !== ''
);

const isCurrentSelection = (saved: unknown): saved is StoredViewerIdentitySelection => {
  if (!saved || typeof saved !== 'object') return false;
  const value = saved as Partial<Record<keyof StoredViewerIdentitySelection, unknown>>;
  return value.version === 2
    && typeof value.displayName === 'string'
    && value.displayName !== ''
    && (value.participantId === null || typeof value.participantId === 'string');
};

export const restoreViewerIdentitySelection = (
  board: BoardData,
  raw: string | null,
): RestoredViewerIdentitySelection => {
  if (!raw) return { action: 'empty', participantId: null, displayName: '' };

  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    // Malformed storage must be cleared rather than guessed through.
    return CLEARED;
  }

  // Version 1 predates participant ids; migrate so returning viewers keep
  // their selection.
  if (isLegacySelection(saved)) return restoreByDisplayName(board, saved.displayName);
  if (!isCurrentSelection(saved)) return CLEARED;

  if (saved.participantId === null || !board.participants?.length) {
    return restoreByDisplayName(board, saved.displayName);
  }
  const identity = resolveViewerIdentity(board, saved.displayName, saved.participantId);
  if (identity.status === 'resolved') {
    return { action: 'restore', participantId: identity.participantId, displayName: identity.displayName };
  }
  return CLEARED;
};
