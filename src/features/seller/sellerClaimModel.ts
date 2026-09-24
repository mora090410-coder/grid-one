/** Pure rules for the public seller-link page. Components render; this decides. */
import { serializeViewerIdentitySelection } from '../viewer/identity/viewerIdentityModel';

export interface SellerCell { index: number; available: boolean }
export interface SellerView {
  title: string;
  label: string;
  shareCode: string;
  open: boolean;
  sideTeamName: string | null;
  topTeamName: string | null;
  gameStartsAt: string | null;
  squarePrice: string | null;
  instructions: string | null;
  cells: SellerCell[];
}

export const MAX_CLAIM = 10;

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length <= max ? value : null;

export const parseSellerView = (value: unknown): SellerView | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const title = text(raw.title, 200);
  const label = text(raw.label, 80);
  const shareCode = typeof raw.shareCode === 'string' && /^[A-Za-z0-9]{4,32}$/.test(raw.shareCode) ? raw.shareCode : null;
  if (!title || !label || !shareCode || typeof raw.open !== 'boolean' || !Array.isArray(raw.cells) || raw.cells.length > 100) return null;
  const cells: SellerCell[] = [];
  for (const cell of raw.cells) {
    const item = cell as Record<string, unknown> | null;
    if (!item || !Number.isInteger(item.index) || (item.index as number) < 0 || (item.index as number) > 99 || typeof item.available !== 'boolean') return null;
    cells.push({ index: item.index as number, available: item.available });
  }
  return {
    title, label, shareCode, open: raw.open, cells,
    sideTeamName: text(raw.sideTeamName, 120),
    topTeamName: text(raw.topTeamName, 120),
    gameStartsAt: text(raw.gameStartsAt, 64),
    squarePrice: text(raw.squarePrice, 40),
    instructions: text(raw.instructions, 500),
  };
};

export const toggleSquare = (selected: number[], index: number, max = MAX_CLAIM): number[] => {
  if (selected.includes(index)) return selected.filter((value) => value !== index);
  if (selected.length >= max) return selected;
  return [...selected, index];
};

/** Permanent square numbers are 1–100; indexes are 0–99. */
export const claimedSquaresText = (indexes: number[]): string => {
  const numbers = [...indexes].sort((a, b) => a - b).map((index) => index + 1);
  if (numbers.length === 1) return `Square ${numbers[0]}`;
  if (numbers.length === 2) return `Squares ${numbers[0]} and ${numbers[1]}`;
  return `Squares ${numbers.slice(0, -1).join(', ')}, and ${numbers[numbers.length - 1]}`;
};

export const cleanName = (value: string) => value.trim().replace(/\s+/g, ' ');

/**
 * Same key and shape the board viewer reads, so game day opens on "your
 * squares". The seller page knows only the name; the viewer resolves it to
 * a participant when the board lists one.
 */
export const rememberBuyer = (shareCode: string, displayName: string) => {
  try {
    localStorage.setItem(`gridone:find-squares:${shareCode.toUpperCase()}`, serializeViewerIdentitySelection({ participantId: null, displayName }));
  } catch {
    // Storage is a convenience; the claim already succeeded.
  }
};

export const gameLine = (view: Pick<SellerView, 'sideTeamName' | 'topTeamName' | 'gameStartsAt'>): string | null => {
  const teams = view.sideTeamName && view.topTeamName ? `${view.sideTeamName} vs ${view.topTeamName}` : null;
  const when = view.gameStartsAt && !Number.isNaN(new Date(view.gameStartsAt).getTime())
    ? new Date(view.gameStartsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : null;
  return [teams, when].filter(Boolean).join(' · ') || null;
};

/** "$20" x 2 -> "$40". Only for plain dollar amounts; anything else is left to the seller. */
export const amountOwed = (squarePrice: string | null, count: number): string | null => {
  const match = squarePrice?.trim().match(/^\$\s?(\d{1,5})(?:\.(\d{2}))?$/);
  if (!match || count < 1) return null;
  const cents = (Number(match[1]) * 100 + Number(match[2] ?? 0)) * count;
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
};
