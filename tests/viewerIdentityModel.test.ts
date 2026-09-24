import { describe, expect, it } from 'vitest';
import { resolveViewerIdentity, restoreViewerIdentitySelection, selectViewerIdentity, serializeViewerIdentitySelection } from '../src/features/viewer/identity/viewerIdentityModel';
import type { BoardData } from '../types';

const board = (participants: BoardData['participants'], names: string[] = []): BoardData => ({
  topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  squares: Array.from({ length: 100 }, (_, index) => (names[index] ? [names[index]] : [])),
  ...(participants ? { participants } : {}),
});
const v1 = (displayName: string) => JSON.stringify({ version: 1, displayName });
const twoJoses = [
  { id: 'p1', displayName: 'Jose', publicLabel: 'JO' },
  { id: 'p2', displayName: 'Jose', publicLabel: 'JO2' },
];

describe('viewer identity model', () => {
  it('resolves durable participant id when available instead of trusting display labels', () => {
    const identity = resolveViewerIdentity(board([
      { id: 'p1', displayName: 'Jose', publicLabel: 'JO' },
      { id: 'p2', displayName: 'Jose', publicLabel: 'JO2' },
    ]), 'Jose', 'p2');
    expect(identity).toMatchObject({ status: 'resolved', participantId: 'p2', displayName: 'Jose', ambiguous: false });
  });

  it('marks duplicate display labels ambiguous and never silently picks a person', () => {
    const identity = resolveViewerIdentity(board([
      { id: 'p1', displayName: 'Jose', publicLabel: 'JO' },
      { id: 'p2', displayName: 'Jose', publicLabel: 'JO2' },
    ]), 'Jose');
    expect(identity.status).toBe('ambiguous');
    expect(identity.ambiguous).toBe(true);
    expect(identity.participantId).toBeNull();
  });

  it('restores only valid durable selections and clears invalid saved data with explanation', () => {
    const data = board([{ id: 'p1', displayName: 'Ann', publicLabel: 'AN' }]);
    const saved = serializeViewerIdentitySelection({ participantId: 'p1', displayName: 'Ann' });
    expect(restoreViewerIdentitySelection(data, saved)).toMatchObject({ action: 'restore', displayName: 'Ann', participantId: 'p1' });
    expect(restoreViewerIdentitySelection(data, JSON.stringify({ version: 1, displayName: 'Bob' }))).toMatchObject({
      action: 'clear',
      displayName: '',
      explanation: 'Saved viewer selection no longer matches this board.',
    });
  });

  describe('version 1 (display-name) selections from before participant ids', () => {
    it('migrates to the one participant with that display name', () => {
      const data = board([{ id: 'p1', displayName: 'Ann', publicLabel: 'AN' }, { id: 'p2', displayName: 'Anna', publicLabel: 'AN' }], ['Ann', 'Anna']);
      expect(restoreViewerIdentitySelection(data, v1('Ann'))).toEqual({ action: 'restore', participantId: 'p1', displayName: 'Ann' });
    });

    it('keeps the display-name selection on a board without participants', () => {
      const data = board(undefined, ['Ann', 'Bob']);
      expect(restoreViewerIdentitySelection(data, v1('Bob'))).toEqual({ action: 'restore', participantId: null, displayName: 'Bob' });
    });

    it('keeps the display-name selection when two participants share it, without picking one', () => {
      const data = board(twoJoses, ['Jose', 'Jose']);
      expect(restoreViewerIdentitySelection(data, v1('Jose'))).toEqual({ action: 'restore', participantId: null, displayName: 'Jose' });
    });

    it('clears a name that is no longer on the board', () => {
      expect(restoreViewerIdentitySelection(board(undefined, ['Ann']), v1('Bob'))).toMatchObject({ action: 'clear', participantId: null, displayName: '' });
    });

    it('clears malformed or unknown saved data', () => {
      const data = board(undefined, ['Ann']);
      for (const raw of ['{', 'null', JSON.stringify({ version: 1 }), JSON.stringify({ version: 3, displayName: 'Ann' }), JSON.stringify({ version: 2, participantId: 7, displayName: 'Ann' })]) {
        expect(restoreViewerIdentitySelection(data, raw)).toMatchObject({ action: 'clear', displayName: '' });
      }
    });
  });

  describe('version 2 selections', () => {
    it('tells two people with the same display name apart by participant id', () => {
      const data = board(twoJoses, ['Jose', 'Jose']);
      const saved = serializeViewerIdentitySelection({ participantId: 'p2', displayName: 'Jose' });
      expect(JSON.parse(saved)).toEqual({ version: 2, participantId: 'p2', displayName: 'Jose' });
      expect(restoreViewerIdentitySelection(data, saved)).toEqual({ action: 'restore', participantId: 'p2', displayName: 'Jose' });
    });

    it('never moves a stale participant id onto someone else with the same name', () => {
      const data = board([{ id: 'p3', displayName: 'Jose', publicLabel: 'JO' }], ['Jose']);
      const saved = serializeViewerIdentitySelection({ participantId: 'p1', displayName: 'Jose' });
      expect(restoreViewerIdentitySelection(data, saved)).toMatchObject({ action: 'clear', participantId: null, displayName: '' });
    });

    it('stores a display-name selection for boards without participants', () => {
      const data = board(undefined, ['Ann']);
      const saved = serializeViewerIdentitySelection({ participantId: null, displayName: 'Ann' });
      expect(JSON.parse(saved)).toEqual({ version: 2, participantId: null, displayName: 'Ann' });
      expect(restoreViewerIdentitySelection(data, saved)).toEqual({ action: 'restore', participantId: null, displayName: 'Ann' });
      expect(restoreViewerIdentitySelection(board(undefined, ['Bob']), saved)).toMatchObject({ action: 'clear' });
    });

    it('upgrades a display-name selection once the board lists that participant', () => {
      const data = board([{ id: 'p1', displayName: 'Ann', publicLabel: 'AN' }], ['Ann']);
      const saved = serializeViewerIdentitySelection({ participantId: null, displayName: 'Ann' });
      expect(restoreViewerIdentitySelection(data, saved)).toEqual({ action: 'restore', participantId: 'p1', displayName: 'Ann' });
    });
  });

  describe('selecting a name', () => {
    it('records the participant id when the name is unique', () => {
      const data = board([{ id: 'p1', displayName: 'Ann', publicLabel: 'AN' }], ['Ann']);
      expect(selectViewerIdentity(data, 'Ann')).toEqual({ participantId: 'p1', displayName: 'Ann' });
    });

    it('records no id for a shared name or a board without participants', () => {
      expect(selectViewerIdentity(board(twoJoses, ['Jose', 'Jose']), 'Jose')).toEqual({ participantId: null, displayName: 'Jose' });
      expect(selectViewerIdentity(board(undefined, ['Ann']), 'Ann')).toEqual({ participantId: null, displayName: 'Ann' });
    });

    it('keeps an already-resolved participant when the same name is chosen again', () => {
      const data = board(twoJoses, ['Jose', 'Jose']);
      expect(selectViewerIdentity(data, 'Jose', { participantId: 'p2', displayName: 'Jose' })).toEqual({ participantId: 'p2', displayName: 'Jose' });
    });

    it('clears to an empty selection', () => {
      expect(selectViewerIdentity(board(undefined, ['Ann']), '', { participantId: null, displayName: 'Ann' })).toEqual({ participantId: null, displayName: '' });
    });
  });
});
