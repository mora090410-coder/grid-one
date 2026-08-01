export const PAYOUT_DESCRIPTION_KEYS = ['Q1', 'HALF', 'Q3', 'FINAL', 'notes'] as const;

export type PayoutDescriptionKey = typeof PAYOUT_DESCRIPTION_KEYS[number];
export type PayoutDescriptions = Partial<Record<PayoutDescriptionKey, string>>;

const payoutDescriptionKeys = new Set<string>(PAYOUT_DESCRIPTION_KEYS);
const milestoneKeys = new Set<string>(['Q1', 'HALF', 'Q3', 'FINAL']);
const urlPattern = /https?:\/\//i;

export class PayoutDescriptionsValidationError extends Error {}

export const validatePayoutDescriptions = (input: unknown): PayoutDescriptions => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new PayoutDescriptionsValidationError('Payout descriptions must be an object.');
  }

  const normalized: PayoutDescriptions = {};
  for (const [key, rawValue] of Object.entries(input)) {
    if (!payoutDescriptionKeys.has(key)) {
      throw new PayoutDescriptionsValidationError(`Unknown payout description field: ${key}.`);
    }
    if (typeof rawValue !== 'string') {
      throw new PayoutDescriptionsValidationError('Payout descriptions must contain plain text only.');
    }

    const value = rawValue.trim();
    const limit = milestoneKeys.has(key) ? 120 : 280;
    if (value.length > limit) {
      throw new PayoutDescriptionsValidationError(
        key === 'notes'
          ? 'Payout notes must be 280 characters or fewer.'
          : `${key} payout description must be 120 characters or fewer.`,
      );
    }
    if (urlPattern.test(value)) {
      throw new PayoutDescriptionsValidationError('Payout descriptions cannot contain URLs.');
    }
    if (value) normalized[key as PayoutDescriptionKey] = value;
  }

  return normalized;
};
