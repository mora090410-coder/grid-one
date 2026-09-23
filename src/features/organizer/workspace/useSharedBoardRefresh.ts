import { useEffect, useRef } from 'react';

/** How often an open organizer workspace checks for names added through seller links. */
export const SHARED_BOARD_REFRESH_MS = 20_000;

interface SharedBoardRefreshInput {
  /** Only shared, unpublished boards take outside edits (seller links, family links). */
  enabled: boolean;
  /** False whenever local work is unsaved, saving, conflicted, or a dialog is mid-edit. */
  canRefresh: () => boolean;
  refresh: () => Promise<unknown>;
  intervalMs?: number;
}

/**
 * Keeps the organizer's board current while buyers claim squares elsewhere.
 * It only reloads when nothing local could be overwritten; the draft hook
 * adopts server data only in a clean state, so unsaved edits are never lost.
 */
export function useSharedBoardRefresh({ enabled, canRefresh, refresh, intervalMs = SHARED_BOARD_REFRESH_MS }: SharedBoardRefreshInput) {
  const canRefreshRef = useRef(canRefresh);
  const refreshRef = useRef(refresh);
  canRefreshRef.current = canRefresh;
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    let running = false;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || running || document.visibilityState !== 'visible' || !canRefreshRef.current()) return;
      running = true;
      try { await refreshRef.current(); } catch { /* Next tick retries; the board keeps its last loaded state. */ }
      finally { running = false; }
    };
    const timer = window.setInterval(() => { void tick(); }, intervalMs);
    const onFocus = () => { void tick(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void tick(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs]);
}
