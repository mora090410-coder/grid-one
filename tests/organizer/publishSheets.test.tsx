import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { BoardData, GameState } from '../../types';

vi.mock('../../services/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 't' } } })) } },
}));

import { publishBoard } from '../../src/features/organizer/workspace/publishBoard';
import PreviewSheet from '../../src/features/organizer/workspace/PreviewSheet';
import PublishSheet from '../../src/features/organizer/workspace/PublishSheet';
import PublishedSheet from '../../src/features/organizer/workspace/PublishedSheet';

const game: GameState = {
  title: 'Championship Pool',
  meta: '',
  leftAbbr: 'KC',
  leftName: 'Kansas City',
  topAbbr: 'PHI',
  topName: 'Philadelphia',
  dates: 'Feb 9, 6:30 PM ET',
  lockTitle: false,
  lockMeta: false,
};

const boardWithOpen: BoardData = {
  topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  leftAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  squares: Array.from({ length: 100 }, (_, i) => (i < 40 ? ['Ann'] : [])),
  allowOpenSquares: true,
};

const boardFull: BoardData = {
  topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  leftAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  squares: Array.from({ length: 100 }, () => ['Ann']),
};

describe('publishBoard', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('posts with allowOpenSquares:true and returns the published result on 200', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ published: true, shareCode: 'abc123', viewerUrl: '/b/abc123', revision: 3 }),
    });

    const result = await publishBoard('pool-1', { allowOpenSquares: true, revision: 7 });

    expect(global.fetch).toHaveBeenCalledWith('/api/pools/pool-1/publish', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ revision: 7, allowOpenSquares: true }),
    }));
    expect(result).toEqual({ published: true, shareCode: 'abc123', viewerUrl: '/b/abc123', revision: 3 });
  });

  it('posts only the revision the organizer saw when allowOpenSquares is false', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ published: true, shareCode: 'x', viewerUrl: '/b/x', revision: 1 }),
    });

    await publishBoard('pool-2', { allowOpenSquares: false, revision: 3 });

    expect(global.fetch).toHaveBeenCalledWith('/api/pools/pool-2/publish', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ revision: 3 }),
    }));
  });

  it('marks a revision conflict so the organizer can reload the latest names', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        code: 'REVISION_CONFLICT',
        error: 'This board changed since you last loaded it. Reload to review the latest names before locking numbers.',
        currentRevision: 9,
      }),
    });

    const failure = await publishBoard('pool-6', { allowOpenSquares: false, revision: 8 }).catch((error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe('This board changed since you last loaded it. Reload to review the latest names before locking numbers.');
    expect(failure.code).toBe('REVISION_CONFLICT');
    expect(failure.currentRevision).toBe(9);
  });

  it('throws with the server error message on other non-OK responses', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'The board has changed since you last saved.' }),
    });

    await expect(publishBoard('pool-4', { allowOpenSquares: false, revision: 1 })).rejects.toThrow('The board has changed since you last saved.');
  });

  it.each([
    null,
    { published: false, shareCode: 'ABC123', viewerUrl: '/b/ABC123', revision: 3 },
    { published: true, shareCode: 'ABC123', viewerUrl: 'https://example.invalid/', revision: 3 },
    { published: true, shareCode: 'ABC123', viewerUrl: '/b/ABC123', revision: null },
  ])('rejects an unconfirmed publish payload', async (payload) => {
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => payload });
    await expect(publishBoard('pool-7', { allowOpenSquares: false, revision: 2 })).rejects.toThrow('Publishing could not be confirmed.');
  });

  it('throws a fallback message when the server sends no error text', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(publishBoard('pool-5', { allowOpenSquares: false, revision: 1 })).rejects.toThrow('The board could not be published.');
  });
});

describe('PreviewSheet', () => {
  it('renders children in a scroll container and gates the footer button', () => {
    const onReviewPublish = vi.fn();
    const { rerender } = render(
      <PreviewSheet open canPublish={false} onClose={() => {}} onReviewPublish={onReviewPublish}>
        <p>Preview content</p>
      </PreviewSheet>,
    );

    expect(screen.getByText('Private preview — sharing is off')).toBeInTheDocument();
    expect(screen.getByTestId('preview-scroll')).toContainElement(screen.getByText('Preview content'));
    const button = screen.getByRole('button', { name: 'Review and publish' });
    expect(button).toBeDisabled();

    rerender(
      <PreviewSheet open canPublish onClose={() => {}} onReviewPublish={onReviewPublish}>
        <p>Preview content</p>
      </PreviewSheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
    expect(onReviewPublish).toHaveBeenCalled();
  });
});

describe('PublishSheet', () => {
  it('summarizes the board and calls onPublish', () => {
    const onPublish = vi.fn();
    const onClose = vi.fn();
    render(
      <PublishSheet
        open
        game={game}
        board={boardWithOpen}
        pending={false}
        error={null}
        disabled={false}
        onClose={onClose}
        onPublish={onPublish}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Publish viewer link' })).toBeInTheDocument();
    expect(screen.getByText('KC at PHI')).toBeInTheDocument();
    expect(screen.getByText('Feb 9, 6:30 PM ET')).toBeInTheDocument();
    expect(screen.getByText('40 assigned · 60 OPEN')).toBeInTheDocument();
    expect(screen.getByText('0 1 2 3 4 5 6 7 8 9')).toBeInTheDocument();
    expect(screen.getByText('9 8 7 6 5 4 3 2 1 0')).toBeInTheDocument();
    expect(screen.getByText('Open squares stay OPEN on the shared board.')).toBeInTheDocument();
    expect(screen.queryByText(/published this season/)).not.toBeInTheDocument();

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const publish = screen.getByRole('button', { name: 'Publish viewer link' });
    fireEvent.click(cancel);
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(publish);
    expect(onPublish).toHaveBeenCalled();
  });

  it('omits the open-square rule when no squares are open', () => {
    render(
      <PublishSheet
        open
        game={game}
        board={boardFull}
        pending={false}
        error="Something broke"
        disabled={false}
        onClose={() => {}}
        onPublish={() => {}}
      />,
    );
    expect(screen.queryByText('Open squares stay OPEN on the shared board.')).not.toBeInTheDocument();
    expect(screen.queryByText(/published this season/)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke');
  });

  it('shows aria-busy while pending', () => {
    render(
      <PublishSheet
        open
        game={game}
        board={boardFull}
        pending
        error={null}
        disabled={false}
        onClose={() => {}}
        onPublish={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Publish/ })).toHaveAttribute('aria-busy', 'true');
  });
});
