import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

import { createCheckoutSession } from '../services/stripe';

beforeEach(() => {
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: 'access-token' } },
  });
  vi.stubGlobal('window', {
    location: { href: 'https://www.getgridone.com/' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('tiered checkout client', () => {
  it('sends the Game Day tier without organization metadata', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      url: 'https://checkout.stripe.test/gameday',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await createCheckoutSession('board-1', 'gameday');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/stripe/create-checkout-session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
        body: JSON.stringify({
          contestId: 'board-1',
          tier: 'gameday',
        }),
      }),
    );
    expect(window.location.href).toBe('https://checkout.stripe.test/gameday');
  });

  it('sends the Organization tier and organization name', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      url: 'https://checkout.stripe.test/org',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await createCheckoutSession(
      'board-2',
      'org',
      'Riverside Ravens Booster Club',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/stripe/create-checkout-session',
      expect.objectContaining({
        body: JSON.stringify({
          contestId: 'board-2',
          tier: 'org',
          organizationName: 'Riverside Ravens Booster Club',
        }),
      }),
    );
    expect(window.location.href).toBe('https://checkout.stripe.test/org');
  });
});
