import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FindSquaresModal from '../components/board/FindSquaresModal';
import type { BoardData } from '../types';

const boardWithNames = (...labels: string[]): BoardData => {
  const squares = Array.from({ length: 100 }, () => [] as string[]);
  labels.forEach((label, index) => {
    squares[index] = [label];
  });
  return {
    bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    oppAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    squares,
  };
};

describe('FindSquaresModal', () => {
  it('submits a unique normalized exact match as the canonical board label', () => {
    const onSelectPlayer = vi.fn();
    const onClose = vi.fn();
    render(
      <FindSquaresModal
        board={boardWithNames('Mike S.')}
        selectedPlayer=""
        onSelectPlayer={onSelectPlayer}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText('Name used on board'), { target: { value: '  MÍKE S  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find' }));

    expect(onSelectPlayer).toHaveBeenCalledWith('Mike S.');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows partial suggestions and waits for a human choice', () => {
    const onSelectPlayer = vi.fn();
    render(
      <FindSquaresModal
        board={boardWithNames('Mike S.', 'Mina R.', 'Michael')}
        selectedPlayer=""
        onSelectPlayer={onSelectPlayer}
        onClose={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText('Name used on board'), { target: { value: 'mi' } });
    const suggestions = screen.getByTestId('name-suggestions');
    expect(screen.getByText('Did you mean…')).toBeInTheDocument();
    expect(within(suggestions).getAllByRole('button')).toHaveLength(3);
    expect(onSelectPlayer).not.toHaveBeenCalled();

    fireEvent.click(within(suggestions).getByRole('button', { name: 'Mike S.' }));
    expect(onSelectPlayer).toHaveBeenCalledWith('Mike S.');
  });

  it('does not auto-select ambiguous normalized names', () => {
    const onSelectPlayer = vi.fn();
    render(
      <FindSquaresModal
        board={boardWithNames('Jose', 'José')}
        selectedPlayer=""
        onSelectPlayer={onSelectPlayer}
        onClose={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText('Name used on board'), { target: { value: 'jose' } });
    expect(screen.getByRole('button', { name: 'Find' })).toBeDisabled();
    expect(within(screen.getByTestId('name-suggestions')).getAllByRole('button')).toHaveLength(2);
    expect(onSelectPlayer).not.toHaveBeenCalled();
  });

  it('shows a distinct alphabetized browse list when no query matches', () => {
    render(
      <FindSquaresModal
        board={boardWithNames('Zoe', 'Ann', 'Zoe')}
        selectedPlayer=""
        onSelectPlayer={() => undefined}
        onClose={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText('Name used on board'), { target: { value: 'nobody' } });
    expect(screen.getByText('No close match. Browse every name')).toBeInTheDocument();
    expect(within(screen.getByTestId('browse-name-list')).getAllByRole('button').map((button) => button.textContent)).toEqual(['Ann', 'Zoe']);
  });

  it('renders an honest empty state for an unassigned board', () => {
    render(
      <FindSquaresModal
        board={boardWithNames()}
        selectedPlayer=""
        onSelectPlayer={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText('No names have been assigned on this board yet.')).toBeInTheDocument();
    expect(screen.queryByText('OPEN')).not.toBeInTheDocument();
  });
});
