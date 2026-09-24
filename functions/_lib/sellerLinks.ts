import { anonClient } from './http';
import { familyAdmin, familyResponse, isRecord, readFamilyBody, type FamilyEnv } from './familyAccess';

// Seller links reuse the family helpers' bounded body reader, no-store
// responses, and server-only database client.
export type SellerEnv = FamilyEnv;
export const sellerResponse = familyResponse;
export const sellerAdmin = familyAdmin;
export const readSellerBody = readFamilyBody;
export const createAuthClient = (env: SellerEnv) => anonClient(env);

export const MAX_CLAIM_SQUARES = 10;
export const validSellerCode = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{16}$/.test(value);
export const validClaimCells = (cells: unknown): cells is number[] => Array.isArray(cells)
  && cells.length >= 1 && cells.length <= MAX_CLAIM_SQUARES
  && new Set(cells).size === cells.length
  && cells.every((index) => Number.isInteger(index) && index >= 0 && index < 100);
export const cleanBuyerName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name.length >= 1 && name.length <= 80 ? name : null;
};
export const sellerLinkUrl = (env: SellerEnv, request: Request, code: string) => {
  const origin = env.PUBLIC_SITE_URL ? new URL(env.PUBLIC_SITE_URL).origin : new URL(request.url).origin;
  return `${origin}/s/${code}`;
};

export const sellerFailure = (error: unknown) => {
  const message = isRecord(error) && typeof error.message === 'string' ? error.message : '';
  if (message.includes('seller_square_taken')) return sellerResponse({ error: 'Someone just grabbed one of those squares. Pick another.', code: 'SQUARE_TAKEN' }, 409);
  if (message.includes('seller_board_locked')) return sellerResponse({ error: 'The numbers are locked, so squares can’t be claimed anymore.', code: 'BOARD_LOCKED' }, 409);
  if (message.includes('seller_board_not_shared')) return sellerResponse({ error: 'Share your board first. Then seller links are ready.', code: 'NOT_SHARED' }, 409);
  if (message.includes('seller_access_denied')) return sellerResponse({ error: 'This seller link isn’t active. Ask the seller for a new one.' }, 404);
  if (message.includes('seller_invalid_request')) return sellerResponse({ error: 'Pick up to 10 squares and enter your name.' }, 400);
  return sellerResponse({ error: 'Seller links are temporarily unavailable. Please try again.' }, 503);
};
