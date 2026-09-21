/** Narrow wire contract. Cell indices are 0–99; displayed square numbers are 1–100. */
export type GuestPayment = { label: string; detail: string; url?: string };
export type GuestInvite = { id: string; label: string; cells: number[]; maxSquares: number; version: number; expiresAt: string | null; disabledAt: string | null };
export type GuestHold = { index: number; expiresAt: string; mine?: boolean };
export type GuestReceipt = { groupId: string; inviteId: string; displayName: string; cells: number[]; claimedAt: string | null; canManage: boolean; payment: GuestPayment | null; claimCode?: string };
export type GuestSnapshot = {
  boardId: string; title: string; shareCode: string; revision: number; serverTime: string;
  stage: 'selling' | 'finalized'; squares: string[][]; allocationLabels: (string | null)[];
  availability: string[]; holds: GuestHold[]; claimedCells: number[]; invite?: GuestInvite;
  mine?: GuestReceipt; heldCells?: number[];
};
export type OrganizerInvite = GuestInvite & { url: string; payment: GuestPayment | null; counts: { available: number; held: number; claimed: number } };
export type OrganizerHold = GuestHold & { inviteId: string };
export type OrganizerInvites = { revision: number; invites: OrganizerInvite[]; claims: GuestReceipt[]; holds: OrganizerHold[]; claimCode?: string };
export type GuestRequest = {
  action: 'read' | 'hold' | 'confirm' | 'receipt' | 'release' | 'swap';
  inviteToken?: string; guestToken?: string; claimCode?: string; cells?: number[]; name?: string;
};
export type OwnerInviteRequest = {
  action: 'create' | 'update' | 'disable' | 'regenerate' | 'cancel_holds' | 'release_claim' | 'rotate_code';
  revision: number; inviteId?: string; groupId?: string; label?: string; cells?: number[];
  maxSquares?: number; expiresAt?: string | null; payment?: GuestPayment | null; offerAcknowledged?: boolean;
};
export type GuestConnection = 'connecting' | 'live' | 'reconnecting' | 'offline';
export interface GuestTransport {
  snapshot(request: GuestRequest): Promise<GuestSnapshot>;
  manage(request: GuestRequest): Promise<GuestReceipt>;
}
