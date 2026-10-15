import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceHeader from '../../src/features/organizer/workspace/WorkspaceHeader';
import type { GameState } from '../../types';

vi.mock('../../components/ScheduledGamePicker', () => ({ default: () => <div data-testid="picker" /> }));
const game: GameState = { title: 'Lincoln Softball', meta: '', leftAbbr: 'KC', leftName: 'Kansas City', topAbbr: 'PHI', topName: 'Philadelphia', dates: '', kickoffAt: '2026-09-13T17:00:00.000Z', lockTitle: false, lockMeta: false };
const base = { game, isPublished: false, onTitleChange: vi.fn(), onGameChange: vi.fn(), onRetry: vi.fn(), onReload: vi.fn(), onLogout: vi.fn() };

describe('WorkspaceHeader', () => {
  it('edits the title in place and commits on blur', () => {
    const onTitleChange = vi.fn();
    render(<WorkspaceHeader {...base} onTitleChange={onTitleChange} saveState={{ status: 'clean', revision: 1 }} />);
    const input = screen.getByRole('textbox', { name: 'Board name' });
    fireEvent.change(input, { target: { value: '  Lincoln Softball Boosters ' } });
    fireEvent.blur(input);
    expect(onTitleChange).toHaveBeenCalledWith('Lincoln Softball Boosters');
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });
  it('shows conflict as an alert with Reload latest board', () => {
    render(<WorkspaceHeader {...base} saveState={{ status: 'conflicted', revision: 1 }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('This board changed in another session.');
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest board' }));
    expect(base.onReload).toHaveBeenCalled();
  });
  it('shows Retry on save failure', () => {
    render(<WorkspaceHeader {...base} saveState={{ status: 'save_failed', revision: 1 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(base.onRetry).toHaveBeenCalled();
  });
  it('opens the game sheet in draft and hides it when published', () => {
    const { rerender } = render(<WorkspaceHeader {...base} saveState={{ status: 'clean', revision: 1 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change game' }));
    expect(screen.getByRole('dialog', { name: 'Pick the game' })).toBeInTheDocument();
    rerender(<WorkspaceHeader {...base} isPublished saveState={{ status: 'clean', revision: 1 }} />);
    expect(screen.queryByRole('button', { name: 'Change game' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Board name' })).toHaveAttribute('readonly');
  });

  it('resyncs the title when game.title changes and the input is not focused', () => {
    const { rerender } = render(<WorkspaceHeader {...base} saveState={{ status: 'clean', revision: 1 }} />);
    const input = screen.getByRole('textbox', { name: 'Board name' }) as HTMLInputElement;
    expect(input.value).toBe('Lincoln Softball');
    rerender(<WorkspaceHeader {...base} game={{ ...game, title: 'Updated Title' }} saveState={{ status: 'clean', revision: 1 }} />);
    expect(input.value).toBe('Updated Title');
  });

  it('commits the title once on Enter and does not commit again on the resulting blur', () => {
    const onTitleChange = vi.fn();
    render(<WorkspaceHeader {...base} onTitleChange={onTitleChange} saveState={{ status: 'clean', revision: 1 }} />);
    const input = screen.getByRole('textbox', { name: 'Board name' });
    fireEvent.change(input, { target: { value: 'New Title' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(onTitleChange).toHaveBeenCalledTimes(1);
    expect(onTitleChange).toHaveBeenCalledWith('New Title');
  });

  it('requires explicit save or discard of a recovered draft instead of claiming Saved', () => {
    const onRetry = vi.fn();
    const onReload = vi.fn();
    render(<WorkspaceHeader {...base} onRetry={onRetry} onReload={onReload} saveState={{ status: 'recovered', revision: 1 }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('server board may be newer');
    expect(screen.queryByText('Saved')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save recovered changes' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Discard and reload server board' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('uses 44px touch targets for Retry, Reload latest board, and Change game', () => {
    const { rerender } = render(<WorkspaceHeader {...base} saveState={{ status: 'save_failed', revision: 1 }} />);
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry.className).toContain('h-11');
    expect(retry.className).not.toContain('h-8');

    rerender(<WorkspaceHeader {...base} saveState={{ status: 'conflicted', revision: 1 }} />);
    const reload = screen.getByRole('button', { name: 'Reload latest board' });
    expect(reload.className).toContain('h-11');
    expect(reload.className).not.toContain('h-8');

    rerender(<WorkspaceHeader {...base} saveState={{ status: 'clean', revision: 1 }} />);
    const changeGame = screen.getByRole('button', { name: 'Change game' });
    expect(changeGame.className).toContain('h-11');
    expect(changeGame.className).not.toContain('h-8');
  });
});
