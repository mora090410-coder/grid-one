import React, { useMemo, useRef, useState } from 'react';
import type { BoardData, GameState } from '../../../../types';
import { salesCells, matchesSalesCell } from './salesBoardModel';
import { Base, CapsuleButton, Eyebrow, Glass } from '../../../design/primitives';
import type { GuestConnection, GuestHold } from '../../guest/guestInviteTypes';

export interface SalesBoardViewerProps {
  game: GameState;
  board: BoardData;
  updatedAt?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: string | null;
  organizerHref?: string;
  guestOccupancy?: { holds: GuestHold[]; claimedCells: number[] } | null;
  guestConnection?: GuestConnection;
}

/** A public selling record. Cell numbers identify positions; they are not game digits. */
export default function SalesBoardViewer({ game, board, updatedAt, onRefresh, refreshing = false, error, organizerHref, guestOccupancy, guestConnection }: SalesBoardViewerProps) {
  const [joining, setJoining] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('');
  const [blankOnly, setBlankOnly] = useState(false);
  const [focused, setFocused] = useState(0);
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const cells = useMemo(() => salesCells(board), [board]);
  const families = [...new Set(cells.map(cell => cell.family).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const visibleFamily = families.includes(family) ? family : '';
  const search = query.trim();
  const filtered = Boolean(visibleFamily || blankOnly || availableOnly || search);
  const held = new Set(guestOccupancy?.holds.map(hold => hold.index) ?? []);
  const claimed = new Set(guestOccupancy?.claimedCells ?? []);
  const guestState = (index: number) => held.has(index) ? 'temporarily held' : claimed.has(index) ? 'claimed through a guest link' : null;
  const matches = (cell: typeof cells[number]) => (!availableOnly || !held.has(cell.index))
    && matchesSalesCell(cell, { family: visibleFamily, blankOnly, availableOnly, query: search });
  const details = cells.filter(matches);
  const named = cells.filter(cell => !cell.blank).length;
  const selected = cells[focused];
  const timestamp = updatedAt ? new Date(updatedAt) : null;
  const updatedLabel = timestamp && !Number.isNaN(timestamp.getTime()) ? `Last updated ${timestamp.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Update time unavailable';

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    const row = Math.floor(index / 10);
    let next = index;
    switch (event.key) {
      case 'ArrowRight': next = Math.min(row * 10 + 9, index + 1); break;
      case 'ArrowLeft': next = Math.max(row * 10, index - 1); break;
      case 'ArrowDown': next = Math.min(99, index + 10); break;
      case 'ArrowUp': next = Math.max(0, index - 10); break;
      case 'Home': next = event.ctrlKey ? 0 : row * 10; break;
      case 'End': next = event.ctrlKey ? 99 : row * 10 + 9; break;
      default: return;
    }
    event.preventDefault();
    setFocused(next);
    refs.current[next]?.focus();
  };

  return (
    <Base kind="dark">
      <main aria-label={`${game.title || 'GridOne board'} selling board`} className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Eyebrow>Selling squares</Eyebrow>
            {organizerHref && <a href={organizerHref} className="inline-flex min-h-11 items-center rounded-control px-3 font-ui text-sm text-fg underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">Manage board</a>}
          </div>
          <h1 className="font-display text-[40px] leading-none text-fg md:text-[56px]">{game.title || 'GridOne board'}</h1>
          <p className="font-ui text-base text-fg-2">{game.leftName || game.leftAbbr} at {game.topName || game.topAbbr}{game.dates ? ` · ${game.dates}` : ''}</p>
          {board.participation?.purpose && <p className="max-w-2xl whitespace-pre-wrap break-words font-ui text-lg text-fg">{board.participation.purpose}</p>}
          {board.participation?.squarePrice && <p className="font-ui text-lg text-fg">{board.participation.squarePrice} per square</p>}
          <div className="flex flex-col gap-1">
            <p className="font-ui text-lg text-fg">Numbers will be drawn before the game.</p>
          </div>
        <div>
            <CapsuleButton aria-expanded={joining} aria-controls="joining-instructions" onClick={() => setJoining(value => !value)}>How to join</CapsuleButton>
            {joining && <div id="joining-instructions" className="mt-3 max-w-2xl whitespace-pre-wrap break-words rounded-control border border-hairline bg-panel p-4 font-ui text-base text-fg">{board.participation?.instructions || 'Want a square? Text the person who sent you this link with the numbers you want. They’ll add your name.'}</div>}
          </div>
          <p className="font-ui text-sm text-fg-2">A square is yours once they add your name. You pay them directly, not through GridOne.</p>
        </header>

        <Glass padding="lg" className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2"><span className="whitespace-nowrap font-display text-[40px] leading-none text-fg">{named}<span className="text-fg-3"> / 100</span></span><span className="font-ui text-sm text-fg-2">Squares with names</span><span className="font-ui text-sm text-fg-2">{100 - named} blank squares</span></div>
          <div className="flex flex-wrap items-center gap-3">
            <p role="status" className="font-mono text-xs text-fg-2">{updatedLabel}</p>
            {guestConnection && <p role="status" className="font-mono text-xs text-fg-2">{guestConnection === 'live' ? 'Guest availability live' : guestConnection === 'offline' ? 'Guest availability offline' : 'Guest availability reconnecting…'}</p>}
            {onRefresh && <CapsuleButton variant="quiet" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh board'}</CapsuleButton>}
          </div>
        </Glass>
        {error && <p role="alert" className="font-ui text-sm text-fg">{error}</p>}

        <section aria-label="Find squares" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex w-full min-w-0 flex-col gap-2 font-ui text-sm text-fg md:w-auto md:flex-1">
              Find a name or square number
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or square 1–100" className="min-h-11 w-full rounded-control border border-hairline bg-panel px-3 text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action" />
            </label>
            {families.length > 0 && <label className="flex w-full min-w-0 flex-col gap-2 font-ui text-sm text-fg md:w-auto md:flex-1 md:max-w-xs">
              Family
              <select aria-label="Family" value={visibleFamily} onChange={event => setFamily(event.target.value)} className="min-h-11 w-full rounded-control border border-hairline bg-panel px-3 text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">
                <option value="">All families</option>
                {families.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>}
            <CapsuleButton variant="quiet" aria-pressed={blankOnly} onClick={() => setBlankOnly(value => !value)}>Highlight blank squares</CapsuleButton>
            {cells.some(cell => cell.availability !== 'unspecified') && <CapsuleButton variant="quiet" aria-pressed={availableOnly} onClick={() => setAvailableOnly(value => !value)}>Show available squares</CapsuleButton>}
            {filtered && <CapsuleButton variant="quiet" onClick={() => { setQuery(''); setFamily(''); setBlankOnly(false); setAvailableOnly(false); }}>Clear filters</CapsuleButton>}
          </div>
          <p role="status" className="font-ui text-sm text-fg-2">{details.length} {details.length === 1 ? 'square' : 'squares'}{visibleFamily ? ` for ${visibleFamily}` : ''}{blankOnly ? ' · blank' : ''}{availableOnly ? ' · marked available' : ''}. The full board stays visible.</p>
        </section>

        <div className="flex min-w-0 flex-col gap-6">
        <section aria-label="Square details" className="order-1 flex flex-col gap-3 md:order-2">
          <p role="status" aria-label="Selected square" className="min-h-11 rounded-control bg-panel p-3 font-ui text-sm text-fg">Square {selected.number} · {selected.buyer} · {selected.family || 'No family assigned'}{held.has(selected.index) ? ' · Guest selecting · temporarily held' : ''}</p>
          <details open={filtered || undefined}>
            <summary className="flex min-h-11 cursor-pointer items-center rounded-control font-ui text-base text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">Square details · {details.length} {details.length === 1 ? 'square' : 'squares'} <span aria-hidden="true" className="ml-2">↓</span></summary>
            <p className="pb-3 font-ui text-sm text-fg-2">Full names and responsibility for every matching square.</p>
            {details.length === 0 ? <p className="font-ui text-sm text-fg-2">No squares match these filters.</p> : <ul className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 md:max-h-none lg:grid-cols-3">{details.map(cell => <li key={cell.number} className="flex min-w-0 flex-col gap-1 rounded-control border border-hairline bg-panel p-3">
              <span className="font-mono text-xs text-fg-3">Square {cell.number}</span>
              <span className="break-words font-ui text-base text-fg">{cell.buyer}</span>
              <span className="break-words font-ui text-sm text-fg-2">{cell.family ? `Responsible: ${cell.family}` : 'No family assigned'}</span>
              {cell.availability !== 'unspecified' && <span className="font-ui text-sm text-fg-2">{held.has(cell.index) ? 'Guest selecting · temporarily held' : cell.availability === 'available' ? 'Available' : 'Not available'}</span>}
            </li>)}</ul>}
          </details>
        </section>

        <section aria-label="Board" className="order-2 flex min-w-0 flex-col gap-3 md:order-1">
          <div className="flex flex-col gap-1"><h2 className="font-display text-[28px] text-fg">The board</h2><p id="sales-board-help" className="font-ui text-sm text-fg-2">1–100 identifies each square. Tap a square for full details. Use arrow keys to move through the board.</p></div>
          <p className="font-ui text-sm text-fg-2 md:hidden">✓ Has a name · ◷ Guest selecting · No mark means blank</p>
          <div className="w-full rounded-control border border-hairline">
            <div role="grid" aria-label="Selling squares board, 100 squares" aria-describedby="sales-board-help" aria-rowcount={10} aria-colcount={10} className="w-full">
              {Array.from({ length: 10 }, (_, row) => <div role="row" key={row} className="grid grid-cols-10">
              {cells.slice(row * 10, row * 10 + 10).map(cell => <div
                  key={cell.index}
                  role="gridcell"
                  aria-label={`Square ${cell.number}, ${cell.buyer}, ${cell.family || 'No family assigned'}${guestState(cell.index) ? `, ${guestState(cell.index)}` : ''}`}
                  tabIndex={focused === cell.index ? 0 : -1}
                  ref={element => { refs.current[cell.index] = element; }}
                  onFocus={() => setFocused(cell.index)}
                  onClick={() => { setFocused(cell.index); refs.current[cell.index]?.focus(); }}
                  onKeyDown={event => moveFocus(event, cell.index)}
                  className={`relative flex aspect-square min-w-0 cursor-pointer flex-col items-center justify-center gap-1 border-b border-r border-hairline p-0.5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gold md:aspect-auto md:min-h-28 md:items-stretch md:justify-start md:p-2 ${held.has(cell.index) ? 'bg-panel-hover ring-1 ring-inset ring-gold' : claimed.has(cell.index) ? 'bg-panel-hover' : matches(cell) && filtered ? 'bg-panel-hover ring-1 ring-inset ring-gold' : 'bg-panel'} ${!matches(cell) ? 'text-fg-3' : 'text-fg'}`}
                >
                  <span className="font-mono text-xs md:text-fg-3">{cell.number}</span>
                  {!cell.blank && <span aria-hidden="true" className="absolute right-0.5 top-0 font-ui text-[9px] md:hidden">✓</span>}
                  {held.has(cell.index) && <span aria-hidden="true" className="absolute bottom-0.5 right-0.5 font-ui text-[9px] md:hidden">◷</span>}
                  <span className="hidden truncate font-ui text-sm md:block">{cell.buyer}</span>
                  <span className="hidden truncate font-ui text-[11px] text-fg-2 md:block">{cell.family || 'Unassigned'}</span>
                  {guestState(cell.index) && <span className="hidden truncate font-ui text-[11px] text-fg-2 md:block">{guestState(cell.index) === 'temporarily held' ? 'Guest selecting' : 'Guest claimed'}</span>}
                </div>)}
              </div>)}
            </div>
          </div>
        </section>
        </div>
      </main>
    </Base>
  );
}
