export type TierId = 'free' | 'gameday' | 'org';

export interface Tier {
  id: TierId;
  name: string;
  price: string;
  priceNote: string;
  detail: string;
}

/** The live 2026 ladder. Change here, in Stripe, and nowhere else. */
export const PRICING: readonly Tier[] = [
  { id: 'free', name: 'Free', price: '$0', priceNote: 'per season', detail: '1 published board per account per season' },
  { id: 'gameday', name: 'Game Day', price: '$9.99', priceNote: 'once', detail: '$9.99 once for up to 5 published boards in the 2026 season' },
  { id: 'org', name: 'Organization', price: '$79', priceNote: 'per season', detail: '$79 per season for up to 50 published boards, organization naming, shared dashboard, and one organization receipt' },
];

export const PRICING_SENTENCE = 'Your first published board is free. Game Day is $9.99 once for up to 5 published boards in the 2026 season. Organization is $79 per season for up to 50 published boards.';

export const MONEY_BOUNDARY = 'GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.';
