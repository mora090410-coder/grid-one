import { createClientEventRecorder } from './clientEvents';
import type { GridOneInstrumentationEvent } from './eventSchema';

/**
 * Fire-and-forget delivery of privacy-minimal client events to `/api/events`.
 * `track` never throws, never awaits, and sends nothing when the viewer asks
 * not to be tracked (Do Not Track / Global Privacy Control), outside a browser,
 * or outside production builds (tests and local dev stay offline).
 */
export const CLIENT_EVENTS_ENDPOINT = '/api/events';

type BeaconNavigator = {
  sendBeacon?: (url: string, data: Blob) => boolean;
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
};

export type TrackerDeps = {
  getNavigator: () => BeaconNavigator | undefined;
  fetchImpl: (input: string, init: RequestInit) => unknown;
  enabled: boolean;
};

export type Tracker = { track(event: GridOneInstrumentationEvent): void };

const optedOut = (nav: BeaconNavigator) => nav.doNotTrack === '1' || nav.globalPrivacyControl === true;

export function createTracker(deps: TrackerDeps): Tracker {
  const sentThisTick = new Set<string>();

  const recorder = createClientEventRecorder({
    deliver: async (event, signal) => {
      const body = JSON.stringify(event);
      const nav = deps.getNavigator();
      if (typeof nav?.sendBeacon === 'function') {
        // text/plain keeps the beacon a CORS-simple request; the server parses the body as JSON.
        if (nav.sendBeacon(CLIENT_EVENTS_ENDPOINT, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
      }
      await deps.fetchImpl(CLIENT_EVENTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'omit',
        signal,
      });
    },
  });

  return {
    track(event) {
      try {
        if (!deps.enabled) return;
        const nav = deps.getNavigator();
        if (!nav || optedOut(nav)) return;
        const key = JSON.stringify(event);
        if (sentThisTick.has(key)) return;
        sentThisTick.add(key);
        setTimeout(() => sentThisTick.delete(key), 0);
        void recorder.record(event).catch(() => undefined);
      } catch {
        // Analytics must never interrupt the product.
      }
    },
  };
}

const defaultTracker = createTracker({
  getNavigator: () => (typeof window === 'undefined' || typeof navigator === 'undefined' ? undefined : navigator as BeaconNavigator),
  fetchImpl: (input, init) => fetch(input, init),
  enabled: import.meta.env.PROD === true,
});

export const track = (event: GridOneInstrumentationEvent): void => defaultTracker.track(event);
