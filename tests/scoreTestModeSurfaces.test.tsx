import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SyntheticScoreTestBanner from '../components/SyntheticScoreTestBanner';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  findVisiblePublicBoard: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('../functions/_lib/publicBoardVisibility', () => ({
  findVisiblePublicBoard: mocks.findVisiblePublicBoard,
  publicBoardNotFoundResponse: vi.fn(),
}));

import { onRequestGet } from '../functions/api/pools/[id]';

describe('score-test mode surfaces', () => {
  it('uses an unmissable synthetic-data warning that states email is disabled', () => {
    render(<SyntheticScoreTestBanner />);

    expect(screen.getByRole('alert')).toHaveTextContent('SYNTHETIC SCORE TEST');
    expect(screen.getByRole('alert')).toHaveTextContent('not a live result');
    expect(screen.getByRole('alert')).toHaveTextContent(/winner and correction emails are disabled/i);
  });

  it('mounts the warning above both viewer and organizer board branches', () => {
    const boardView = readFileSync(
      resolve(process.cwd(), 'components/BoardView.tsx'),
      'utf8',
    );
    const bannerIndex = boardView.indexOf('<SyntheticScoreTestBanner');
    const viewerIndex = boardView.indexOf('!isCommissionerMode');
    const organizerIndex = boardView.indexOf('isCommissionerMode &&');

    expect(bannerIndex).toBeGreaterThan(-1);
    expect(bannerIndex).toBeLessThan(viewerIndex);
    expect(bannerIndex).toBeLessThan(organizerIndex);
    expect(boardView).toContain('game.scoreTestMode');
  });

  it('projects the permanent flag through the public board API', async () => {
    mocks.createClient.mockReturnValue({});
    mocks.findVisiblePublicBoard.mockResolvedValue({
      snapshot: {
        share_code: 'ABCDEFGH',
        revision: 1,
        board_title: 'Synthetic board',
        matchup: {},
        board: { squares: [] },
        score: null,
        winner_history: [],
        pending_milestones: [],
        payout_labels: {},
        published_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-09-01T00:00:00.000Z',
        score_test_mode: true,
      },
      contest: { id: 'contest-id', status: 'published' },
    });

    const response = await onRequestGet({
      request: new Request('https://www.getgridone.com/api/pools/ABCDEFGH'),
      env: {
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      },
      params: { id: 'ABCDEFGH' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ scoreTestMode: true });
    expect(mocks.findVisiblePublicBoard).toHaveBeenCalledWith(
      expect.anything(),
      'ABCDEFGH',
      expect.objectContaining({
        snapshot: expect.stringContaining('score_test_mode'),
      }),
    );
  });
});
