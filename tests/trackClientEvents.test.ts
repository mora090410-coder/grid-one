import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTracker, track } from '../src/features/instrumentation/track';

type Nav = { sendBeacon?: (url: string, data: Blob) => boolean; doNotTrack?: string | null; globalPrivacyControl?: boolean };
const flush = () => new Promise(resolve => setTimeout(resolve, 5));
const blobText = (blob: Blob) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.restoreAllMocks(); });

it('delivers a valid event through sendBeacon as a JSON blob', async () => {
  const sendBeacon = vi.fn(() => true);
  const fetchImpl = vi.fn();
  const tracker = createTracker({ getNavigator: () => ({ sendBeacon } as Nav), fetchImpl, enabled: true });
  tracker.track({ name: 'find_my_squares_opened', surface: 'viewer' });
  await flush();
  expect(sendBeacon).toHaveBeenCalledTimes(1);
  const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
  expect(url).toBe('/api/events');
  expect(JSON.parse(await blobText(blob))).toEqual({ name: 'find_my_squares_opened', surface: 'viewer' });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('falls back to keepalive fetch when sendBeacon is missing or refuses', async () => {
  const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  const refused = vi.fn(() => false);
  for (const nav of [{} as Nav, { sendBeacon: refused } as Nav]) {
    const tracker = createTracker({ getNavigator: () => nav, fetchImpl, enabled: true });
    tracker.track({ name: 'homepage_primary_action', action: 'create_board', surface: 'homepage' });
  }
  await flush();
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(fetchImpl).toHaveBeenCalledWith('/api/events', expect.objectContaining({ method: 'POST', keepalive: true }));
});

it('respects Do Not Track and Global Privacy Control', async () => {
  const sendBeacon = vi.fn(() => true);
  for (const nav of [{ sendBeacon, doNotTrack: '1' }, { sendBeacon, globalPrivacyControl: true }] as Nav[]) {
    createTracker({ getNavigator: () => nav, fetchImpl: vi.fn(), enabled: true }).track({ name: 'find_my_squares_opened', surface: 'viewer' });
  }
  await flush();
  expect(sendBeacon).not.toHaveBeenCalled();
});

it('does nothing without a window or navigator, and never throws', async () => {
  const fetchImpl = vi.fn();
  expect(() => createTracker({ getNavigator: () => undefined, fetchImpl, enabled: true }).track({ name: 'find_my_squares_opened', surface: 'viewer' })).not.toThrow();
  const throwing = createTracker({
    getNavigator: () => ({ sendBeacon: () => { throw new Error('boom'); } } as Nav),
    fetchImpl: () => { throw new Error('boom'); },
    enabled: true,
  });
  expect(() => throwing.track({ name: 'find_my_squares_opened', surface: 'viewer' })).not.toThrow();
  expect(() => throwing.track({ name: 'find_my_squares_opened', surface: 'viewer', email: 'a@b.c' } as never)).not.toThrow();
  await flush();
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('drops invalid or prohibited events before anything leaves the browser', async () => {
  const sendBeacon = vi.fn(() => true);
  const tracker = createTracker({ getNavigator: () => ({ sendBeacon }), fetchImpl: vi.fn(), enabled: true });
  tracker.track({ name: 'find_my_squares_opened', surface: 'viewer', email: 'a@b.c' } as never);
  tracker.track({ name: 'not_an_event' } as never);
  await flush();
  expect(sendBeacon).not.toHaveBeenCalled();
});

it('sends an identical event once per tick (StrictMode double effects) but again on a later tick', async () => {
  const sendBeacon = vi.fn(() => true);
  const tracker = createTracker({ getNavigator: () => ({ sendBeacon }), fetchImpl: vi.fn(), enabled: true });
  tracker.track({ name: 'find_my_squares_opened', surface: 'viewer' });
  tracker.track({ name: 'find_my_squares_opened', surface: 'viewer' });
  tracker.track({ name: 'find_my_squares_resolved', matchBucket: 'one' });
  await flush();
  expect(sendBeacon).toHaveBeenCalledTimes(2);
  tracker.track({ name: 'find_my_squares_opened', surface: 'viewer' });
  await flush();
  expect(sendBeacon).toHaveBeenCalledTimes(3);
});

it('the default tracker is inert outside production builds, so tests never reach the network', async () => {
  const sendBeacon = vi.fn(() => true);
  Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  track({ name: 'find_my_squares_opened', surface: 'viewer' });
  await flush();
  expect(sendBeacon).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
  delete (navigator as unknown as { sendBeacon?: unknown }).sendBeacon;
});
