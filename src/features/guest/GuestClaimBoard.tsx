import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const offered = useMemo(() => Array.from(new Set(snapshot.invite?.cells || []))
    .filter(index => Number.isInteger(index) && index >= 0 && index < 100)
    .sort((left, right) => left - right), [snapshot.invite?.cells]);
  const initialFocus = offered.find(index => guestCellState(snapshot, index) === 'available') ?? offered[0] ?? -1;
  const [focused, setFocused] = useState(initialFocus);
  const refs = useRef(new Map<number, HTMLButtonElement>());
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    if (!offered.includes(focused)) setFocused(initialFocus);
  }, [focused, initialFocus, offered]);

  const move = (event: React.KeyboardEvent, index: number) => {
    const position = offered.indexOf(index);
    let nextPosition = position;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextPosition = Math.min(offered.length - 1, position + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextPosition = Math.max(0, position - 1);
    else if (event.key === 'Home') nextPosition = 0;
    else if (event.key === 'End') nextPosition = offered.length - 1;
    else return;
    event.preventDefault();
    const next = offered[nextPosition];
    if (next === undefined) return;
    setFocused(next);
    refs.current.get(next)?.focus();
  };

  return <section aria-labelledby="guest-board-title" className="flex flex-col gap-3">
    <div>
      <h2 id="guest-board-title" className="font-display text-[28px] text-fg">Offered squares</h2>
      <p className="font-ui text-sm text-fg-2">Only {sellerLabel}’s {offered.length} offered {offered.length === 1 ? 'square is' : 'squares are'} shown. Square numbers stay the same as the main board.</p>
    </div>
    {offered.length === 0 ? <p className="rounded-control border border-hairline bg-panel p-4 font-ui text-fg-2">This guest pass has no squares available to show.</p> :
      <ul aria-label={`${sellerLabel}'s offered squares`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {offered.map(index => {
          const state = guestCellState(snapshot, index);
          const owned = managing && ownedIndices.includes(index);
          const selectable = !disabled && (state === 'available' || state === 'held-by-you' || owned);
          const name = snapshot.squares[index]?.join(', ') || snapshot.allocationLabels[index] || 'Blank';
          const occupiedName = state === 'claimed' ? snapshot.squares[index]?.join(', ') : '';
          const pressed = selectedSet.has(index);
          return <li key={index} className="min-w-0">
            <button
              type="button"
              ref={node => { if (node) refs.current.set(index, node); else refs.current.delete(index); }}
              aria-label={`Square ${index + 1}, ${owned ? 'your claimed square' : LABEL[state]}${name !== 'Blank' ? `, ${name}` : ''}`}
              aria-pressed={selectable ? pressed : undefined}
              aria-disabled={!selectable || pendingIndex !== null ? 'true' : undefined}
              aria-busy={pendingIndex === index ? 'true' : undefined}
              tabIndex={focused === index ? 0 : -1}
              onFocus={() => setFocused(index)}
              onKeyDown={event => move(event, index)}
              onClick={() => { if (selectable && pendingIndex === null) onToggle(index); }}
              className={`flex min-h-20 w-full flex-col items-start justify-between gap-2 rounded-control border border-hairline p-3 text-left font-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action ${pressed ? 'bg-action text-action-text' : state === 'available' ? 'bg-panel-hover text-fg' : 'bg-panel text-fg-3'}`}
            >
              <span className="font-mono text-sm">Square {index + 1}</span>
              <span title={occupiedName || undefined} className="w-full truncate text-xs">{occupiedName || (state === 'held-by-you' ? 'Held for you' : state === 'held' ? 'Temporarily held' : state === 'claimed' ? 'Claimed' : state === 'available' ? 'Available' : 'Unavailable')}</span>
            </button>
          </li>;
        })}
      </ul>}
  </section>;
}
