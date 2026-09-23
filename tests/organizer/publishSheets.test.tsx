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
import UpgradeSheet from '../../src/features/organizer/workspace/UpgradeSheet';
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
      json: async () => ({ published: true, shareCode: 'abc123', viewerUrl: '/b/abc123', revision: 3, tier: 'gameday', used: 2, allowance: 5 }),
    });

    const result = await publishBoard('pool-1', { allowOpenSquares: true });

    expect(global.fetch).toHaveBeenCalledWith('/api/pools/pool-1/publish', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ allowOpenSquares: true }),
    }));
    expect(result).toEqual({ published: true, shareCode: 'abc123', viewerUrl: '/b/abc123', revision: 3, tier: 'gameday', used: 2, allowance: 5 });
  });

  it('posts an empty body when allowOpenSquares is false', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ published: true, shareCode: 'x', viewerUrl: '/b/x', revision: 1, tier: 'free', used: 1, allowance: 1 }),
    });

    await publishBoard('pool-2', { allowOpenSquares: false });

    expect(global.fetch).toHaveBeenCalledWith('/api/pools/pool-2/publish', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({}),
    }));
  });

  it('returns published:false with upgradeTo on a 402', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ upgradeTo: 'gameday', error: 'Choose a plan to publish another board.' }),
    });

    const result = await publishBoard('pool-3', { allowOpenSquares: false });

    expect(result).toEqual({ published: false, upgradeTo: 'gameday', message: 'Choose a plan to publish another board.' });
  });

  it('throws with the server error message on other non-OK responses', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'The board has changed since you last saved.' }),
    });

    await expect(publishBoard('pool-4', { allowOpenSquares: false })).rejects.toThrow('The board has changed since you last saved.');
  });

  it('throws a fallback message when the server sends no error text', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(publishBoard('pool-5', { allowOpenSquares: false })).rejects.toThrow('The board could not be published.');
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
        allowance={{ tier: 'gameday', used: 2, allowance: 5 }}
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
    expect(screen.getByText(/2 of 5 published this season/)).toBeInTheDocument();

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const publish = screen.getByRole('button', { name: 'Publish viewer link' });
    fireEvent.click(cancel);
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(publish);
    expect(onPublish).toHaveBeenCalled();
  });

  it('omits the open-square rule and allowance line when not applicable', () => {
    render(
      <PublishSheet
        open
        game={game}
        board={boardFull}
        allowance={null}
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
        allowance={null}
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

describe('UpgradeSheet', () => {
  it('disables checkout until the organization name is valid for org tier', () => {
    const onCheckout = vi.fn();
    const onChange = vi.fn();
    const { rerender } = render(
      <UpgradeSheet
        open
        tier="org"
        error={null}
        organizationName=""
        onOrganizationNameChange={onChange}
        onClose={() => {}}
        onCheckout={onCheckout}
      />,
    );
    expect(screen.getByText('Choose a plan')).toBeInTheDocument();
    expect(screen.getByText('Organization · up to 50 boards')).toBeInTheDocument();
    const checkoutButton = screen.getByRole('button', { name: 'Continue to $79 checkout' });
    expect(checkoutButton).toBeDisabled();

    rerender(
      <UpgradeSheet
        open
        tier="org"
        error={null}
        organizationName="Riverside Ravens"
        onOrganizationNameChange={onChange}
        onClose={() => {}}
        onCheckout={onCheckout}
      />,
    );
    const enabledButton = screen.getByRole('button', { name: 'Continue to $79 checkout' });
    expect(enabledButton).not.toBeDisabled();
    fireEvent.click(enabledButton);
    expect(onCheckout).toHaveBeenCalled();
  });

  it('shows gameday copy and pricing without an org name field', () => {
    render(
      <UpgradeSheet
        open
        tier="gameday"
        error={null}
        organizationName=""
        onOrganizationNameChange={() => {}}
        onClose={() => {}}
        onCheckout={() => {}}
      />,
    );
    expect(screen.getByText('Game Day · up to 5 boards')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your free board is used.' })).toBeInTheDocument();
    expect(screen.getByText('$9.99 covers up to 5 boards this season, counting your first. It doesn’t reset after a game.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to $9.99 checkout' })).not.toBeDisabled();
    expect(screen.queryByLabelText('Organization name')).not.toBeInTheDocument();
  });
});

describe('PublishedSheet', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
  });

  it('copies the link and fires both buttons', async () => {
    const onOpenViewer = vi.fn();
    const onEnterGameDay = vi.fn();
    render(
      <PublishedSheet
        open
        shareUrl="https://gridone.app/b/abc123"
        onClose={() => {}}
        onOpenViewer={onOpenViewer}
        onEnterGameDay={onEnterGameDay}
      />,
    );

    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('https://gridone.app/b/abc123')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://gridone.app/b/abc123');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open public board' }));
    expect(onOpenViewer).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Manage board' }));
    expect(onEnterGameDay).toHaveBeenCalled();
  });

  it('shows an error state when copying fails', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => { throw new Error('nope'); }) } });
    render(
      <PublishedSheet
        open
        shareUrl="https://gridone.app/b/abc123"
        onClose={() => {}}
        onOpenViewer={() => {}}
        onEnterGameDay={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

it('describes finalizing an already shared board without claiming sharing is off', () => {
  render(<PreviewSheet open isShared onClose={vi.fn()} canPublish onReviewPublish={vi.fn()}>Board</PreviewSheet>);
  expect(screen.getByRole('dialog', {name: 'Preview final board'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Review and lock numbers'})).toBeInTheDocument();
  expect(screen.queryByText(/sharing is off/)).not.toBeInTheDocument();
});
