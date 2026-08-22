import { describe, expect, it } from 'vitest';
import { resolveViewerIdentity, restoreViewerIdentitySelection, serializeViewerIdentitySelection } from '../features/viewer/identity/viewerIdentityModel';
import type { BoardData } from '../types';

const board = (participants: BoardData['participants']): BoardData => ({
  topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  squares: Array.from({ length: 100 }, () => []),
  participants,
});

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
});
