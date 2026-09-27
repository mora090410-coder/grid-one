import { describe, expect, it } from 'vitest';
import { KNOWN_TEAM_ABBRS, MIN_STRIPE_CONTRAST, STRIPE_SURFACE, canonicalTeamAbbr, contrastRatio, isGoldLike, teamStripeColor } from '../../src/features/viewer/teams/teamColors';

describe('team stripe colors', () => {
  it('covers all 32 teams and never picks a gold that could read as a winner', () => {
    expect(KNOWN_TEAM_ABBRS).toHaveLength(32);
    for (const team of KNOWN_TEAM_ABBRS) {
      const color = teamStripeColor(team);
      if (!color) continue;
      expect(isGoldLike(color), `${team} ${color}`).toBe(false);
      expect(contrastRatio(color, STRIPE_SURFACE), `${team} ${color}`).toBeGreaterThanOrEqual(MIN_STRIPE_CONTRAST);
    }
  });

  it('flags gold and yellow, and leaves reds, blues and silvers alone', () => {
    for (const gold of ['#FFB612', '#FFC20E', '#D3BC8D', '#FFA300', '#E3B33A']) expect(isGoldLike(gold), gold).toBe(true);
    for (const other of ['#C60C30', '#00338D', '#A5ACAF', '#FB4F14', '#69BE28']) expect(isGoldLike(other), other).toBe(false);
  });

  it('skips a team gold for its next color, and gives black-and-gold teams no stripe', () => {
    expect(teamStripeColor('LAC')).toBe('#0080C6');
    expect(teamStripeColor('BUF')).toBe('#00338D');
    expect(teamStripeColor('PIT')).toBeNull();
    expect(teamStripeColor('NO')).toBeNull();
  });

  it('reads provider aliases and ignores unknown teams', () => {
    expect(canonicalTeamAbbr('wsh')).toBe('WAS');
    expect(teamStripeColor('WSH')).toBe(teamStripeColor('WAS'));
    expect(teamStripeColor('HOME')).toBeNull();
    expect(teamStripeColor('')).toBeNull();
    expect(teamStripeColor(undefined)).toBeNull();
  });
});
