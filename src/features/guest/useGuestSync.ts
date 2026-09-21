import { useCallback, useEffect, useRef, useState } from 'react';
import type { GuestConnection } from './guestInviteTypes';

export type GuestInvalidationType = 'squares.held' | 'squares.released' | 'squares.claimed' | 'invites.changed';
export type GuestInvalidationSubscriber = (
  boardId: string,
  onInvalidate: (event?: { type: GuestInvalidationType; version?: number }) => void,
  onConnection: (connected: boolean) => void,
) => () => void;

export interface UseGuestSyncInput {
  boardId: string;
  enabled: boolean;
  refresh: () => Promise<void> | void;
  subscribe?: GuestInvalidationSubscriber;
}

const INVALIDATION_DEBOUNCE_MS = 75;
const MIN_REFRESH_CADENCE_MS = 500;

/** Realtime messages are hints only. Every hint converges through a fresh server snapshot. */
export function useGuestSync({ boardId, enabled, refresh, subscribe }: UseGuestSyncInput) {
  const [connection, setConnection] = useState<GuestConnection>(subscribe ? 'connecting' : 'live');
  const [stale, setStale] = useState(false);
  const refreshing = useRef(false);
  const queued = useRef(false);
  const timer = useRef<number | null>(null);
  const lastRefreshStartedAt = useRef(0);
  const refreshRef = useRef(refresh);
  const enabledRef = useRef(enabled);
  refreshRef.current = refresh;
  enabledRef.current = enabled;

  const runRefresh = useCallback(async () => {
    if (!enabledRef.current) return;
    if (refreshing.current) { queued.current = true; return; }
    refreshing.current = true;
    lastRefreshStartedAt.current = Date.now();
    try {
      await refreshRef.current();
      setStale(false);
    } catch {
      setStale(true);
      setConnection((current) => current === 'offline' ? current : 'reconnecting');
    } finally {
      refreshing.current = false;
      if (queued.current && enabledRef.current && timer.current === null) {
        queued.current = false;
        const delay = Math.max(0, MIN_REFRESH_CADENCE_MS - (Date.now() - lastRefreshStartedAt.current));
        timer.current = window.setTimeout(() => { timer.current = null; void runRefresh(); }, delay);
      }
    }
  }, []);

  const invalidate = useCallback(() => {
    if (!enabledRef.current || timer.current !== null) return;
    const cadenceDelay = Math.max(0, MIN_REFRESH_CADENCE_MS - (Date.now() - lastRefreshStartedAt.current));
    const delay = Math.max(INVALIDATION_DEBOUNCE_MS, cadenceDelay);
    timer.current = window.setTimeout(() => { timer.current = null; void runRefresh(); }, delay);
  }, [runRefresh]);

  useEffect(() => {
    if (!enabled) return;
    setConnection(subscribe ? 'connecting' : navigator.onLine === false ? 'offline' : 'live');
    const unsubscribe = subscribe?.(boardId, invalidate, (connected) => {
      setConnection(connected ? 'live' : navigator.onLine === false ? 'offline' : 'reconnecting');
      if (connected) void runRefresh();
      else setStale(true);
    });
    const focus = () => { if (document.visibilityState === 'visible') void runRefresh(); };
    const online = () => { setConnection('reconnecting'); void runRefresh(); };
    const offline = () => { setConnection('offline'); setStale(true); };
    window.addEventListener('focus', focus);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void runRefresh();
    }, 15_000);
    return () => {
      unsubscribe?.();
      window.clearInterval(poll);
      if (timer.current !== null) window.clearTimeout(timer.current);
      window.removeEventListener('focus', focus);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [boardId, enabled, invalidate, runRefresh, subscribe]);

  return { connection, stale, invalidate };
}
