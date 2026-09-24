import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BoardEditor from '../../src/features/organizer/workspace/BoardEditor';
import SquareSheet from '../../src/features/organizer/workspace/SquareSheet';
import type { BoardData, GameState } from '../../types';

const game: GameState = { title: 'T', meta: '', leftAbbr: 'KC', leftName: 'Kansas City', topAbbr: 'PHI', topName: 'Philadelphia', dates: '', lockTitle: false, lockMeta: false };
const board: BoardData = { topAxis: Array(10).fill(null), leftAxis: Array(10).fill(null), squares: Array.from({ length: 100 }, (_, i) => (i === 0 ? ['Ann'] : [])) };

describe('BoardEditor', () => {
  it('names cells accessibly and opens the selected square', () => {
    const onSelectSquare = vi.fn();
    render(<BoardEditor board={{...board, allocationLabels:Array.from({length:100},(_,i)=>i===1?'Mora':null)}} entryMeta={{ 0: { cell_index: 0, paid_status: 'paid', notify_opt_in: false, contact_type: null, contact_value: null } }} drawPreview={null} highlightOpen={false} isPublished={false} canAssignOpenSquares={false} selectMode={false} selection={new Set<number>()} onSelectionChange={vi.fn()} onToggleSelectMode={vi.fn()} onSelectSquare={onSelectSquare} />);
    fireEvent.click(screen.getByRole('button', { name: 'Square 1, assigned to Ann' }));
    expect(onSelectSquare).toHaveBeenCalledWith(0);
    expect(screen.getByRole('button', { name: 'Square 2, unassigned, allocated to Mora, blank' })).toHaveTextContent('Blank');
    expect(screen.getByText('paid')).toBeInTheDocument();
  });
  it('shows draw preview digits in the axes with the draft tag', () => {
    render(<BoardEditor board={board} entryMeta={{}} drawPreview={{ top: [3,1,4,1,5,9,2,6,5,3], left: [0,1,2,3,4,5,6,7,8,9] }} highlightOpen={false} isPublished={false} canAssignOpenSquares={false} selectMode={false} selection={new Set<number>()} onSelectionChange={vi.fn()} onToggleSelectMode={vi.fn()} onSelectSquare={vi.fn()} />);
    expect(screen.getByText('Draft draw')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });
  it('published: only open cells are selectable when late fill is allowed', () => {
    const onSelectSquare = vi.fn();
    render(<BoardEditor board={board} entryMeta={{}} drawPreview={null} highlightOpen={false} isPublished canAssignOpenSquares selectMode={false} selection={new Set<number>()} onSelectionChange={vi.fn()} onToggleSelectMode={vi.fn()} onSelectSquare={onSelectSquare} />);
    expect(screen.getByRole('button', { name: 'Square 1, assigned to Ann' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Square 2, unassigned' }));
    expect(onSelectSquare).toHaveBeenCalledWith(1);
  });

});

describe('SquareSheet', () => {
  it('saves a name and payment without seller entry and advances on Enter', () => {
    const onSave = vi.fn();
    render(<SquareSheet open index={4} name="" isPublished={false} hasNextOpen onSave={onSave} onClose={vi.fn()} />);
    const name = screen.getByRole('textbox', { name: 'Name on the board' });
    fireEvent.change(name, { target: { value: 'Dana P.' } });
    expect(screen.queryByRole('textbox', { name: /Sold by/ })).toBeNull();
    expect(screen.queryByRole('textbox', { name: /Assigned family/ })).toBeNull();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Payment' })).getByRole('radio', { name: 'Paid' }));
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith(4, 'Dana P.', expect.objectContaining({ cell_index: 4, paid_status: 'paid', seller_label: null }), true);
  });
  it('explains renames on a published board', () => {
    render(<SquareSheet open index={0} name="Ann" isPublished hasNextOpen={false} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/recorded in the board history/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save and next' })).toBeNull();
  });
  it('sizes the payment radios to a 44px touch target', () => {
    render(<SquareSheet open index={0} name="Ann" isPublished={false} hasNextOpen={false} onSave={vi.fn()} onClose={vi.fn()} />);
    const radios = within(screen.getByRole('radiogroup', { name: 'Payment' })).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    radios.forEach((radio) => {
      expect(radio.className).toContain('min-h-11');
    });
  });
  it('moves the payment selection with the arrow keys', () => {
    render(<SquareSheet open index={0} name="Ann" isPublished={false} hasNextOpen={false} onSave={vi.fn()} onClose={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Payment' });
    const unpaid = within(group).getByRole('radio', { name: 'Unpaid' });
    const paid = within(group).getByRole('radio', { name: 'Paid' });
    unpaid.focus();
    fireEvent.keyDown(unpaid, { key: 'ArrowRight' });
    expect(paid).toHaveAttribute('aria-checked', 'true');
    expect(paid).toHaveFocus();
  });
});

it('retains responsibility and private metadata when changing a display name', () => {
  const onSave = vi.fn();
  render(<SquareSheet open index={11} name="Mora family" allocationLabel="Mora family" meta={{cell_index: 11, paid_status: 'unknown', notify_opt_in: true, contact_type: 'email', contact_value: 'test@example.com', seller_label: 'Private seller'}} isPublished={false} hasNextOpen={false} onSave={onSave} onClose={vi.fn()} />);
  expect(screen.getByText('Mora family')).toBeInTheDocument();
  expect(screen.getByText(/Responsible person or family/)).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: /Assigned family/ })).toBeNull();
  expect(screen.queryByRole('textbox', { name: /Sold by/ })).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: 'Name on the board' }), {target: {value: 'John B'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));
  expect(onSave).toHaveBeenCalledWith(11, 'John B', expect.objectContaining({seller_label: 'Private seller', notify_opt_in: true, contact_type: 'email', contact_value: 'test@example.com'}), false, 'Mora family');
});

it('assigns initial responsibility from the name when the square has no allocation', () => {
  const onSave = vi.fn();
  render(<SquareSheet open index={11} name="" allocationLabel={null} isPublished={false} hasNextOpen={false} onSave={onSave} onClose={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Name on the board' }), {target: {value: '  Mora family  '}});
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));
  expect(onSave).toHaveBeenCalledWith(11, '  Mora family  ', expect.any(Object), false, 'Mora family');
});

it('preserves a published allocation when correcting its displayed name', () => {
  const onSave = vi.fn();
  render(<SquareSheet open index={11} name="John" allocationLabel="Mora family" isPublished hasNextOpen={false} onSave={onSave} onClose={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Name on the board' }), {target: {value: 'John B'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));
  expect(onSave).toHaveBeenCalledWith(11, 'John B', expect.any(Object), false, 'Mora family');
  expect(screen.getByText(/recorded in the board history/)).toBeInTheDocument();
});

it('prevents saving a buyer longer than the server limit', () => {
  const onSave = vi.fn();
  render(<SquareSheet open index={0} name="" isPublished={false} hasNextOpen onSave={onSave} onClose={vi.fn()} />);
  const name = screen.getByRole('textbox', {name: 'Name on the board'});
  expect(name).toHaveAttribute('maxlength', '80');
  fireEvent.change(name, {target: {value: 'a'.repeat(81)}});
  expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
  expect(screen.getByRole('button', {name: 'Save and next'})).toBeDisabled();
  fireEvent.keyDown(name, {key: 'Enter'});
  expect(onSave).not.toHaveBeenCalled();
});

it.each(['unspecified', 'available', 'unavailable'] as const)('preserves %s availability while editing name and payment without an availability dropdown', (availability) => {
  const onSave = vi.fn();
  render(<SquareSheet open index={12} name="Anthony" allocationLabel="Anthony" availability={availability} isPublished={false} hasNextOpen onSave={onSave} onClose={vi.fn()}/>);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Name on the board' }), { target: { value: 'Tony' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Paid' }));
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name on the board' }), { key: 'Enter' });
  expect(onSave).toHaveBeenCalledWith(12, 'Tony', expect.objectContaining({paid_status:'paid'}), true, 'Anthony', availability);
});
