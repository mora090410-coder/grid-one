import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardData, GameState } from '../../../../types';
import { acknowledgeRemoteSave, failDraftSave, markDraftDirty, startDraftSave, type DraftSaveState } from '../draft/draftSaveModel';
import { readDraftRecovery, removeDraftRecovery, writeDraftRecovery } from '../draft/draftRecoveryStorage';

/** `keepalive` lets the browser finish the request after the page unloads. */
export type DraftSaveOptions = { keepalive?: boolean };

export interface UseWorkspaceDraftInput {
  game: GameState;
  board: BoardData;
  revision: number;
  isPublished: boolean;
  onSave: (data: { game: GameState; board: BoardData }, options?: DraftSaveOptions) => Promise<unknown>;
  onApply?: (game: GameState, board: BoardData) => void;
  onReload?: () => Promise<void> | void;
  debounceMs?: number;
  /** Owner + board scoped, tab-local key. Remount the workspace when it changes. */
  recoveryKey?: string;
}

export interface UseWorkspaceDraft {
  game: GameState;
  board: BoardData;
  setGame: (updater: (game: GameState) => GameState) => void;
  setBoard: (updater: (board: BoardData) => BoardData) => void;
  saveState: DraftSaveState;
  /** Resolves with the save state left behind by the flush, so callers can gate on it. */
  flush: () => Promise<DraftSaveState>;
  saveExternalGame: (save: () => Promise<Partial<GameState>>) => Promise<void>;
  retry: () => Promise<void>;
  reloadLatest: () => Promise<void>;
  recoveryUnavailable: boolean;
}

const clean = (revision: number): DraftSaveState => ({ status: 'clean', revision, canPublish: true });

