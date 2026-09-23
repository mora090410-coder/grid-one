import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OrganizerIsland from '../../src/features/organizer/workspace/OrganizerIsland';
import DrawControl from '../../src/features/organizer/workspace/DrawControl';
import { secureShuffleDigits } from '../../src/features/organizer/workspace/secureDraw';

describe('OrganizerIsland', () => {
  it('describes assignment progress in the compact button', () => {
    render(
      <OrganizerIsland
        filled={40}
        paid={20}
        drawn={false}
        phase="Fill"
        primary={{ label: 'Start assigning', onClick: vi.fn() }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Organizer status' })).toHaveAccessibleDescription(/40 of 100 assigned/);
  });

  it('shows committed number status when drawn is true', () => {
    render(
      <OrganizerIsland
        filled={100}
        paid={100}
        drawn
        phase="Preview"
        primary={{ label: 'Review and publish', onClick: vi.fn() }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Organizer status' })).toHaveAccessibleDescription(/Numbers drawn/);
  });

  it('shows zero assigned without a misleading payment percentage', () => {
    render(
      <OrganizerIsland
        filled={0}
        paid={0}
        drawn={false}
        phase="Create Draft"
        primary={{ label: 'Create draft', onClick: vi.fn() }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Organizer status' })).toHaveAccessibleDescription(/0 of 100 assigned/);
  });

  it('expands to show the phase eyebrow, note, primary action, and ghost secondaries', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <OrganizerIsland
        filled={40}
        paid={20}
        drawn={false}
        phase="Reconcile"
        note="Some squares are missing a payment status."
        primary={{ label: 'Continue anyway', onClick: onPrimary }}
        secondary={[{ label: 'Edit board', onClick: onSecondary }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /organizer status/i }));
    expect(screen.getByText('Reconcile')).toBeInTheDocument();
    expect(screen.getByText('Some squares are missing a payment status.')).toBeInTheDocument();
    const primaryButton = screen.getByRole('button', { name: 'Continue anyway' });
    fireEvent.click(primaryButton);
    expect(onPrimary).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Organizer status' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Organizer status' }));
    const secondaryButton = screen.getByRole('button', { name: 'Edit board' });
    fireEvent.click(secondaryButton);
    expect(onSecondary).toHaveBeenCalled();
  });

  it('disables the primary action when disabled is true and omits it entirely when null', () => {
    const onPrimary = vi.fn();
    const { rerender } = render(
      <OrganizerIsland
        filled={40}
        paid={20}
        drawn={false}
        phase="Reconcile"
        primary={{ label: 'Continue anyway', onClick: onPrimary, disabled: true }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /organizer status/i }));
    expect(screen.getByRole('button', { name: 'Continue anyway' })).toBeDisabled();

    rerender(
      <OrganizerIsland
        filled={40}
        paid={20}
        drawn={false}
        phase="Reconcile"
        primary={null}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Continue anyway' })).toBeNull();
  });
});

describe('DrawControl', () => {
  const base = {
    openCount: 6,
    acknowledged: false,
    drawn: false,
    preview: false,
    disabled: false,
    onAcknowledge: vi.fn(),
    onAcknowledgeWithoutDraw: vi.fn(),
    onKeepAssigning: vi.fn(),
    onDraw: vi.fn(),
    onCommit: vi.fn(),
    onAgain: vi.fn(),
    onReplace: vi.fn(),
    onCancelPreview: vi.fn(),
  };

  it('renders nothing when there are no open squares to acknowledge and nothing else to show', () => {
    const { container } = render(<DrawControl {...base} openCount={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the acknowledgement group with heading, sentence, and both buttons', () => {
    render(<DrawControl {...base} />);
    const group = screen.getByRole('group', { name: '6 squares are open. Draw anyway?' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '6 squares are open. Draw anyway?' })).toBeInTheDocument();
    expect(screen.getByText('Open squares stay open. You can still fill them before kickoff.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep assigning' }));
    expect(base.onKeepAssigning).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Draw with 6 OPEN' }));
    expect(base.onAcknowledge).toHaveBeenCalled();
  });

  it('does not show the acknowledgement group once acknowledged', () => {
    const { container } = render(<DrawControl {...base} acknowledged />);
    expect(screen.queryByRole('group', { name: /Draw anyway\?/ })).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows preview state buttons: Use numbers and continue, Draw again, Cancel', () => {
    render(<DrawControl {...base} acknowledged preview />);
    fireEvent.click(screen.getByRole('button', { name: 'Use numbers and continue' }));
    expect(base.onCommit).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Draw again' }));
    expect(base.onAgain).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(base.onCancelPreview).toHaveBeenCalled();
  });

  it('shows drawn state with Numbers set, a Drawn tag, and Replace draft draw', () => {
    render(<DrawControl {...base} acknowledged drawn preview={false} />);
    expect(screen.getByText('Numbers set')).toBeInTheDocument();
    expect(screen.getByText('Drawn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replace draft draw' }));
    expect(base.onReplace).toHaveBeenCalled();
  });
});

describe('secureShuffleDigits', () => {
  it('returns a permutation of 0-9 across many runs', () => {
    for (let i = 0; i < 20; i += 1) {
      const digits = secureShuffleDigits();
      expect(digits).toHaveLength(10);
      expect(new Set(digits)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    }
  });
});
