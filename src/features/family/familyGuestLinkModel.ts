export type FamilyGuestLinkStatus = 'not_created' | 'active' | 'disabled' | 'expired' | 'locked' | 'not_shared' | 'scope_mismatch';

export interface FamilyGuestLinkRecord {
  boardId: string;
  title: string;
  label: string;
  cells: number[];
  revision: number;
  state: FamilyGuestLinkStatus;
  availableCount: number;
  maxSquares?: number;
  url?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES: FamilyGuestLinkStatus[] = ['not_created', 'active', 'disabled', 'expired', 'locked', 'not_shared', 'scope_mismatch'];

function publicHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.hash;
  } catch { return false; }
}

export function parseFamilyGuestLinkRecord(value: unknown): FamilyGuestLinkRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const cells = item.cells;
  if (typeof item.boardId !== 'string' || !UUID.test(item.boardId) || typeof item.title !== 'string' || !item.title.trim()
    || typeof item.label !== 'string' || !item.label.trim() || !Array.isArray(cells) || cells.length < 1 || cells.length > 100
    || new Set(cells).size !== cells.length || cells.some(cell => !Number.isInteger(cell) || Number(cell) < 0 || Number(cell) > 99)
    || !Number.isSafeInteger(item.revision) || Number(item.revision) < 1 || !STATES.includes(item.state as FamilyGuestLinkStatus)
    || !Number.isInteger(item.availableCount) || Number(item.availableCount) < 0 || Number(item.availableCount) > cells.length
    || (item.maxSquares !== undefined && (!Number.isInteger(item.maxSquares) || Number(item.maxSquares) < 1 || Number(item.maxSquares) > cells.length))
    || (item.url !== undefined && !publicHttpsUrl(item.url)) || (item.state === 'active' && !publicHttpsUrl(item.url))) return null;
  return item as unknown as FamilyGuestLinkRecord;
}

export function familyGuestShareMessage(record: FamilyGuestLinkRecord) {
  return `Help fill ${record.label}'s squares for ${record.title}. Choose from the squares marked available — no account needed: ${record.url}`;
}

export function unavailableStateMessage(state: Exclude<FamilyGuestLinkStatus, 'not_created' | 'active'>) {
  switch (state) {
    case 'disabled': return 'This public buyer link is disabled. Ask your organizer if sharing should resume.';
    case 'expired': return 'This public buyer link has expired. Ask your organizer for help.';
    case 'locked': return 'This board is locked. New buyer claims are no longer available.';
    case 'not_shared': return 'Your organizer must share the board before you can create a public buyer link.';
    case 'scope_mismatch': return 'Your assigned squares changed. Ask your organizer for a current private family link.';
  }
}
