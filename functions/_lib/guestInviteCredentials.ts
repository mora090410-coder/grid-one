import { guestClaimWords } from './guestClaimWords';
import { sha256Hex } from './crypto';
import type { GuestPayment } from '../../src/features/guest/guestInviteTypes';

export const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const sessionPattern = /^[a-f0-9]{64}$/;
export const codePattern = /^[a-z]{2,16}(?:-[a-z]{2,16}){3}$/;
const bytes = (value: string) => new TextEncoder().encode(value);
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
export const hashGuestCredential = sha256Hex;
export const randomGuestToken = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer);

async function hmac(secret: string, value: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', bytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, bytes(value));
}
export const keyedGuestHash = async (secret: string, value: string) => hex(await hmac(secret, value));

export async function signInvite(secret: string, board: string, id: string, version: number): Promise<string> {
  const payload = `${id.toLowerCase()}.${version}`;
  return `${payload}.${await keyedGuestHash(secret, `invite|${board.toLowerCase()}|${payload}`)}`;
}
export async function verifyInvite(secret: string, board: string, token: string): Promise<{ id: string; version: number } | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || !uuid.test(parts[0]) || !/^[1-9][0-9]{0,9}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return null;
  const expected = await signInvite(secret, board, parts[0], Number(parts[1]));
  // Compare all signature bytes without early exit. The payload length is public.
  const signature = expected.split('.')[2];
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= signature.charCodeAt(i) ^ parts[2].charCodeAt(i);
  return difference === 0 ? { id: parts[0].toLowerCase(), version: Number(parts[1]) } : null;
}

/** Deterministic for safe response-loss retries; entropy comes from a 256-bit guest capability. */
export async function claimCodeFor(secret: string, board: string, invite: string, capability: string): Promise<string> {
  const selected: string[] = [];
  const limit = Math.floor(0x100000000 / guestClaimWords.length) * guestClaimWords.length;
  for (let counter = 0; selected.length < 4; counter++) {
    const digest = new DataView(await hmac(secret, `claim|${board}|${invite}|${capability}|${counter}`));
    for (let i = 0; i < digest.byteLength && selected.length < 4; i += 4) {
      const number = digest.getUint32(i);
      if (number < limit) selected.push(guestClaimWords[number % guestClaimWords.length]);
    }
  }
  return selected.join('-');
}

export function validPayment(value: unknown): value is GuestPayment | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payment = value as Record<string, unknown>;
  if (Object.keys(payment).some(key => !['label', 'detail', 'url'].includes(key))) return false;
  if (typeof payment.label !== 'string' || !payment.label.trim() || payment.label.length > 60 || typeof payment.detail !== 'string' || !payment.detail.trim() || payment.detail.length > 500) return false;
  if (payment.url === undefined || payment.url === '') return true;
  if (typeof payment.url !== 'string' || payment.url.length > 2048 || payment.url !== payment.url.trim()) return false;
  try {
    const url = new URL(payment.url);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash &&
      url.hostname.includes('.') && !url.hostname.endsWith('.local') && !url.hostname.endsWith('.localhost') &&
      !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname);
  } catch { return false; }
}
