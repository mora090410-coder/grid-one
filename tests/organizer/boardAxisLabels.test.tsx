import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BoardEditor, { type BoardEditorProps } from '../../src/features/organizer/workspace/BoardEditor';

const props = {
  game: { topAbbr: 'IND', topName: 'Indianapolis', leftAbbr: 'DAL', leftName: 'Dallas' },
  board: { topAxis: Array(10).fill(null), leftAxis: Array(10).fill(null), squares: Array.from({ length: 100 }, () => []) },
  entryMeta: {}, drawPreview: null, highlightOpen: false, isPublished: false, canAssignOpenSquares: false,
  selectMode: false, selection: new Set<number>(), onSelectionChange: vi.fn(), onToggleSelectMode: vi.fn(), onSelectSquare: vi.fn(),
} satisfies BoardEditorProps;

describe('organizer team-axis identity', () => {
  it('labels the configured column and row teams independently of score-line order', () => {
    const view = render(<BoardEditor {...props} />);
    const axes = screen.getByRole('group', { name: 'Team axes' });
    expect(axes).toHaveTextContent('Top (columns) · IND');
    expect(axes).toHaveTextContent('Side (rows) · DAL');
    view.rerender(<BoardEditor {...props} game={{ ...props.game, topAbbr: 'DAL', topName: 'Dallas', leftAbbr: 'IND', leftName: 'Indianapolis' }} />);
    expect(axes).toHaveTextContent('Top (columns) · DAL');
    expect(axes).toHaveTextContent('Side (rows) · IND');
  });

  it('uses full names if abbreviations are absent and does not invent missing teams', () => {
    const view = render(<BoardEditor {...props} game={{ ...props.game, topAbbr: '', leftAbbr: '' }} />);
    expect(screen.getByRole('group', { name: 'Team axes' })).toHaveTextContent('Top (columns) · Indianapolis');
    expect(screen.getByRole('group', { name: 'Team axes' })).toHaveTextContent('Side (rows) · Dallas');
    view.rerender(<BoardEditor {...props} game={{ topAbbr: '', topName: '', leftAbbr: '', leftName: '' }} />);
    expect(screen.getByRole('group', { name: 'Team axes' })).toHaveTextContent('Top (columns) · Not set');
    expect(screen.getByRole('group', { name: 'Team axes' })).toHaveTextContent('Side (rows) · Not set');
  });
});
