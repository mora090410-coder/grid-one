import React, { useEffect, useRef } from 'react';
import { Glass, CapsuleTag, CapsuleButton, DigitFlow } from '../../../design/primitives';
import type { BoardData, EntryMeta, GameState } from '../../../../types';
import { assignable, rangeBetween, toggle, type Selection } from './selection';

export interface BoardEditorProps {
  board: BoardData;
  game: GameState;
  entryMeta: Record<number, EntryMeta>;
  /** Digits animating into the axes for a draft draw preview. */
  drawPreview: { top: number[]; left: number[] } | null;
  highlightOpen: boolean;
  isPublished: boolean;
  /** Published only: when true, open squares stay selectable for late fill. */
  canAssignOpenSquares: boolean;
  /** True while the organizer is picking a block of squares to label at once. */
  selectMode: boolean;
  selection: Selection;
  onSelectionChange: (next: Selection) => void;
  onToggleSelectMode: () => void;
  onSelectSquare: (index: number) => void;
  /**
   * Bumped by the workspace after a range apply settles. Any change moves focus
   * back to the select-mode toggle so a failed apply does not strand focus.
   */
  focusToggleSignal?: number;
  availabilityMode?: boolean;
  onOfferAvailability?: () => void;
}

const AXIS_CELL = 'flex items-center justify-center min-h-11 h-11 bg-chyron text-gold font-mono text-[13px] rounded-cell';

