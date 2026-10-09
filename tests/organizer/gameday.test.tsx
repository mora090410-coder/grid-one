import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameState, LiveGameData, NotificationDeliveryIssue, WinnerResolution } from '../../types';
import type { MilestoneCorrectionDraft } from '../../src/features/organizer/services/corrections/milestoneCorrectionService';

const rpc = vi.fn(async (..._args: unknown[]) => ({ error: null as { message: string } | null }));
vi.mock('../../services/supabase', () => ({
  supabase: {
    rpc: (name: string, args: unknown) => rpc(name, args),
  },
}));

import SharePanel from '../../src/features/organizer/workspace/gameday/SharePanel';
import ScoreAuthorityCard from '../../src/features/organizer/workspace/gameday/ScoreAuthorityCard';
import CorrectionsCard from '../../src/features/organizer/workspace/gameday/CorrectionsCard';
import DeliveryIssuesCard from '../../src/features/organizer/workspace/gameday/DeliveryIssuesCard';
import FinalRecordCard from '../../src/features/organizer/workspace/gameday/FinalRecordCard';
import { renamePublishedSquare } from '../../src/features/organizer/workspace/renamePublishedSquare';

const baseGame = (overrides: Partial<GameState> = {}): GameState => ({
  title: 'Week One',
  meta: '',
  leftAbbr: 'CHI',
  leftName: 'Chicago Bears',
  topAbbr: 'GB',
  topName: 'Green Bay Packers',
  dates: '2026-09-13',
  lockTitle: false,
  lockMeta: false,
  ...overrides,
});

const winnerHistory: WinnerResolution[] = [
  {
    milestone: 'Q1',
    sideScore: 7,
    topScore: 3,
    sideDigit: 7,
    topDigit: 3,
    participantName: 'Alex P.',
    resolvedAt: '2026-09-13T18:00:00Z',
    resolutionVersion: 1,
  },
  {
    milestone: 'Q2',
    sideScore: 14,
    topScore: 10,
    sideDigit: 4,
    topDigit: 0,
    participantName: null,
    openSquare: true,
    resolvedAt: '2026-09-13T19:00:00Z',
    resolutionVersion: 1,
  },
];

