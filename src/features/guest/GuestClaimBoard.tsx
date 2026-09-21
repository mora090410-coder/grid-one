import React, { useMemo, useRef, useState } from 'react';
import type { GuestSnapshot } from './guestInviteTypes';
import { guestCellState } from './guestInviteModel';

type Props = {
  snapshot: GuestSnapshot;
  sellerLabel?: string;
  selected: readonly number[];
  ownedIndices?: readonly number[];
  managing?: boolean;
  pendingIndex: number | null;
  disabled?: boolean;
  onToggle: (index: number) => void;
};

const LABEL: Record<ReturnType<typeof guestCellState>, string> = {
  'out-of-scope': 'not offered by this guest pass',
  available: 'available',
  'held-by-you': 'held for you',
  held: 'temporarily held',
  claimed: 'claimed',
};

export default function GuestClaimBoard({ snapshot, sellerLabel = 'this seller', selected, ownedIndices = [], managing = false, pendingIndex, disabled = false, onToggle }: Props) {
  const firstSelectable = snapshot.invite?.cells.find(index => guestCellState(snapshot, index) === 'available') ?? 0;
  const [focused, setFocused] = useState(firstSelectable);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const move = (event: React.KeyboardEvent, index: number) => {
    const row = Math.floor(index / 10); let next = index;
    if (event.key === 'ArrowRight') next = Math.min(row * 10 + 9, index + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(row * 10, index - 1);
    else if (event.key === 'ArrowDown') next = Math.min(99, index + 10);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 10);
    else if (event.key === 'Home') next = event.ctrlKey ? 0 : row * 10;
    else if (event.key === 'End') next = event.ctrlKey ? 99 : row * 10 + 9;
    else return;
    event.preventDefault(); setFocused(next); refs.current[next]?.focus();
  };
  return <section aria-labelledby="guest-board-title" className="flex flex-col gap-3">
    <div><h2 id="guest-board-title" className="font-display text-[28px] text-fg">The board</h2><p className="font-ui text-sm text-fg-2">All 100 squares are shown. Only {sellerLabel}’s offered squares can be selected.</p></div>
    <p className="font-ui text-xs text-fg-3 md:hidden">Swipe horizontally to see all 10 columns.</p>
    <div className="overflow-x-auto rounded-control border border-hairline">
      <div role="grid" aria-label="Guest claim board, 100 squares" aria-rowcount={10} aria-colcount={10} className="min-w-[620px]">
        {Array.from({ length: 10 }, (_, row) => <div role="row" className="grid grid-cols-10" key={row}>
          {Array.from({ length: 10 }, (_, col) => {
            const index = row * 10 + col; const state = guestCellState(snapshot, index);
            const selectable = !disabled && (state === 'available' || state === 'held-by-you' || (managing && ownedIndices.includes(index)));
            const name = snapshot.squares[index]?.join(', ') || snapshot.allocationLabels[index] || 'Blank';
            const occupiedName = state === 'claimed' ? snapshot.squares[index]?.join(', ') : '';
            const pressed = selectedSet.has(index);
            return <button
              key={index} type="button" role="gridcell" ref={node => { refs.current[index] = node; }}
              aria-label={`Square ${index + 1}, ${managing && ownedIndices.includes(index) ? 'your claimed square' : LABEL[state]}${name !== 'Blank' ? `, ${name}` : ''}`}
              aria-selected={selectable ? pressed : undefined} aria-disabled={!selectable || pendingIndex !== null ? 'true' : undefined} aria-busy={pendingIndex === index ? 'true' : undefined}
              tabIndex={focused === index ? 0 : -1}
              onFocus={() => setFocused(index)} onKeyDown={event => move(event, index)} onClick={() => { if (selectable && pendingIndex === null) onToggle(index); }}
              className={`relative flex aspect-square min-h-11 flex-col items-center justify-center border-b border-r border-hairline p-1 font-ui text-xs focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action ${pressed ? 'bg-gold text-ink' : state === 'available' ? 'bg-panel-hover text-fg' : 'bg-panel text-fg-3'}`}
            >
              <span className="font-mono">{index + 1}</span>
              <span title={occupiedName || undefined} className="w-full truncate px-0.5 text-[9px] sm:text-[10px]">{occupiedName || (state === 'held-by-you' ? 'Yours' : state === 'held' ? 'Held' : state === 'claimed' ? 'Claimed' : state === 'available' ? 'Open' : 'View')}</span>
            </button>;
          })}
        </div>)}
      </div>
    </div>
  </section>;
}
