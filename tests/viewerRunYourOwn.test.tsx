import { describe, expect, it } from 'vitest';
import { runYourOwnInvitation } from '../src/features/viewer/shell/runYourOwnInvitation';

describe('run-your-own invitation on shared boards', () => {
  it('invites every non-owner viewer, before and during the game', () => {
    expect(runYourOwnInvitation({ demoMode: false, ownsBoard: false, gameState: null })).toBe('Running your own pool? Building a board is free.');
    expect(runYourOwnInvitation({ demoMode: false, ownsBoard: false, gameState: 'pre' })).toBe('Running your own pool? Building a board is free.');
    expect(runYourOwnInvitation({ demoMode: false, ownsBoard: false, gameState: 'in' })).toBe('Running your own pool? Building a board is free.');
  });
  it('keeps the existing final and demo wording', () => {
    expect(runYourOwnInvitation({ demoMode: false, ownsBoard: false, gameState: 'post' })).toBe('Bring your next game day together.');
    expect(runYourOwnInvitation({ demoMode: true, ownsBoard: false, gameState: 'in' })).toBe('This is a sample board. Ready to run yours?');
  });
  it('never shows to the board owner', () => {
    expect(runYourOwnInvitation({ demoMode: false, ownsBoard: true, gameState: 'post' })).toBeNull();
    expect(runYourOwnInvitation({ demoMode: false, ownsBoard: true, gameState: 'in' })).toBeNull();
  });
});