export function useWorkspaceDraft({
  game,
  board,
  revision,
  isPublished,
  onSave,
  onApply,
  onReload,
  debounceMs = 800,
  recoveryKey,
}: UseWorkspaceDraftInput): UseWorkspaceDraft {
  const [recovery] = useState(() => isPublished ? null : readDraftRecovery(recoveryKey));
  const [localGame, setLocalGame] = useState(recovery?.game ?? game);
  const [localBoard, setLocalBoard] = useState(recovery?.board ?? board);
  const [saveState, setSaveState] = useState<DraftSaveState>(() => recovery
    ? { status: 'recovered', revision, canPublish: false }
    : clean(revision));
  const [recoveryUnavailable, setRecoveryUnavailable] = useState(false);

  // Mutable mirrors so async callbacks (debounced saves, retries) always see
  // the latest values without becoming stale closures.
  const latestData = useRef({ game: recovery?.game ?? game, board: recovery?.board ?? board });
  const saveStateRef = useRef(saveState);
  const revisionRef = useRef(revision);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const editedDuringSaveRef = useRef(false);
  const unloadKeepaliveRef = useRef(false);
  const unloadSentRef = useRef(false);
  const flushRef = useRef<() => Promise<DraftSaveState>>(async () => saveStateRef.current);

  // The newest server props. reloadLatest adopts these after its await,
  // because the adoption effect skips them while a conflict is still showing.
  const serverPropsRef = useRef({ game, board, revision });

  saveStateRef.current = saveState;
  revisionRef.current = revision;
  serverPropsRef.current = { game, board, revision };

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Keep saveStateRef in lockstep with every state transition. React state
  // updates are only reflected in saveStateRef.current once a render has
  // committed, which can lag behind synchronous code (e.g. flush()'s drain
  // loop) that needs to observe the outcome of a save immediately.
  const updateSaveState = useCallback((updater: (current: DraftSaveState) => DraftSaveState) => {
    const next = updater(saveStateRef.current);
    saveStateRef.current = next;
    setSaveState(next);
    return next;
  }, []);

  // Adopt server-provided state whenever nothing local is pending, in flight,
  // failed, or conflicted. A failed/conflicted save represents local work
  // that hasn't been reconciled yet -- overwriting it with fresh props would
  // silently discard the user's edits.
  useEffect(() => {
    const status = saveStateRef.current.status;
    const pending = status === 'dirty' || status === 'saving' || status === 'save_failed' || status === 'conflicted' || status === 'recovered';
    if (pending) return;
    setLocalGame(game);
    setLocalBoard(board);
    latestData.current = { game, board };
    updateSaveState(() => clean(revision));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, board, revision]);

  const runSave = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;
    if (saveStateRef.current.status !== 'dirty') return;

    // Pre-flight conflict check: compare the live prop revision against the
    // local baseline (saveState.revision), so a revision that moved during
    // the debounce window -- someone else's change landing -- is caught as
    // a conflict before we ever call onSave. The `revision` prop only
    // catches up once the caller re-renders after its own onSave resolves,
    // so it can still trail our local baseline right after we advance it
    // ourselves; that lag is not a conflict, so only a prop that has moved
    // *past* the baseline counts as one.
    const localBaseline = saveStateRef.current.revision;
    const expectedRevision = revisionRef.current > localBaseline ? revisionRef.current : localBaseline;
    const baselineRevision = localBaseline;
    const started = updateSaveState(() => startDraftSave(saveStateRef.current, { expectedRevision }));
    if (started.status !== 'saving') return;

    editedDuringSaveRef.current = false;
    const payload = latestData.current;
    const keepalive = unloadKeepaliveRef.current;
    unloadKeepaliveRef.current = false;

    const run = (async () => {
      try {
        await onSave(payload, keepalive ? { keepalive: true } : undefined);
        // Only remove the exact acknowledged snapshot; an edit during this
        // request (or another surviving document) may have written a newer one.
        removeDraftRecovery(recoveryKey, payload);
        updateSaveState((current) => {
          if (current.status !== 'saving') return current;
          const serverRevision = Math.max(revisionRef.current, current.localRevision ?? current.revision);
          return acknowledgeRemoteSave(current, { serverRevision });
        });
      } catch (error) {
        const revisionMoved = revisionRef.current > baselineRevision;
        const message = error instanceof Error ? error.message : 'save_failed';
        updateSaveState((current) => {
          if (current.status !== 'saving') return current;
          if (revisionMoved) {
            return {
              status: 'conflicted',
              revision: revisionRef.current,
              localRevision: current.localRevision,
              error: 'revision_mismatch',
              canPublish: false,
            };
          }
          return failDraftSave(current, message);
        });
      } finally {
        inFlightRef.current = null;
        if (editedDuringSaveRef.current) {
          editedDuringSaveRef.current = false;
          updateSaveState((current) => (current.status === 'clean' ? markDraftDirty(current) : current));
          scheduleSave();
        }
      }
    })();

    inFlightRef.current = run;
    return run;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave, recoveryKey]);

  const scheduleSave = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSave();
    }, debounceMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimer, debounceMs, runSave]);

  const commitLocal = useCallback((nextGame: GameState, nextBoard: BoardData) => {
    unloadSentRef.current = false;
    latestData.current = { game: nextGame, board: nextBoard };
    onApply?.(nextGame, nextBoard);

    if (isPublished) return;

    // Synchronous on EVERY edit, before the network queue or unload handlers.
    // Browser teardown cannot be relied on to execute a later promise drain.
    setRecoveryUnavailable(!writeDraftRecovery(recoveryKey, latestData.current));
    if (saveStateRef.current.status === 'recovered') return;

    if (inFlightRef.current) {
      editedDuringSaveRef.current = true;
      return;
    }

    updateSaveState((current) => (current.status === 'dirty' ? current : markDraftDirty({ status: 'clean', revision: current.revision })));
    scheduleSave();
  }, [isPublished, onApply, scheduleSave, recoveryKey]);

  const setGame = useCallback((updater: (g: GameState) => GameState) => {
    const next = updater(latestData.current.game);
    setLocalGame(next);
    commitLocal(next, latestData.current.board);
  }, [commitLocal]);

  const setBoard = useCallback((updater: (b: BoardData) => BoardData) => {
    const next = updater(latestData.current.board);
    setLocalBoard(next);
    commitLocal(latestData.current.game, next);
  }, [commitLocal]);

  const flush = useCallback(async (): Promise<DraftSaveState> => {
    clearTimer();
    if (saveStateRef.current.status === 'dirty') {
      await runSave();
    } else if (inFlightRef.current) {
      await inFlightRef.current;
    }
    // An edit can land while the save above was in flight, coalescing into
    // a fresh dirty state once it settles. Keep saving until nothing new
    // has landed, so callers awaiting flush() see every queued edit through.
    while (saveStateRef.current.status === 'dirty') {
      clearTimer();
      await runSave();
    }
    // The ref is written synchronously by updateSaveState, so it is the real
    // post-flush state -- React's committed `saveState` can still be a render
    // behind when an awaited caller reads it.
    return saveStateRef.current;
  }, [clearTimer, runSave]);

  flushRef.current = flush;

  // Serialize revision-changing field endpoints with draft autosave. Edits
  // made during the request stay local and drain against the new revision.
  const saveExternalGame = useCallback(async (save: () => Promise<Partial<GameState>>) => {
    const drained = await flush();
    if (drained.status !== 'clean') throw new Error('Save or reload the board before saving these changes.');
    clearTimer();
    const baseline = drained.revision;
    editedDuringSaveRef.current = false;
    updateSaveState((current) => startDraftSave(markDraftDirty(current), { expectedRevision: baseline }));
    const operation = (async () => {
      try {
        const fields = await save();
        const nextGame = { ...latestData.current.game, ...fields };
        latestData.current = { ...latestData.current, game: nextGame };
        if (editedDuringSaveRef.current && !isPublished) {
          // The external fields have already committed. A recovery copy made
          // during that request must not replay their old values after reload.
          setRecoveryUnavailable(!writeDraftRecovery(recoveryKey, latestData.current));
        }
        setLocalGame(nextGame);
        onApply?.(nextGame, latestData.current.board);
        // The contests update trigger increments revision exactly once. A
        // larger revision belongs to another write and must stay a conflict.
        updateSaveState(() => revisionRef.current > baseline + 1
          ? { status: 'conflicted', revision: revisionRef.current, error: 'revision_mismatch', canPublish: false }
          : clean(baseline + 1));
      } catch (error) {
        // A failed field endpoint never saved the payout form. Keep its error
        // with that form; do not pretend retrying a draft PUT can save it.
        const conflict = error as { code?: string; currentRevision?: number };
        updateSaveState(() => conflict?.code === 'REVISION_CONFLICT' || revisionRef.current > baseline
          ? { status: 'conflicted', revision: Number.isInteger(conflict?.currentRevision) ? conflict.currentRevision! : revisionRef.current, error: 'revision_mismatch', canPublish: false }
          : clean(baseline));
        throw error;
      } finally {
        inFlightRef.current = null;
        if (editedDuringSaveRef.current && !isPublished) {
          editedDuringSaveRef.current = false;
          updateSaveState((current) => current.status === 'clean' ? markDraftDirty(current) : current);
          scheduleSave();
        }
      }
    })();
    // flush() waits for completion while callers of this method retain errors.
    inFlightRef.current = operation.catch(() => undefined);
    await operation;
  }, [flush, clearTimer, updateSaveState, onApply, isPublished, scheduleSave, recoveryKey]);

  const retry = useCallback(async () => {
    if (saveStateRef.current.status !== 'save_failed' && saveStateRef.current.status !== 'recovered') return;
    const current = saveStateRef.current;
    if (current.status === 'recovered') onApply?.(latestData.current.game, latestData.current.board);
    updateSaveState(() => ({
      status: 'dirty',
      revision: current.revision,
      localRevision: current.localRevision ?? current.revision + 1,
      canPublish: false,
    }));
    await runSave();
  }, [runSave, onApply]);

  const reloadLatest = useCallback(async () => {
    clearTimer();
    await onReload?.();
    // Take the server copy explicitly. Marking the old local draft clean at
    // the new revision would let the next edit save it over the newer board.
    const server = serverPropsRef.current;
    setLocalGame(server.game);
    setLocalBoard(server.board);
    latestData.current = { game: server.game, board: server.board };
    removeDraftRecovery(recoveryKey);
    setRecoveryUnavailable(false);
    updateSaveState(() => clean(server.revision));
  }, [clearTimer, onReload, updateSaveState, recoveryKey]);

  useEffect(() => {
    // A reload inside the debounce window used to drop the edit. Start the
    // save best-effort with keepalive. Queued callbacks may not run after
    // teardown; the synchronous tab snapshot retains unacknowledged edits.
    // beforeunload and pagehide share one send.
    const flushForUnload = () => {
      if (unloadSentRef.current) return;
      const status = saveStateRef.current.status;
      if (status !== 'dirty' && status !== 'saving') return;
      unloadSentRef.current = true;
      const releaseIfStillHere = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          unloadSentRef.current = false;
        }
      };
      // Drain through the same revision queue; never duplicate an active write.
      unloadKeepaliveRef.current = true;
      void flushRef.current().then(releaseIfStillHere, releaseIfStillHere);
    };
    const guard = (event: BeforeUnloadEvent) => {
      const status = saveStateRef.current.status;
      if (status === 'dirty' || status === 'saving') {
        event.preventDefault();
        event.returnValue = '';
      }
      flushForUnload();
    };
    window.addEventListener('beforeunload', guard);
    window.addEventListener('pagehide', flushForUnload);
    return () => {
      window.removeEventListener('beforeunload', guard);
      window.removeEventListener('pagehide', flushForUnload);
    };
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return {
    game: localGame,
    board: localBoard,
    setGame,
    setBoard,
    saveState,
    flush,
    retry,
    saveExternalGame,
    reloadLatest,
    recoveryUnavailable,
  };
}
