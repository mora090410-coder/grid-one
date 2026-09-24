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

/** Free accounts publish one board per season. Paid allowances live in PAID_TIERS. */
export const FREE_BOARD_ALLOWANCE = 1;

const ALLOWANCE_ERROR = /PUBLISH_(ALLOWANCE_EXHAUSTED|ENTITLEMENT_INACTIVE):([^:]+):(\d+):(\d+)/i;

type AllowanceReason = 'ALLOWANCE_EXHAUSTED' | 'ENTITLEMENT_INACTIVE';

/** Customer copy keyed on (reason, tier). Counts come from the pricing constants. */
export const allowanceErrorMessage = (reason: AllowanceReason, tier: PricingTier) => {
  const { gameday, org } = PAID_TIERS;
  if (reason === 'ENTITLEMENT_INACTIVE') {
    const plan = tier === 'org' ? org.label : tier === 'gameday' ? gameday.label : null;
    return plan
      ? `Your ${plan} plan is no longer active. Choose the ${plan} plan to publish another board.`
      : `Your current plan is no longer active. Choose the ${gameday.label} plan to publish another board.`;
  }
  if (tier === 'free') return `Your free plan includes ${FREE_BOARD_ALLOWANCE} board per season. Choose the ${gameday.label} plan to publish another.`;
  if (tier === 'gameday') return `Your ${gameday.label} plan has published all ${gameday.allowance} boards for this season.`;
  if (tier === 'org') return `Your ${org.label} plan has published all ${org.allowance} boards for this season.`;
  return `Your current plan has no boards left this season. Choose the ${gameday.label} plan to publish another.`;
};

/**
 * Maps the database's PUBLISH_<reason>:<tier>:<used>:<allowance> error to the
 * one 402 response that publish and share both return. Null when it is not one.
 */
export const allowanceErrorResponse = (message: string): Response | null => {
  const match = message.match(ALLOWANCE_ERROR);
  if (!match) return null;
  const [, reasonValue, tierValue, usedValue, allowanceValue] = match;
  const reason = reasonValue.toUpperCase() as AllowanceReason;
  const tier = tierValue.toLowerCase() as PricingTier;
  const upgradeTo: PaidTier | null = reason === 'ENTITLEMENT_INACTIVE'
    ? tier === 'org' ? 'org' : 'gameday'
    : nextUpgradeTier(tier);
  return Response.json({
    code: `PUBLISH_${reason}`,
    error: allowanceErrorMessage(reason, tier),
    tier,
    used: Number(usedValue),
    allowance: Number(allowanceValue),
    upgradeTo,
  }, { status: 402 });
};
