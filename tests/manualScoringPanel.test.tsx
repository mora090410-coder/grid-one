import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ManualScoringPanel } from '../features/organizer/game-day/ManualScoringPanel';
import type { GameState } from '../types';

const quarterScores = {
  Q1: { left: 3, top: 0 },
  Q2: { left: 6, top: 0 },
  Q3: { left: 3, top: 0 },
  Q4: { left: 17, top: 13 },
  OT: { left: 0, top: 0 },
};

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

describe('ManualScoringPanel', () => {
  it('preserves automatic authority copy and delegates deliberate manual enablement', () => {
    const onEnableManualScoring = vi.fn();
    render(
      <ManualScoringPanel
        isActivated
        game={baseGame({ useManualScores: false })}
        scoreSaveStatus="idle"
        onEnableAutomaticScoring={vi.fn()}
        onEnableManualScoring={onEnableManualScoring}
        onUpdateManualGameState={vi.fn()}
        onUpdateManualPeriod={vi.fn()}
        onUpdateManualQuarter={vi.fn()}
        onSaveManualScore={vi.fn()}
      />,
    );

    expect(screen.getByText('Automatic score checks are a beta convenience and always show their source and freshness. Switch to Manual whenever you want the organizer to be authoritative.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
    expect(onEnableManualScoring).toHaveBeenCalledOnce();
  });

  it('renders organizer-entered manual authority controls with unchanged validation and payload callbacks', () => {
    const onUpdateManualGameState = vi.fn();
    const onUpdateManualPeriod = vi.fn();
    const onUpdateManualQuarter = vi.fn();
    const onSaveManualScore = vi.fn();

    render(
      <ManualScoringPanel
        isActivated
        game={baseGame({
          useManualScores: true,
          manualGameState: 'in',
          manualPeriod: 2,
          manualQuarterScores: quarterScores,
        })}
        scoreSaveStatus="idle"
        onEnableAutomaticScoring={vi.fn()}
        onEnableManualScoring={vi.fn()}
        onUpdateManualGameState={onUpdateManualGameState}
        onUpdateManualPeriod={onUpdateManualPeriod}
        onUpdateManualQuarter={onUpdateManualQuarter}
        onSaveManualScore={onSaveManualScore}
      />,
    );

    expect(screen.getByText('Live Scoring')).toBeVisible();
    expect(screen.getByLabelText('Game Status')).toHaveValue('in');
    expect(screen.getByLabelText('Current Period')).toHaveValue('2');
    expect(screen.getByText("Enter each quarter's points (not running totals). Publishing a settled period confirms its result and queues verified winner notifications.")).toBeVisible();
    expect(screen.getByText('29')).toBeVisible();
    expect(screen.getByText('13')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Game Status'), { target: { value: 'post' } });
    expect(onUpdateManualGameState).toHaveBeenCalledWith('post');

    fireEvent.change(screen.getByLabelText('Current Period'), { target: { value: '5' } });
    expect(onUpdateManualPeriod).toHaveBeenCalledWith(5);

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '-4' } });
    expect(onUpdateManualQuarter).toHaveBeenCalledWith('Q1', 'left', 0);

    fireEvent.click(screen.getByRole('button', { name: 'Publish manual score' }));
    expect(onSaveManualScore).toHaveBeenCalledOnce();
  });

  it('preserves loading and scheduled/final disabled behavior', () => {
    const onEnableManualScoring = vi.fn();
    render(
      <ManualScoringPanel
        isActivated
        game={baseGame({ useManualScores: true, manualGameState: 'post', manualQuarterScores: quarterScores })}
        scoreSaveStatus="saving"
        onEnableAutomaticScoring={vi.fn()}
        onEnableManualScoring={onEnableManualScoring}
        onUpdateManualGameState={vi.fn()}
        onUpdateManualPeriod={vi.fn()}
        onUpdateManualQuarter={vi.fn()}
        onSaveManualScore={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Manual' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publishing score…' })).toBeDisabled();
    expect(screen.getByLabelText('Current Period')).toBeDisabled();
  });
});
