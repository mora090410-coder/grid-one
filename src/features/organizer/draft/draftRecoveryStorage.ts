import type { BoardData, GameState } from '../../../../types';

type RecoveryPayload = { game: GameState; board: BoardData };
type StoredDraft = RecoveryPayload & { version: 1; expiresAt: number };
const DAY_MS = 24 * 60 * 60 * 1000;

/** Tab-local only. The caller scopes the key to verified owner + board identity. */
export const readDraftRecovery = (key: string | undefined): RecoveryPayload | null => {
  if (!key || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredDraft;
    if (value.version !== 1 || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()
      || typeof value.game?.title !== 'string'
      || !Array.isArray(value.board?.squares) || value.board.squares.length !== 100
      || !value.board.squares.every((names) => Array.isArray(names) && names.every((name) => typeof name === 'string'))
      || !Array.isArray(value.board.topAxis) || value.board.topAxis.length !== 10
      || !Array.isArray(value.board.leftAxis) || value.board.leftAxis.length !== 10) {
      sessionStorage.removeItem(key);
      return null;
    }
    return { game: value.game, board: value.board };
  } catch { return null; }
};

export const writeDraftRecovery = (key: string | undefined, data: RecoveryPayload): boolean => {
  if (!key) return true;
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...data, version: 1, expiresAt: Date.now() + DAY_MS } satisfies StoredDraft));
    return true;
  } catch { return false; } // Private mode/quota: never claim that recovery is available.
};

export const removeDraftRecovery = (key: string | undefined, acknowledged?: RecoveryPayload): void => {
  if (!key) return;
  try {
    if (acknowledged) {
      const snapshot = readDraftRecovery(key);
      if (!snapshot || JSON.stringify(snapshot) !== JSON.stringify(acknowledged)) return;
    }
    sessionStorage.removeItem(key);
  } catch { /* Server saves remain authoritative. */ }
};
