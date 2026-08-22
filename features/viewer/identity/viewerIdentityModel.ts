import type { BoardData } from '../../../types';

export interface ViewerIdentity {
  status: 'none' | 'resolved' | 'ambiguous' | 'missing';
  participantId: string | null;
  displayName: string;
  publicLabel: string | null;
  ambiguous: boolean;
  explanation?: string;
}

export interface StoredViewerIdentitySelection {
  version: 2;
  participantId: string;
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
}: {
  participantId: string;
  displayName: string;
}): string => JSON.stringify({ version: 2, participantId, displayName } satisfies StoredViewerIdentitySelection);

export const restoreViewerIdentitySelection = (
  board: BoardData,
  raw: string | null,
): RestoredViewerIdentitySelection => {
  if (!raw) return { action: 'empty', participantId: null, displayName: '' };

  try {
    const saved = JSON.parse(raw) as Partial<StoredViewerIdentitySelection> & { version?: unknown };
    if (saved.version !== 2 || typeof saved.participantId !== 'string' || typeof saved.displayName !== 'string') {
      return {
        action: 'clear',
        participantId: null,
        displayName: '',
        explanation: 'Saved viewer selection no longer matches this board.',
      };
    }

    const identity = resolveViewerIdentity(board, saved.displayName, saved.participantId);
    if (identity.status === 'resolved') {
      return {
        action: 'restore',
        participantId: identity.participantId,
        displayName: identity.displayName,
      };
    }
  } catch {
    // Malformed storage must be cleared rather than guessed through.
  }

  return {
    action: 'clear',
    participantId: null,
    displayName: '',
    explanation: 'Saved viewer selection no longer matches this board.',
  };
};
