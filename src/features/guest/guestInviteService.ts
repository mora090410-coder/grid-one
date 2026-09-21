import type { GuestReceipt, GuestRequest, GuestSnapshot, GuestTransport } from './guestInviteTypes';
import { supabase } from '../../../services/supabase';
import type { GuestInvalidationSubscriber, GuestInvalidationType } from './useGuestSync';

export class GuestApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) { super(message); this.code = code; this.status = status; }
}

const safeStorage = {
  get(key: string) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key: string, value: string) { try { window.localStorage.setItem(key, value); } catch { /* This visit still works in memory. */ } },
};

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
};

const inviteIdentity = (value: string) => {
  const id = value.split('.')[0]?.toLowerCase();
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id) ? id : 'unscoped';
};

export function createGuestCredentialStore(boardId: string, urlInviteToken?: string | null) {
  const prefix = `gridone:guest:${boardId}`;
  let inviteToken = urlInviteToken || safeStorage.get(`${prefix}:invite`) || '';
  if (inviteToken) safeStorage.set(`${prefix}:invite`, inviteToken);
  const scopedPrefix = `${prefix}:${inviteIdentity(inviteToken)}`;
  let guestToken = safeStorage.get(`${scopedPrefix}:session`) || randomToken();
  let claimCode = safeStorage.get(`${scopedPrefix}:claim-code`) || '';
  safeStorage.set(`${scopedPrefix}:session`, guestToken);
  return {
    get inviteToken() { return inviteToken; },
    get guestToken() { return guestToken; },
    get claimCode() { return claimCode; },
    rememberInvite(value: string) { inviteToken = value; safeStorage.set(`${prefix}:invite`, value); },
    rememberClaimCode(value: string) { claimCode = value; safeStorage.set(`${scopedPrefix}:claim-code`, value); },
    rotateSession() { guestToken = randomToken(); safeStorage.set(`${scopedPrefix}:session`, guestToken); return guestToken; },
  };
}

export type GuestCredentialStore = ReturnType<typeof createGuestCredentialStore>;

async function post<T>(boardId: string, request: GuestRequest): Promise<T> {
  const response = await fetch(`/api/pools/${encodeURIComponent(boardId)}/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  const result = await response.json().catch(() => ({})) as T & { code?: string; error?: string };
  if (!response.ok) throw new GuestApiError(result.error || 'The guest board could not be updated.', result.code, response.status);
  return result;
}

export function createHttpGuestTransport(boardId: string, store: GuestCredentialStore): GuestTransport {
  const withCredentials = (request: GuestRequest): GuestRequest => {
    const storedCodeAllowed = ['receipt', 'release', 'swap'].includes(request.action);
    const code = request.claimCode || (storedCodeAllowed ? store.claimCode : '');
    if (code) return { ...request, inviteToken: undefined, guestToken: undefined, claimCode: code };
    return {
      ...request,
      inviteToken: request.inviteToken || store.inviteToken || undefined,
      guestToken: request.guestToken || store.guestToken,
      claimCode: undefined,
    };
  };
  return {
    snapshot: (request) => post<GuestSnapshot>(boardId, withCredentials(request)),
    manage: async (request) => {
      const receipt = await post<GuestReceipt>(boardId, withCredentials(request));
      if (receipt.claimCode) store.rememberClaimCode(receipt.claimCode);
      return receipt;
    },
  };
}

export function safePaymentUrl(value?: string): string | null {
  if (!value) return null;
  try { const parsed = new URL(value); return parsed.protocol === 'https:' ? parsed.toString() : null; } catch { return null; }
}

const INVALIDATION_EVENTS: GuestInvalidationType[] = ['squares.held', 'squares.released', 'squares.claimed', 'invites.changed'];

/** Broadcast content is never applied. Approved event names only trigger a server snapshot refresh. */
export const subscribeGuestInvalidations: GuestInvalidationSubscriber = (boardId, onInvalidate, onConnection) => {
  let channel = supabase.channel(`pool:${boardId}`);
  for (const type of INVALIDATION_EVENTS) {
    channel = channel.on('broadcast', { event: type }, () => onInvalidate({ type }));
  }
  channel.subscribe(status => onConnection(status === 'SUBSCRIBED'));
  return () => { void supabase.removeChannel(channel); };
};
