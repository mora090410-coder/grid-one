import { describe, expect, it } from 'vitest';
import { checkoutAvailability } from '../functions/_lib/checkoutAvailability';
const env = { STRIPE_SECRET_KEY: 'fixture', STRIPE_WEBHOOK_SECRET: 'fixture', SUPABASE_SERVICE_ROLE_KEY: 'fixture', VITE_SUPABASE_URL: 'https://example.test', VITE_SUPABASE_ANON_KEY: 'fixture', STRIPE_GAMEDAY_PRICE_ID: 'price_fixture_day', STRIPE_ORG_PRICE_ID: 'price_fixture_org', PAID_SIGNUP_ENABLED: 'true' };
describe('checkout configuration availability', () => {
  it('offers both configured tiers', () => expect(checkoutAvailability(env)).toEqual({ gameday: true, org: true }));
  it.each(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])('closes both tiers for absent %s', key => {
    expect(checkoutAvailability({ ...env, [key]: ' ' })).toEqual({ gameday: false, org: false });
  });
  it('closes only the missing tier price', () => expect(checkoutAvailability({ ...env, STRIPE_ORG_PRICE_ID: '' })).toEqual({ gameday: true, org: false }));
  it('does not advertise smoke exceptions globally or to a different board', () => {
    const closed = { ...env, PAID_SIGNUP_ENABLED: 'false', CHECKOUT_SMOKE_CONTEST_IDS: ' one, two ' };
    expect(checkoutAvailability(closed)).toEqual({ gameday: false, org: false });
    expect(checkoutAvailability(closed, 'other')).toEqual({ gameday: false, org: false });
    expect(checkoutAvailability(closed, 'one')).toEqual({ gameday: true, org: true });
    expect(checkoutAvailability({ ...closed, STRIPE_WEBHOOK_SECRET: '' }, 'one')).toEqual({ gameday: false, org: false });
  });
});
