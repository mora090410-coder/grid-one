import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BoardEditor from '../../src/features/organizer/workspace/BoardEditor';
import RangeAssignBar, { type RangeAssignInput } from '../../src/features/organizer/workspace/RangeAssignBar';
import type { Selection } from '../../src/features/organizer/workspace/selection';
import type { BoardData, GameState } from '../../types';

const game: GameState = { title: 'T', meta: '', leftAbbr: 'KC', leftName: 'Kansas City', topAbbr: 'PHI', topName: 'Philadelphia', dates: '', lockTitle: false, lockMeta: false };

const board = (filled: number[] = []): BoardData => ({
  topAxis: Array(10).fill(null),
  leftAxis: Array(10).fill(null),
  squares: Array.from({ length: 100 }, (_, index) => (filled.includes(index) ? ['Ann R.'] : [])),
});

interface HarnessProps {
  isPublished?: boolean;
  canAssignOpenSquares?: boolean;
  filled?: number[];
  onApply?: (input: RangeAssignInput) => void;
}

function Harness({ isPublished = false, canAssignOpenSquares, filled = [], onApply = () => {} }: HarnessProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [selection, setSelection] = useState<Selection>(() => new Set<number>());
  const toggleSelectMode = () => setSelectMode((current) => {
    if (current) setSelection(new Set<number>());
    return !current;
  });
  const namedCount = [...selection].filter((index) => filled.includes(index)).length;
  return (
    <>
      <BoardEditor
        board={board(filled)}
        entryMeta={{}}
        drawPreview={null}
        highlightOpen={false}
        isPublished={isPublished}
        canAssignOpenSquares={canAssignOpenSquares ?? isPublished}
        selectMode={selectMode}
        selection={selection}
        onSelectionChange={setSelection}
        onToggleSelectMode={toggleSelectMode}
        onSelectSquare={vi.fn()}
      />
      {selectMode && selection.size > 0 && (
        <RangeAssignBar
          count={selection.size}
          namedCount={namedCount}
          isPublished={isPublished}
          busy={false}
          onApply={onApply}
          onClear={() => setSelection(new Set<number>())}
          onExitSelectMode={toggleSelectMode}
        />
      )}
    </>
  );
}

function GridOnlyHarness() {
  const [selectMode, setSelectMode] = useState(false);
  const [selection, setSelection] = useState<Selection>(() => new Set<number>());
  return (
    <BoardEditor
      board={board()}
      entryMeta={{}}
      drawPreview={null}
      highlightOpen={false}
      isPublished={false}
      canAssignOpenSquares={false}
      selectMode={selectMode}
      selection={selection}
      onSelectionChange={setSelection}
      onToggleSelectMode={() => setSelectMode((current) => !current)}
      onSelectSquare={vi.fn()}
    />
  );
}

const cell = (n: number) => screen.getByRole('button', { name: `Square ${n}, unassigned` });
const enterSelectMode = () => fireEvent.click(screen.getByRole('button', { name: 'Select squares' }));
const pressedCells = () => screen
  .getAllByRole('button')
  .filter((el) => el.getAttribute('aria-pressed') === 'true' && /^Square /.test(el.getAttribute('aria-label') ?? ''));

