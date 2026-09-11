import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PayoutRulesCard from '../../src/features/organizer/workspace/PayoutRulesCard';
import ReconcileCard from '../../src/features/organizer/workspace/ReconcileCard';
import BoardToolsCard from '../../src/features/organizer/workspace/BoardToolsCard';
import type { OrganizerLifecycleModel } from '../../src/features/organizer/lifecycle/organizerLifecycle';

describe('PayoutRulesCard', () => {
  const baseModel = () => ({
    descriptions: {},
    status: 'idle' as const,
    onChange: vi.fn(),
    onSavePayoutDescriptions: vi.fn(),
  });

  it('renders the four bounded payout fields and the notes textarea', () => {
    render(<PayoutRulesCard {...baseModel()} />);
    const q1 = screen.getByLabelText('Q1') as HTMLInputElement;
    const half = screen.getByLabelText('Halftime') as HTMLInputElement;
    const q3 = screen.getByLabelText('Q3') as HTMLInputElement;
    const final = screen.getByLabelText('Final') as HTMLInputElement;
    [q1, half, q3, final].forEach((input) => {
      expect(input).toHaveAttribute('maxLength', '120');
      expect(input).toHaveAttribute('placeholder', 'Winner gets bragging rights');
    });
    const notes = screen.getByLabelText('Board rules') as HTMLTextAreaElement;
    expect(notes).toHaveAttribute('maxLength', '280');
    expect(screen.getByText('GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners. Describe prizes in words.')).toBeInTheDocument();
  });

  it('calls onChange with the field key and onSave with no args when saving', () => {
    const props = baseModel();
    render(<PayoutRulesCard {...props} />);
    fireEvent.change(screen.getByLabelText('Q1'), { target: { value: 'Bragging rights' } });
    expect(props.onChange).toHaveBeenCalledWith('Q1', 'Bragging rights');

    fireEvent.click(screen.getByText('Save payout rules'));
    expect(props.onSavePayoutDescriptions).toHaveBeenCalledTimes(1);
  });

  it('shows aria-busy and Saving… while saving, and Saved when clean', () => {
    const { rerender } = render(<PayoutRulesCard {...baseModel()} status="saving" />);
    const button = screen.getByRole('button', { name: /Saving/ });
    expect(button).toHaveAttribute('aria-busy', 'true');

    rerender(<PayoutRulesCard {...baseModel()} status="saved" />);
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('shows an error status line when status is error', () => {
    render(<PayoutRulesCard {...baseModel()} status="error" />);
    expect(screen.getByText(/error|failed|try again/i)).toBeInTheDocument();
  });

  it('disables fields and save when disabled is true', () => {
    render(<PayoutRulesCard {...baseModel()} disabled />);
    expect(screen.getByLabelText('Q1')).toBeDisabled();
    expect(screen.getByText('Save payout rules').closest('button')).toBeDisabled();
  });
});

describe('ReconcileCard', () => {
  const model = (overrides: Partial<OrganizerLifecycleModel> = {}): OrganizerLifecycleModel => ({
    phase: 'Reconcile',
    primaryAction: 'Continue to draw',
    assignedCount: 42,
    openCount: 58,
    hardBlockers: [],
    advisories: [],
    canEnterDraw: false,
    canPublish: false,
    ...overrides,
  });

  it('renders the summary line as a toggle button reflecting highlightOpen', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ReconcileCard model={model()} unpaidCount={3} highlightOpen={false} onToggleHighlightOpen={onToggle} />,
    );
    const button = screen.getByRole('button', { name: '42 filled · 58 open · 3 unpaid · 0 not asked yet' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<ReconcileCard model={model()} unpaidCount={3} highlightOpen onToggleHighlightOpen={onToggle} />);
    expect(screen.getByRole('button', { name: '42 filled · 58 open · 3 unpaid · 0 not asked yet' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows ready copy only when the model permits publishing', () => {
    render(<ReconcileCard model={model({ canPublish: true })} unpaidCount={0} highlightOpen={false} onToggleHighlightOpen={vi.fn()} />);
    expect(screen.getByText('Ready for preview.')).toBeInTheDocument();
    expect(screen.getByText('No private follow-up.')).toBeInTheDocument();
  });

  it('shows the next selling step instead of claiming an empty board is ready', () => {
    render(<ReconcileCard model={model({ assignedCount: 0, openCount: 100, phase: 'Fill' })} unpaidCount={0} highlightOpen={false} onToggleHighlightOpen={vi.fn()} />);
    expect(screen.queryByText('Ready for preview.')).not.toBeInTheDocument();
    expect(screen.getByText('Allocate squares to a person or family, then draw game numbers when ready.')).toBeInTheDocument();
  });

  it('explains the missing draw when there are no other blockers', () => {
    render(<ReconcileCard model={model({ phase: 'Draw', canEnterDraw: true })} unpaidCount={0} highlightOpen={false} onToggleHighlightOpen={vi.fn()} />);
    expect(screen.queryByText('Ready for preview.')).not.toBeInTheDocument();
    expect(screen.getByText('When sales are finished, draw game numbers, then review and finalize the board.')).toBeInTheDocument();
  });

  it('lists hard blockers and advisories using their copy maps', () => {
    render(
      <ReconcileCard
        model={model({
          hardBlockers: ['missing_board_identity', 'save_dirty'],
          advisories: ['open_squares_remaining', 'unpaid_or_unknown_payment_status'],
        })}
        unpaidCount={2}
        highlightOpen={false}
        onToggleHighlightOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('Add a board title before publishing.')).toBeInTheDocument();
    expect(screen.getByText('Save the latest changes before publishing.')).toBeInTheDocument();
    expect(screen.getByText('OPEN squares remain. You can publish if you are okay leaving them OPEN.')).toBeInTheDocument();
    expect(screen.getByText('Some private payment notes still need follow-up.')).toBeInTheDocument();
  });
});

describe('BoardToolsCard', () => {
  it('shows Share board image always, and Send seller sheet only when hasSellers', () => {
    const { rerender } = render(
      <BoardToolsCard isPublished exporting={false} onExport={vi.fn()} hasSellers={false} />,
    );
    expect(screen.getByText('Share board image')).toBeInTheDocument();
    expect(screen.queryByText('Send seller sheet')).not.toBeInTheDocument();

    rerender(<BoardToolsCard isPublished exporting={false} onExport={vi.fn()} hasSellers />);
    expect(screen.getByText('Send seller sheet')).toBeInTheDocument();
  });

  it('calls onExport with the right mode for each button', () => {
    const onExport = vi.fn();
    render(<BoardToolsCard isPublished exporting={false} onExport={onExport} hasSellers />);
    fireEvent.click(screen.getByText('Share board image'));
    expect(onExport).toHaveBeenCalledWith('owners');
    fireEvent.click(screen.getByText('Send seller sheet'));
    expect(onExport).toHaveBeenCalledWith('sellers');
  });

  it('only shows draft-only tools (import photo, clear names) when not published', () => {
    const { rerender } = render(
      <BoardToolsCard isPublished exporting={false} onExport={vi.fn()} hasSellers={false} onClearNames={vi.fn()} />,
    );
    expect(screen.queryByText('Import a paper board photo')).not.toBeInTheDocument();
    expect(screen.queryByText('Clear all names')).not.toBeInTheDocument();

    rerender(
      <BoardToolsCard isPublished={false} exporting={false} onExport={vi.fn()} hasSellers={false} onClearNames={vi.fn()} />,
    );
    expect(screen.getByText('Import a paper board photo')).toBeInTheDocument();
    expect(screen.getByText('Clear all names')).toBeInTheDocument();
  });

  it('has a hidden file input under the import label accepting the right image types', () => {
    render(
      <BoardToolsCard isPublished={false} exporting={false} onExport={vi.fn()} hasSellers={false} onImportPhoto={vi.fn()} />,
    );
    const label = screen.getByText('Import a paper board photo').closest('label');
    expect(label).not.toBeNull();
    const input = label?.querySelector('input[type="file"]');
    expect(input).toHaveAttribute('accept', '.jpg,.jpeg,.png,.webp');
  });

  it('calls onImportPhoto with the selected file', () => {
    const onImportPhoto = vi.fn();
    render(
      <BoardToolsCard isPublished={false} exporting={false} onExport={vi.fn()} hasSellers={false} onImportPhoto={onImportPhoto} />,
    );
    const label = screen.getByText('Import a paper board photo').closest('label');
    const input = label?.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'board.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onImportPhoto).toHaveBeenCalledWith(file);
  });

  it('requires a second click within 5s to confirm clearing names', () => {
    vi.useFakeTimers();
    const onClearNames = vi.fn();
    render(
      <BoardToolsCard isPublished={false} exporting={false} onExport={vi.fn()} hasSellers={false} onClearNames={onClearNames} />,
    );
    fireEvent.click(screen.getByText('Clear all names'));
    expect(onClearNames).not.toHaveBeenCalled();
    expect(screen.getByText('Confirm clear')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Confirm clear'));
    expect(onClearNames).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('reverts the confirm state after 5s without a second click', () => {
    vi.useFakeTimers();
    const onClearNames = vi.fn();
    render(
      <BoardToolsCard isPublished={false} exporting={false} onExport={vi.fn()} hasSellers={false} onClearNames={onClearNames} />,
    );
    fireEvent.click(screen.getByText('Clear all names'));
    expect(screen.getByText('Confirm clear')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5001);
    });
    expect(screen.queryByText('Confirm clear')).not.toBeInTheDocument();
    expect(screen.getByText('Clear all names')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
