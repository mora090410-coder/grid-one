import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimCodeFor, hashGuestCredential, signInvite, verifyInvite, validPayment } from '../functions/_lib/guestInviteCredentials';

const board = '30000000-0000-4000-8000-000000000001';
const invite = '30000000-0000-4000-8000-000000000002';
const secret = 'test-only-secret-with-at-least-32-bytes';
beforeEach(() => vi.stubGlobal('crypto', webcrypto));

describe('guest invite capabilities', () => {
  it('recreates a stable URL credential and binds it to board, version, and secret', async () => {
    const token = await signInvite(secret, board, invite, 1);
    expect(await signInvite(secret, board, invite, 1)).toBe(token);
    expect(await verifyInvite(secret, board, token)).toEqual({ id: invite, version: 1 });
    expect(await verifyInvite(secret, invite, token)).toBeNull();
    expect(await verifyInvite(secret + 'other', board, token)).toBeNull();
    expect(await verifyInvite(secret, board, token.replace('.1.', '.2.'))).toBeNull();
    expect(await verifyInvite(secret, board, token + 'x')).toBeNull();
  });
  it('derives repeatable four-word codes for response-loss recovery, isolated by guest/invite/board', async () => {
    const code = await claimCodeFor(secret, board, invite, 'a'.repeat(64));
    expect(code).toMatch(/^[a-z]+(?:-[a-z]+){3}$/);
    expect(await claimCodeFor(secret, board, invite, 'a'.repeat(64))).toBe(code);
    expect(await claimCodeFor(secret, board, invite, 'b'.repeat(64))).not.toBe(code);
    expect(await claimCodeFor(secret, invite, board, 'a'.repeat(64))).not.toBe(code);
    expect(await hashGuestCredential(code)).not.toContain(code);
    expect(await hashGuestCredential(code)).toHaveLength(64);
  });
  it('permits plain instructions and HTTPS destinations, rejects executable/credential-bearing URLs', () => {
    expect(validPayment({ label: 'Arrange payment', detail: 'Contact Anthony separately.' })).toBe(true);
    expect(validPayment({ label: 'Instructions', detail: 'Continue outside GridOne', url: 'https://example.com/anthony' })).toBe(true);
    for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com', 'https://user:password@example.com', 'https://localhost/pay', 'https://127.0.0.1/pay']) {
      expect(validPayment({ label: 'Instructions', detail: 'Details', url })).toBe(false);
    }
    expect(validPayment({ label: 'Instructions', detail: 'Details', paid: true })).toBe(false);
  });
});