describe('SharePanel', () => {
  it('starts idle, copies the link, and shows the copied state', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const onOpenViewer = vi.fn();

    render(<SharePanel shareUrl="https://gridone.app/b/abc123" onOpenViewer={onOpenViewer} />);

    expect(screen.getByText('Public board')).toBeVisible();
    expect(screen.getByText('https://gridone.app/b/abc123')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith('https://gridone.app/b/abc123');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Open public board' }));
    expect(onOpenViewer).toHaveBeenCalledOnce();
  });

  it('shows an error state when the clipboard is unavailable', async () => {
    Object.assign(navigator, { clipboard: undefined });
    render(<SharePanel shareUrl="https://gridone.app/b/abc123" onOpenViewer={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The link could not be copied. Select the address above and copy it manually.');
  });
});

describe('ScoreAuthorityCard', () => {
  it('shows the manual authority line and the manual scoring panel', () => {
    render(
      <ScoreAuthorityCard
        game={baseGame({ useManualScores: true, manualGameState: 'in', manualPeriod: 1 })}
        liveData={null}
        scoreSaveStatus="idle"
        isActivated
        onEnableAutomaticScoring={vi.fn()}
        onEnableManualScoring={vi.fn()}
        onUpdateManualGameState={vi.fn()}
        onUpdateManualPeriod={vi.fn()}
        onUpdateManualQuarter={vi.fn()}
        onSaveManualScore={vi.fn()}
      />,
    );

    expect(screen.getByText('Score authority')).toBeVisible();
    expect(screen.getByText('Manual scoring authority')).toBeVisible();
    expect(screen.getByText('Live Scoring')).toBeVisible();
    expect(screen.getByLabelText('Game Status')).toHaveValue('in');
  });

  it('shows the automatic authority line and the current live score when not activated for manual', () => {
    const liveData: LiveGameData = {
      leftScore: 14,
      topScore: 7,
      quarterScores: { Q1: { left: 7, top: 0 }, Q2: { left: 7, top: 7 }, Q3: { left: 0, top: 0 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } },
      clock: '12:00',
      period: 2,
      state: 'in',
      detail: '',
      isOvertime: false,
    };
    render(
      <ScoreAuthorityCard
        game={baseGame({ useManualScores: false })}
        liveData={liveData}
        scoreSaveStatus="idle"
        isActivated={false}
        onEnableAutomaticScoring={vi.fn()}
        onEnableManualScoring={vi.fn()}
        onUpdateManualGameState={vi.fn()}
        onUpdateManualPeriod={vi.fn()}
        onUpdateManualQuarter={vi.fn()}
        onSaveManualScore={vi.fn()}
      />,
    );

    expect(screen.getByText('Automatic scoring authority')).toBeVisible();
    expect(screen.getByText('14 – 7')).toBeVisible();
    expect(screen.getByText('Every published board gets the full game-day experience.')).toBeVisible();
  });

  it('shows the score source and the retrieved time under the numeral', () => {
    const retrievedAt = new Date('2026-09-13T18:12:00Z');
    const liveData: LiveGameData = {
      leftScore: 14,
      topScore: 7,
      quarterScores: { Q1: { left: 7, top: 0 }, Q2: { left: 7, top: 7 }, Q3: { left: 0, top: 0 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } },
      clock: '12:00',
      period: 2,
      state: 'in',
      detail: '',
      isOvertime: false,
      sourceName: 'ESPN',
      retrievedAt: retrievedAt.toISOString(),
      freshness: 'fresh',
    };
    render(
      <ScoreAuthorityCard
        game={baseGame({ useManualScores: false })}
        liveData={liveData}
        scoreSaveStatus="idle"
        isActivated={false}
        onEnableAutomaticScoring={vi.fn()}
        onEnableManualScoring={vi.fn()}
        onUpdateManualGameState={vi.fn()}
        onUpdateManualPeriod={vi.fn()}
        onUpdateManualQuarter={vi.fn()}
        onSaveManualScore={vi.fn()}
      />,
    );

    const clock = retrievedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    expect(screen.getByText(`ESPN · Checked ${clock}`)).toBeVisible();
  });

  it('says the score is unavailable in words when there is no snapshot', () => {
    render(
      <ScoreAuthorityCard
        game={baseGame({ useManualScores: false })}
        liveData={null}
        scoreSaveStatus="idle"
        isActivated={false}
        onEnableAutomaticScoring={vi.fn()}
        onEnableManualScoring={vi.fn()}
        onUpdateManualGameState={vi.fn()}
        onUpdateManualPeriod={vi.fn()}
        onUpdateManualQuarter={vi.fn()}
        onSaveManualScore={vi.fn()}
      />,
    );

    expect(screen.getByText('Score unavailable · Checked time unavailable')).toBeVisible();
  });
});

describe('CorrectionsCard', () => {
  it('enables Publish correction only once a milestone is selected and a reason is entered', () => {
    let draft: MilestoneCorrectionDraft | null = null;
    const onDraftChange = vi.fn((next: MilestoneCorrectionDraft | null) => { draft = next; });
    const onPublishCorrection = vi.fn();

    const { rerender } = render(
      <CorrectionsCard winnerHistory={winnerHistory} draft={draft} pending={false} onDraftChange={onDraftChange} onPublishCorrection={onPublishCorrection} />,
    );

    expect(screen.getByRole('button', { name: 'Publish correction and email both people' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Result to correct'), { target: { value: 'Q1' } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ milestone: 'Q1', sideScore: 7, topScore: 3 }));

    rerender(
      <CorrectionsCard winnerHistory={winnerHistory} draft={draft} pending={false} onDraftChange={onDraftChange} onPublishCorrection={onPublishCorrection} />,
    );
    expect(screen.getByText(/Current winner: Alex P\./)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publish correction and email both people' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Why this changed (shown publicly)'), { target: { value: 'Scoreboard operator error' } });
    rerender(
      <CorrectionsCard winnerHistory={winnerHistory} draft={draft} pending={false} onDraftChange={onDraftChange} onPublishCorrection={onPublishCorrection} />,
    );
    expect(screen.getByRole('button', { name: 'Publish correction and email both people' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Publish correction and email both people' }));
    expect(onPublishCorrection).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Correct without notifying' }));
    expect(onPublishCorrection).toHaveBeenLastCalledWith(false);
    expect(screen.getByText(/sends no email/)).toBeVisible();
  });

  it('shows the milestone history using the milestone label', () => {
    render(<CorrectionsCard winnerHistory={winnerHistory} draft={null} onDraftChange={vi.fn()} onPublishCorrection={vi.fn()} />);
    expect(screen.getByText(/Q1: Alex P\./)).toBeVisible();
    expect(screen.getByText(/Halftime: OPEN/)).toBeVisible();
  });
});

describe('DeliveryIssuesCard', () => {
  it('renders nothing when there are no issues', () => {
    const { container } = render(<DeliveryIssuesCard issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the heading and one line per issue when issues exist', () => {
    const issues: NotificationDeliveryIssue[] = [
      { id: '1', notificationKind: 'winner', milestone: 'Q1', attemptCount: 3, error: 'Bounced', terminalAt: '2026-09-13T20:00:00Z' },
    ];
    render(<DeliveryIssuesCard issues={issues} />);
    expect(screen.getByText('Review delivery issue')).toBeVisible();
    expect(screen.getByText(/Q1 —/)).toBeVisible();
    expect(screen.getByText(/Bounced/)).toBeVisible();
  });
});

describe('FinalRecordCard', () => {
  it('shows the locked-record copy, milestone rows, and a link to create another board', () => {
    render(<FinalRecordCard winnerHistory={winnerHistory} />);
    expect(screen.getByText('This board is locked as the Final record.')).toBeVisible();
    expect(screen.getByText(/Q1 · Alex P\./)).toBeVisible();
    expect(screen.getByText(/Halftime · Open square/)).toBeVisible();
    const link = screen.getByRole('link', { name: 'Create another board' });
    expect(link).toHaveAttribute('href', '/create');
  });
});

describe('renamePublishedSquare', () => {
  it('calls the rename RPC with the exact args', async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await renamePublishedSquare('pool-1', 4, 'Jordan');
    expect(rpc).toHaveBeenCalledWith('gridone_rename_published_square', {
      p_contest_id: 'pool-1',
      p_cell_index: 4,
      p_new_name: 'Jordan',
    });
  });

  it('throws when the rpc reports an error', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'nope' } });
    await expect(renamePublishedSquare('pool-1', 4, 'Jordan')).rejects.toThrow('nope');
  });
});
