const RELOAD_KEY = 'gridone:stale-chunk-reload-at';
const RETRY_WINDOW_MS = 10_000;

interface ReloadDeps {
  now: () => number;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  reload: () => void;
}

/**
 * After a deploy, a tab opened earlier can ask for a code file the new version
 * no longer has. Reload once so the page picks up the new version. A second
 * failure within a few seconds is a real error, so it goes to the error screen
 * instead of reloading in a loop.
 * Returns true when it handled the failure by reloading.
 */
export const reloadForStaleChunk = ({ now, storage, reload }: ReloadDeps): boolean => {
  let last = 0;
  try { last = Number(storage?.getItem(RELOAD_KEY)) || 0; } catch { /* storage blocked */ }
  if (now() - last < RETRY_WINDOW_MS) return false;
  try { storage?.setItem(RELOAD_KEY, String(now())); } catch { /* storage blocked: still reload once */ }
  reload();
  return true;
};

/** Vite fires `vite:preloadError` when a lazily loaded file cannot be fetched. */
export const installStaleChunkReload = (target: Window) => {
  target.addEventListener('vite:preloadError', (event) => {
    let storage: Storage | null = null;
    try { storage = target.sessionStorage; } catch { storage = null; }
    if (reloadForStaleChunk({ now: Date.now, storage, reload: () => target.location.reload() })) {
      event.preventDefault();
    }
  });
};