describe('BoardEditor select mode', () => {
  it('toggles a square on and off and marks it pressed', () => {
    render(<Harness />);
    enterSelectMode();
    fireEvent.click(cell(1));
    expect(cell(1)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    fireEvent.click(cell(1));
    expect(cell(1)).toHaveAttribute('aria-pressed', 'false');
  });

  it('shift-click adds the rectangular block from the last toggled square', () => {
    render(<Harness />);
    enterSelectMode();
    fireEvent.click(cell(1));
    fireEvent.click(cell(12), { shiftKey: true });
    expect(pressedCells()).toHaveLength(4);
    expect(screen.getByText('4 selected')).toBeInTheDocument();
  });

  it('drag across a block adds every square the pointer enters', () => {
    render(<Harness />);
    enterSelectMode();
    fireEvent.pointerDown(cell(1), { buttons: 1 });
    fireEvent.pointerEnter(cell(2), { buttons: 1 });
    fireEvent.pointerEnter(cell(13), { buttons: 1 });
    fireEvent.pointerUp(window);
    expect(pressedCells()).toHaveLength(6);
  });

  it('Space toggles the focused square and Escape leaves select mode', () => {
    render(<Harness />);
    enterSelectMode();
    fireEvent.keyDown(cell(5), { key: ' ' });
    expect(cell(5)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(cell(5), { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Select squares' })).toHaveAttribute('aria-pressed', 'false');
    expect(cell(5)).not.toHaveAttribute('aria-pressed');
    expect(screen.queryByRole('group', { name: 'Assign selected squares' })).not.toBeInTheDocument();
  });

  it('drag across a block works on touch, where the cells never get pointerenter', () => {
    render(<Harness />);
    enterSelectMode();
    const from = cell(1);
    const to = cell(2);
    // jsdom has no layout, so the hit test is stubbed onto the document.
    const original = (document as any).elementFromPoint;
    (document as any).elementFromPoint = vi.fn(() => to);
    try {
      fireEvent.pointerDown(from, { pointerType: 'touch', pointerId: 7 });
      fireEvent.pointerMove(screen.getByTestId('board-grid'), { pointerType: 'touch', pointerId: 7, clientX: 60, clientY: 60 });
      fireEvent.pointerUp(window);
    } finally {
      (document as any).elementFromPoint = original;
    }
    expect(pressedCells()).toHaveLength(2);
    expect(cell(1)).toHaveAttribute('aria-pressed', 'true');
    expect(cell(2)).toHaveAttribute('aria-pressed', 'true');
  });

  it('a keyboard Space does not swallow the next mouse click', () => {
    render(<Harness />);
    enterSelectMode();
    fireEvent.keyDown(cell(2), { key: ' ' });
    fireEvent.click(cell(5));
    expect(cell(2)).toHaveAttribute('aria-pressed', 'true');
    expect(cell(5)).toHaveAttribute('aria-pressed', 'true');
  });

  it('deselecting the last square leaves focus on the cell, not the toolbar', () => {
    // The grid alone: the assign bar claims focus for itself while it is up,
    // and this is about what the grid does when the bar goes away.
    render(<GridOnlyHarness />);
    enterSelectMode();
    cell(3).focus();
    fireEvent.click(cell(3));
    fireEvent.click(cell(3));
    expect(cell(3)).toHaveAttribute('aria-pressed', 'false');
    expect(document.activeElement).toBe(cell(3));
  });

  it('published: a block reaching over a sold square picks up only the OPEN ones', () => {
    const onApply = vi.fn();
    render(<Harness isPublished filled={[11]} onApply={onApply} />);
    enterSelectMode();
    fireEvent.click(cell(1));
    fireEvent.click(cell(13), { shiftKey: true });
    expect(screen.getByRole('button', { name: 'Square 12, assigned to Ann R.' })).not.toHaveAttribute('aria-pressed', 'true');
    expect(pressedCells()).toHaveLength(5);
    fireEvent.change(screen.getByLabelText('Name for these squares'), { target: { value: 'Dana P.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply to 5' }));
    expect(onApply).toHaveBeenCalledWith({ name: 'Dana P.', seller: '', paid: 'unknown' });
  });

  it('published without late fill: select mode is not offered', () => {
    render(<Harness isPublished canAssignOpenSquares={false} />);
    expect(screen.getByRole('button', { name: 'Select squares' })).toBeDisabled();
  });

  it('published: sold squares cannot be selected', () => {
    render(<Harness isPublished filled={[0]} />);
    enterSelectMode();
    expect(screen.getByRole('button', { name: 'Square 1, assigned to Ann R.' })).toBeDisabled();
    fireEvent.click(cell(2));
    expect(cell(2)).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('RangeAssignBar', () => {
  it('keeps Apply disabled until a name is typed, then reports the name, seller, and payment state', () => {
    const onApply = vi.fn();
    render(<Harness onApply={onApply} />);
    enterSelectMode();
    fireEvent.click(cell(1));
    fireEvent.click(cell(2));

    const apply = screen.getByRole('button', { name: 'Apply to 2' });
    expect(apply).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name for these squares'), { target: { value: 'Ann R.' } });
    expect(apply).toBeEnabled();

    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledWith({ name: 'Ann R.', seller: '', paid: 'unknown' });
  });

  it('defaults payment to Not asked yet and records the chosen state', () => {
    const onApply = vi.fn();
    render(<Harness onApply={onApply} />);
    enterSelectMode();
    fireEvent.click(cell(1));
    expect(screen.getByRole('radio', { name: 'Not asked yet' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Paid' }));
    fireEvent.change(screen.getByLabelText('Name for these squares'), { target: { value: 'Bo T.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply to 1' }));
    expect(onApply).toHaveBeenCalledWith({ name: 'Bo T.', seller: '', paid: 'paid' });
  });

  it('published: no payment radios, and the OPEN-only rule is stated', () => {
    render(<Harness isPublished filled={[0]} />);
    enterSelectMode();
    fireEvent.click(cell(2));
    expect(screen.queryByRole('radiogroup', { name: 'Payment' })).not.toBeInTheDocument();
    expect(screen.getByText('Only OPEN squares can be selected. Sold squares and axis digits do not change.')).toBeInTheDocument();
  });

  it('warns how many selected squares already carry a name', () => {
    render(<Harness filled={[0]} />);
    enterSelectMode();
    fireEvent.click(screen.getByRole('button', { name: 'Square 1, assigned to Ann R.' }));
    fireEvent.click(cell(2));
    expect(screen.getByText('1 of these already have a name. Apply replaces them.')).toBeInTheDocument();
  });

  it('Escape inside the bar leaves select mode', () => {
    render(<Harness />);
    enterSelectMode();
    fireEvent.click(cell(1));
    fireEvent.keyDown(screen.getByLabelText('Name for these squares'), { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Assign selected squares' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select squares' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clears the selection and closes the bar', () => {
    render(<Harness />);
    enterSelectMode();
    fireEvent.click(cell(1));
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('group', { name: 'Assign selected squares' })).not.toBeInTheDocument();
    expect(cell(1)).toHaveAttribute('aria-pressed', 'false');
    // The bar the organizer was standing in is gone: focus goes back to the toggle.
    expect(screen.getByRole('button', { name: 'Done selecting' })).toHaveFocus();
  });
});

it('keeps oversized range buyer names from being applied', () => {
  const onApply = vi.fn();
  render(<RangeAssignBar count={2} isPublished={false} busy={false} onApply={onApply} onClear={vi.fn()} />);
  const name = screen.getByRole('textbox', {name: 'Name for these squares'});
  expect(name).toHaveAttribute('maxlength', '80');
  fireEvent.change(name, {target: {value: 'a'.repeat(81)}});
  expect(screen.getByRole('button', {name: 'Apply to 2'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name: 'Apply to 2'}));
  expect(onApply).not.toHaveBeenCalled();
});

it('keeps focus on the selected square and offers only name and payment', () => {
  render(<Harness />);
  enterSelectMode();
  const square = cell(1);
  square.focus();
  fireEvent.click(square);
  expect(square).toHaveFocus();
  expect(screen.queryByLabelText('Sold by (optional)')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Record buyer'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Name for these squares')).toBeInTheDocument();
});
