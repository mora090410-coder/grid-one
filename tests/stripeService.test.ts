import { afterEach, describe, expect, it, vi } from 'vitest';
import { activateWithEntitlement } from '../services/stripe';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('season-pass activation client', () => {
    it('preserves the inactive-pass state so the UI can offer a deliberate repurchase', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
            code: 'SEASON_PASS_INACTIVE',
            error: 'Your 2026 season pass is inactive.',
            needsPayment: true,
            canRepurchase: true,
        }), {
            status: 402,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(activateWithEntitlement('board-1', 'token')).resolves.toEqual({
            activated: false,
            needsPayment: true,
            code: 'SEASON_PASS_INACTIVE',
            message: 'Your 2026 season pass is inactive.',
            canRepurchase: true,
        });
    });

    it('preserves the ordinary purchase-required state', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
            code: 'PAYMENT_REQUIRED',
            needsPayment: true,
        }), {
            status: 402,
            headers: { 'Content-Type': 'application/json' },
        })));

        await expect(activateWithEntitlement('board-1', 'token')).resolves.toEqual({
            activated: false,
            needsPayment: true,
            code: 'PAYMENT_REQUIRED',
            message: undefined,
            canRepurchase: false,
        });
    });
});
