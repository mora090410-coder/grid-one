import { describe, expect, it } from 'vitest';
import {
  distinctAssignedNames,
  matchPlayerNames,
  normalizePlayerName,
} from '../utils/playerNameMatching';

describe('player name matching', () => {
  it('normalizes case, accents, punctuation, and repeated whitespace', () => {
    expect(normalizePlayerName('  MÍKE   S. ')).toBe('mike s');
    expect(normalizePlayerName('D’Ángelo-Sr.')).toBe('dangelosr');
  });

  it('auto-selects only one exact normalized match', () => {
    expect(matchPlayerNames('mike s', ['Mike S.', 'Michael'])).toEqual({
      tier: 'exact',
      candidates: ['Mike S.'],
      autoSelect: 'Mike S.',
    });
  });

  it('leaves normalized collisions for the viewer to resolve', () => {
    expect(matchPlayerNames('jose', ['Jose', 'José'])).toEqual({
      tier: 'exact',
      candidates: ['Jose', 'José'],
      autoSelect: null,
    });
  });

  it('uses the first matching tier for the whole result set', () => {
    expect(matchPlayerNames('Ann', ['Ann', 'Ann Smith', 'Anna'])).toEqual({
      tier: 'exact',
      candidates: ['Ann'],
      autoSelect: 'Ann',
    });
    expect(matchPlayerNames('smith', ['Ann Smith', 'Bob Smith', 'Smithers'])).toEqual({
      tier: 'token',
      candidates: ['Ann Smith', 'Bob Smith'],
      autoSelect: null,
    });
  });

  it('surfaces substring suggestions for partial input without inferring nicknames', () => {
    expect(matchPlayerNames('ik', ['Mike S.', 'Michael']).candidates).toEqual(['Mike S.']);
    expect(matchPlayerNames('Michael', ['Mike S.'])).toEqual({
      tier: 'none',
      candidates: [],
      autoSelect: null,
    });
  });

  it('requires two characters for token and substring suggestions', () => {
    expect(matchPlayerNames('s', ['Mike S.'])).toEqual({
      tier: 'none',
      candidates: [],
      autoSelect: null,
    });
    expect(matchPlayerNames('S.', ['S.'])).toEqual({
      tier: 'exact',
      candidates: ['S.'],
      autoSelect: 'S.',
    });
  });

  it('deduplicates, trims, excludes empty labels, and sorts assigned names', () => {
    expect(distinctAssignedNames([
      [' Zoe ', ''],
      ['Ann'],
      ['Zoe'],
      [],
    ])).toEqual(['Ann', 'Zoe']);
  });
});
