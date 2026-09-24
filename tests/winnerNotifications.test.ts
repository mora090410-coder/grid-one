import { describe, expect, it } from 'vitest';
import {
  deliveryIsActivelySending,
  resolutionParticipantName,
  toPublicWinnerHistory,
} from '../functions/_lib/winnerNotifications';

describe('winner notification milestones', () => {
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
