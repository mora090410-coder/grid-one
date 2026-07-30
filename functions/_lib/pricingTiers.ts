export type PaidTier = 'gameday' | 'org';
export type PricingTier = 'free' | PaidTier | 'legacy';

export type PriceEnvironment = {
  STRIPE_GAMEDAY_PRICE_ID?: string;
  STRIPE_ORG_PRICE_ID?: string;
};

export type PaidTierDefinition = {
  tier: PaidTier;
  amountCents: 999 | 7900;
  allowance: 5 | 50;
  envKey: 'STRIPE_GAMEDAY_PRICE_ID' | 'STRIPE_ORG_PRICE_ID';
  label: 'Game Day' | 'Organization';
};

export const PAID_TIERS: Record<PaidTier, PaidTierDefinition> = {
  gameday: {
    tier: 'gameday',
    amountCents: 999,
    allowance: 5,
    envKey: 'STRIPE_GAMEDAY_PRICE_ID',
    label: 'Game Day',
  },
  org: {
    tier: 'org',
    amountCents: 7900,
    allowance: 50,
    envKey: 'STRIPE_ORG_PRICE_ID',
    label: 'Organization',
  },
};

export const paidTierFromRequest = (value: unknown): PaidTier | null =>
  value === 'gameday' || value === 'org' ? value : null;

export const configuredPriceForTier = (
  tier: PaidTier,
  env: PriceEnvironment,
) => {
  const definition = PAID_TIERS[tier];
  const priceId = String(env[definition.envKey] || '').trim();
  return priceId ? { ...definition, priceId } : null;
};

export const configuredTierForPrice = (
  priceId: string,
  env: PriceEnvironment,
) => (Object.keys(PAID_TIERS) as PaidTier[])
  .map((tier) => configuredPriceForTier(tier, env))
  .find((definition) => definition?.priceId === priceId) || null;

export const nextUpgradeTier = (
  currentTier: PricingTier | null | undefined,
): PaidTier | null => {
  if (currentTier === 'gameday') return 'org';
  if (currentTier === 'org') return null;
  return 'gameday';
};
