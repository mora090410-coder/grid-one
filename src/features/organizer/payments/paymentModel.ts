import type { BoardData, EntryMeta } from '../../../../types';

export type PaymentStatus = EntryMeta['paid_status'];
export interface PaymentSquare { index: number; names: string[]; status: PaymentStatus }
export interface PaymentGroup {
  id: string;
  label: string;
  squares: PaymentSquare[];
  paid: number;
  unpaid: number;
  unknown: number;
}

/** Responsibility is explicit; legacy names are exact joint identities, never inferred owners. */
export function buildPaymentModel(board: BoardData, metas: Record<number, EntryMeta>) {
  const groups = new Map<string, PaymentGroup>();
  const totals = { assigned: 0, paid: 0, unpaid: 0, unknown: 0 };
  for (let index = 0; index < Math.max(board.squares.length, board.allocationLabels?.length ?? 0); index++) {
    const names = (board.squares[index] ?? []).map(name => name.trim()).filter(Boolean);
    const allocation = board.allocationLabels?.[index]?.trim();
    if (!allocation && !names.length) continue;
    const id = allocation ? `allocation:${JSON.stringify(allocation)}` : `names:${JSON.stringify(names)}`;
    const label = allocation || names.join(' & ');
    const status = metas[index]?.paid_status ?? 'unknown';
    const group = groups.get(id) ?? { id, label, squares: [], paid: 0, unpaid: 0, unknown: 0 };
    group.squares.push({ index, names, status });
    group[status]++;
    totals[status]++;
    totals.assigned++;
    groups.set(id, group);
  }
  return { totals, groups: [...groups.values()] };
}

export type PaymentFilter = 'all' | PaymentStatus;
export function filterPaymentGroups(model: ReturnType<typeof buildPaymentModel>, query: string, filter: PaymentFilter) {
  const needle = query.trim().toLocaleLowerCase();
  return model.groups.map(group => ({ ...group, squares: group.squares.filter(square =>
    (filter === 'all' || square.status === filter) && (!needle ||
      group.label.toLocaleLowerCase().includes(needle) ||
      square.names.some(name => name.toLocaleLowerCase().includes(needle)) ||
      String(square.index + 1) === needle.replace(/^#/, ''))),
  })).filter(group => group.squares.length);
}

/** Person actions deliberately cover the complete responsibility group, not filtered rows. */
export function groupPaymentAction(group: PaymentGroup) {
  const indices = group.squares.filter(square => square.status !== 'paid').map(square => square.index);
  return {
    id: group.id,
    label: group.label,
    indices,
    buttonLabel: `Mark ${indices.length === group.squares.length ? 'all' : 'remaining'} ${indices.length} paid`,
    signature: JSON.stringify(group.squares.map(square => [square.index, square.status, square.names])),
  };
}
