import type { GuestSnapshot } from './guestInviteTypes';

export type GuestCellState = 'out-of-scope' | 'available' | 'held-by-you' | 'held' | 'claimed';

export function guestCellState(snapshot: GuestSnapshot, index: number): GuestCellState {
  if (snapshot.claimedCells.includes(index)) return 'claimed';
  const hold = snapshot.holds.find(item => item.index === index);
  if (hold) return hold.mine || snapshot.heldCells?.includes(index) ? 'held-by-you' : 'held';
  if (snapshot.invite?.cells.includes(index) && snapshot.availability[index] === 'available') return 'available';
  return 'out-of-scope';
}

export const normalizeClaimCode = (value: string) => value.trim().toLowerCase().split(/[\s-]+/).filter(Boolean).join('-');
export const validClaimCode = (value: string) => /^[a-z]{2,16}(?:-[a-z]{2,16}){3}$/.test(normalizeClaimCode(value));
export const validGuestName = (value: string) => value.trim().length >= 2 && value.trim().length <= 30;
