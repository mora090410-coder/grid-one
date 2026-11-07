import type { BoardData } from '../../../../types';
import { sellerSquareUnsold } from '../../../../utils/sellerInventory';

/** Names describe the board record; availability must be explicitly recorded. */
export function salesCells(board: BoardData) {
  return Array.from({ length: 100 }, (_, index) => {
    const names = (board.squares[index] || []).map(name => name.trim()).filter(Boolean);
    return {
      index,
      number: index + 1,
      buyer: names.join(', ') || 'Blank',
      blank: names.length === 0,
      family: board.allocationLabels?.[index]?.trim() || '',
      availability: board.availability?.[index] || 'unspecified',
      buyerRecorded: Boolean(board.allocationLabels?.[index]) && !sellerSquareUnsold(board.squares[index], board.allocationLabels![index]!),
    };
  });
}

export function matchesSalesCell(
  cell: ReturnType<typeof salesCells>[number],
  filters: { family: string; blankOnly: boolean; availableOnly: boolean; query: string },
): boolean {
  if (filters.family && cell.family !== filters.family) return false;
  if (filters.blankOnly && !cell.blank) return false;
  if (filters.availableOnly && cell.availability !== 'available') return false;
  const query = filters.query.trim().toLocaleLowerCase();
  if (!query) return true;
  if (/^#?\d+$/.test(query)) return cell.number === Number(query.replace('#', ''));
  return cell.buyer.toLocaleLowerCase().includes(query) || cell.family.toLocaleLowerCase().includes(query);
}
