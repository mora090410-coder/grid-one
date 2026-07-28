import { describe, expect, it } from 'vitest';
import {
  milestoneScores,
  deliveryIsActivelySending,
  resolutionParticipantName,
  toPublicWinnerHistory,
} from '../functions/_lib/winnerNotifications';

const snapshot = (period: number, gameState: 'pre' | 'in' | 'post') => ({
  period,
  game_state: gameState,
  side_score: 27,
  top_score: 24,
  quarter_scores: {
    Q1: { left: 7, top: 3 },
    Q2: { left: 10, top: 7 },
    Q3: { left: 3, top: 7 },
    Q4: { left: 7, top: 7 },
    OT: { left: 0, top: 0 },
  },
});

describe('winner notification milestones', () => {
  it('does not resolve a quarter before it ends', () => {
    expect(milestoneScores(snapshot(1, 'in'))).toEqual([]);
  });

  it('uses cumulative scores at completed quarter boundaries', () => {
    expect(milestoneScores(snapshot(3, 'in'))).toEqual([
      { milestone: 'Q1', side: 7, top: 3 },
      { milestone: 'Q2', side: 17, top: 10 },
    ]);
  });

  it('resolves all milestones from the final score', () => {
    expect(milestoneScores(snapshot(4, 'post'))).toEqual([
      { milestone: 'Q1', side: 7, top: 3 },
      { milestone: 'Q2', side: 17, top: 10 },
      { milestone: 'Q3', side: 20, top: 17 },
      { milestone: 'FINAL', side: 27, top: 24 },
    ]);
  });

  it('publishes immutable resolution records without recomputing from the latest score', () => {
    expect(toPublicWinnerHistory([{
      milestone: 'Q2',
      side_digit: 7,
      top_digit: 0,
      resolved_at: '2026-09-13T19:15:00.000Z',
      contest_participants: { display_name: 'Parent A' },
    }])).toEqual([{
      milestone: 'Q2',
      sideDigit: 7,
      topDigit: 0,
      participantName: 'Parent A',
      resolvedAt: '2026-09-13T19:15:00.000Z',
    }]);
  });

  it('uses the canonical resolution participant for notification retries', () => {
    const resolution = {
      contest_participants: { display_name: 'Original Winner' },
    };
    expect(resolutionParticipantName(resolution)).toBe('Original Winner');
  });

  it('retries a delivery whose sending lease expired', () => {
    const now = new Date('2026-09-13T20:00:00.000Z').getTime();
    expect(deliveryIsActivelySending({
      status: 'sending',
      last_attempted_at: '2026-09-13T19:59:00.000Z',
    }, now)).toBe(true);
    expect(deliveryIsActivelySending({
      status: 'sending',
      last_attempted_at: '2026-09-13T19:50:00.000Z',
    }, now)).toBe(false);
  });
});
