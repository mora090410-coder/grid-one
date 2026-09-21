import { beforeEach, expect, it, vi } from 'vitest';
import { createGuestCredentialStore, createHttpGuestTransport, safePaymentUrl } from '../src/features/guest/guestInviteService';

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); vi.restoreAllMocks(); });

it('retains narrow credentials across reloads and sends them only in the no-store request body', async () => {
  const store = createGuestCredentialStore('board-1', 'signed-token');
  const response = { boardId: 'board-1', title: 'Board', shareCode: 'ABCDEFGH', revision: 1, serverTime: new Date().toISOString(), stage: 'selling', squares: Array.from({length:100},()=>[]), allocationLabels: Array(100).fill(null), availability: Array(100).fill('unspecified'), holds: [], claimedCells: [] };
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
  vi.stubGlobal('fetch', fetcher);
  await createHttpGuestTransport('board-1', store).snapshot({ action: 'read' });
  const options = fetcher.mock.calls[0][1];
  const body = JSON.parse(options.body);
  expect(body).toMatchObject({ action: 'read', inviteToken: 'signed-token' });
  expect(body.guestToken).toMatch(/^[a-f0-9]{64}$/);
  expect(options).toMatchObject({ cache: 'no-store', referrerPolicy: 'no-referrer' });
  expect(createGuestCredentialStore('board-1').guestToken).toBe(body.guestToken);
});

it('renders only HTTPS payment destinations', () => {
  expect(safePaymentUrl('javascript:alert(1)')).toBeNull();
  expect(safePaymentUrl('http://example.com')).toBeNull();
  expect(safePaymentUrl('https://example.com/pay')).toBe('https://example.com/pay');
});

it('uses one credential kind and preserves the guest session across invite rotation', async () => {
  const id = '30000000-0000-4000-8000-000000000002';
  const first = createGuestCredentialStore('board-2', `${id}.1.${'a'.repeat(64)}`);
  const token = first.guestToken;
  first.rememberClaimCode('tiger-lamp-orbit-seven');
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ groupId: 'g', inviteId: id, displayName: 'Sam', cells: [0], claimedAt: null, canManage: false, payment: null }) });
  vi.stubGlobal('fetch', fetcher);
  await createHttpGuestTransport('board-2', first).manage({ action: 'receipt' });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ action: 'receipt', claimCode: 'tiger-lamp-orbit-seven' });
  const rotated = createGuestCredentialStore('board-2', `${id}.2.${'b'.repeat(64)}`);
  expect(rotated.guestToken).toBe(token);
});