/** Organizer board editor: 11x11 grid with square assignment and a draft draw preview. */
export default function BoardEditor({
  board,
  entryMeta,
  drawPreview,
  highlightOpen,
  isPublished,
  canAssignOpenSquares,
  selectMode,
  selection,
  onSelectionChange,
  onToggleSelectMode,
  onSelectSquare,
  focusToggleSignal = 0,
  availabilityMode = false,
  onOfferAvailability,
}: BoardEditorProps) {
  // The corner a shift-click or a drag measures its block from.
  const anchorRef = useRef<number | null>(null);
  const dragRef = useRef<{ anchor: number; base: Selection; moved: boolean } | null>(null);
  // Set when this grid is what emptied the selection, so deselecting the last
  // square leaves focus on the cell the organizer is standing on. Apply, Clear
  // selection, and Done selecting come from the bar and still hand focus back.
  const localChangeRef = useRef(false);
  // CapsuleButton does not forward a ref, so focus is taken through the row.
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const previousSelectionSize = useRef(selection.size);
  const firstFocusSignal = useRef(focusToggleSignal);

  const topDigits = drawPreview ? drawPreview.top : board.topAxis;
  const leftDigits = drawPreview ? drawPreview.left : board.leftAxis;

  useEffect(() => {
    if (!selectMode) {
      anchorRef.current = null;
      dragRef.current = null;
      return;
    }
    const end = () => { dragRef.current = null; };
    window.addEventListener('pointerup', end);
    return () => window.removeEventListener('pointerup', end);
  }, [selectMode]);

  const focusToggle = () => {
    toolbarRef.current?.querySelector('button')?.focus({ preventScroll: true });
  };

  // The bar unmounts when the selection empties. When that came from Apply,
  // Clear selection, or Done selecting the organizer was standing in the bar,
  // so focus goes back to the toggle; when they simply deselected their last
  // square, focus stays on the cell under their cursor.
  useEffect(() => {
    const previous = previousSelectionSize.current;
    const fromGrid = localChangeRef.current;
    localChangeRef.current = false;
    previousSelectionSize.current = selection.size;
    if (previous > 0 && selection.size === 0 && !fromGrid) focusToggle();
  }, [selection]);

  // A failed apply leaves the selection standing; the workspace bumps this so
  // focus still lands somewhere the organizer can act from.
  useEffect(() => {
    if (focusToggleSignal === firstFocusSignal.current) return;
    focusToggle();
  }, [focusToggleSignal]);

  const isCellDisabled = (isOpen: boolean) => {
    if (!isPublished) return false;
    // A sold square on a published board is the record families are reading:
    // it is never part of a range.
    if (!isOpen) return selectMode;
    return !canAssignOpenSquares;
  };

  /**
   * A published board only ever accepts OPEN squares, so a block or a drag that
   * reaches over a sold square picks up the open cells and leaves the sold one
   * alone rather than arming an apply the workspace will refuse.
   */
  const selectableOnly = (indices: readonly number[]) => (
    isPublished ? assignable(indices, board.squares, true).ok : [...indices]
  );

  const addAll = (base: Selection, indices: readonly number[]): Selection => {
    const next = new Set(base);
    for (const index of indices) next.add(index);
    return next;
  };

  const toggleCell = (index: number, extend: boolean) => {
    if (extend && anchorRef.current !== null) {
      localChangeRef.current = true;
      onSelectionChange(addAll(selection, selectableOnly(rangeBetween(anchorRef.current, index))));
      return;
    }
    if (!selectableOnly([index]).length) return;
    anchorRef.current = index;
    localChangeRef.current = true;
    onSelectionChange(toggle(selection, index));
  };

  const onCellClick = (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
    if (!selectMode) {
      onSelectSquare(index);
      return;
    }
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) return;
    toggleCell(index, event.shiftKey);
  };

  const onCellPointerDown = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (!selectMode) return;
    // Touch gives the cell implicit pointer capture, which would send every
    // later pointermove to that one cell and kill the drag.
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // No capture to release; the drag works either way.
    }
    dragRef.current = { anchor: index, base: selection, moved: false };
  };

  const extendDrag = (index: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.moved = true;
    anchorRef.current = index;
    localChangeRef.current = true;
    onSelectionChange(addAll(drag.base, selectableOnly(rangeBetween(drag.anchor, index))));
  };

  const onCellPointerEnter = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (!selectMode || !dragRef.current) return;
    if (event.pointerType === 'touch') return;
    if ((event.buttons & 1) === 0) {
      dragRef.current = null;
      return;
    }
    extendDrag(index);
  };

  // Touch never fires pointerenter on the cells the finger passes over, so the
  // grid hit-tests the point itself.
  const onGridPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!selectMode || !dragRef.current) return;
    if (event.pointerType !== 'touch' && (event.buttons & 1) === 0) {
      dragRef.current = null;
      return;
    }
    if (event.pointerType !== 'touch') return;
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const cell = under?.closest?.('[data-cell-index]');
    const raw = cell?.getAttribute('data-cell-index');
    if (raw === null || raw === undefined) return;
    extendDrag(Number(raw));
  };

  const onCellKeyDown = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!selectMode) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onToggleSelectMode();
      return;
    }
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      toggleCell(index, event.shiftKey);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {drawPreview && <CapsuleTag tone="gold">Draft draw</CapsuleTag>}
      <div ref={toolbarRef} className="flex flex-wrap items-center gap-2">
        <CapsuleButton
          variant="quiet"
          aria-pressed={selectMode}
          disabled={isPublished && !canAssignOpenSquares}
          onClick={onToggleSelectMode}
        >
          {selectMode ? 'Done selecting' : 'Select squares'}
        </CapsuleButton>
        {!selectMode && !isPublished && onOfferAvailability && <CapsuleButton variant="ghost" onClick={onOfferAvailability}>Offer squares as available</CapsuleButton>}
        {selectMode && availabilityMode && selection.size > 0 && <CapsuleButton variant="quiet" onClick={() => document.getElementById('availability-editor')?.focus()}>Review {selection.size} selected {selection.size === 1 ? 'square' : 'squares'}</CapsuleButton>}
        {selectMode && !availabilityMode && selection.size > 0 && <CapsuleButton variant="quiet" onClick={() => document.getElementById('allocation-editor')?.querySelector('input')?.focus()}>Name {selection.size} selected squares</CapsuleButton>}
      </div>
      {availabilityMode && <p className="font-ui text-base text-fg-2">Select the squares you want to offer, then choose their availability.</p>}
      <div data-testid="contained-board-overflow" className="w-full min-w-0 max-w-full overflow-auto overscroll-contain rounded-card border border-hairline" style={{ contain: 'inline-size' }}>
        <div className="min-w-[640px]">
          <Glass padding="md">
            <div
              data-testid="board-grid"
              className="grid gap-1"
              style={{ gridTemplateColumns: 'repeat(11, minmax(44px, 1fr))' }}
              onPointerMove={onGridPointerMove}
            >
              <div className={AXIS_CELL} aria-hidden="true" />
              {topDigits.map((digit, colIndex) => (
                <div key={`top-${colIndex}`} className={AXIS_CELL}>
                  <DigitFlow value={digit === null || digit === undefined ? '·' : digit} />
                </div>
              ))}
              {Array.from({ length: 10 }, (_, rowIndex) => (
                <React.Fragment key={`row-${rowIndex}`}>
                  <div className={AXIS_CELL}>
                    <DigitFlow value={leftDigits[rowIndex] === null || leftDigits[rowIndex] === undefined ? '·' : leftDigits[rowIndex]} />
                  </div>
                  {Array.from({ length: 10 }, (_, colIndex) => {
                    const index = rowIndex * 10 + colIndex;
                    const names = board.squares[index] ?? [];
                    const isOpen = names.length === 0;
                    const name = names[0];
                    const paid = entryMeta[index]?.paid_status === 'paid';
                    const disabled = isCellDisabled(isOpen);
                    const selected = selectMode && selection.has(index);
                    const family = board.allocationLabels?.[index];
                    const baseLabel = isOpen ? `Square ${index + 1}, unassigned` : `Square ${index + 1}, assigned to ${name}`;
                    const label = family ? `${baseLabel}, allocated to ${family}${isOpen ? ', blank' : ''}` : baseLabel;
                    const openClasses = 'bg-transparent border border-dashed border-hairline text-fg-3';
                    const assignedClasses = 'bg-panel text-fg';
                    const highlightClasses = highlightOpen && isOpen ? 'ring-2 ring-tone-cardinal' : '';
                    // The offset ring reads as "picked by me", distinct from the
                    // flush highlight-open ring on the same colour.
                    const selectedClasses = selected ? 'ring-2 ring-tone-cardinal ring-offset-2 ring-offset-ground bg-tone-cardinal/10' : '';
                    return (
                      <button
                        key={index}
                        type="button"
                        data-cell-index={index}
                        aria-label={label}
                        aria-pressed={selectMode ? selection.has(index) : undefined}
                        disabled={disabled}
                        onClick={(event) => onCellClick(index, event)}
                        onPointerDown={(event) => onCellPointerDown(index, event)}
                        onPointerEnter={(event) => onCellPointerEnter(index, event)}
                        onKeyDown={(event) => onCellKeyDown(index, event)}
                        className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-cell px-1 py-1 font-ui text-[12px] transition-[background-color] duration-[var(--g-dur-state)] ease-[var(--g-ease-state)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action ${selectMode ? 'touch-pan-x' : ''} ${isOpen ? openClasses : assignedClasses} ${highlightClasses} ${selectedClasses}`.trim()}
                      >
                        <span className="font-mono text-[10px] text-fg-3">#{index + 1}</span>
                        {family && family !== name && <span className="line-clamp-2 text-center text-[10px] text-fg-2">{family}</span>}
                        {isOpen && <span className="text-[10px]">Blank</span>}
                        {!isOpen && <span className="line-clamp-2 text-center leading-tight">{name}</span>}
                        {paid && <span className="font-mono text-[10px] text-fg-2">paid</span>}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </Glass>
        </div>
      </div>
    </div>
  );
}
