import { configuredPriceForTier, type PriceEnvironment } from './pricingTiers';

type CheckoutEnvironment = PriceEnvironment & Record<string, unknown>;
const present = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

/** Configuration presence only, not a certification of processor or webhook delivery. */
export const checkoutConfigured = (env: CheckoutEnvironment): boolean =>
  ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
    .every(key => present(env[key]));

/** Call with a contest ID only after verifying its ownership. Never expose the allowlist. */
export const paidSignupAllowed = (env: CheckoutEnvironment, ownedContestId?: string): boolean =>
  String(env.PAID_SIGNUP_ENABLED || '').toLowerCase() === 'true'
  || Boolean(ownedContestId && String(env.CHECKOUT_SMOKE_CONTEST_IDS || '').split(',').map(id => id.trim()).filter(Boolean).includes(ownedContestId));

export const checkoutAvailability = (env: CheckoutEnvironment, ownedContestId?: string) => {
  const available = checkoutConfigured(env) && paidSignupAllowed(env, ownedContestId);
  return {
    gameday: available && Boolean(configuredPriceForTier('gameday', env)),
    org: available && Boolean(configuredPriceForTier('org', env)),
  };
};
