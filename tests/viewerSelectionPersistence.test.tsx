import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ pool: {} as any }));
vi.mock('../hooks/usePoolData', () => ({ usePoolData: () => m.pool, INITIAL_GAME: {} }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('../hooks/useContestEntries', () => ({ useContestEntries: () => ({ entryMetaByIndex: {}, hasLoadedEntries: true, setEntryMetaByIndex: vi.fn() }) }));
vi.mock('../hooks/useBoardActions', () => ({ useBoardActions: () => ({ handlePublish: vi.fn() }) }));
vi.mock('../hooks/useLiveScoring', () => ({ useLiveScoring: () => ({ liveData: null, winnerHistory: [], pendingMilestones: [], liveStatus: 'idle' }) }));
vi.mock('../services/supabase', () => ({ supabase: { channel: vi.fn(), removeChannel: vi.fn() } }));
vi.mock('../src/features/viewer/shell/ViewerShell', () => ({
  default: ({ selectedPlayer, onFindSquares, onClearPlayer }: any) => (
    <main>
      <p>Selected: {selectedPlayer || 'nobody'}</p>
      <button type="button" onClick={onFindSquares}>Find my squares</button>
      <button type="button" onClick={onClearPlayer}>Clear</button>
    </main>
  ),
}));
vi.mock('../components/board/FindSquaresModal', () => ({
  default: ({ board, onSelectPlayer, onClose }: any) => (
    <div role="dialog" aria-label="Find my squares">
      {[...new Set<string>(board.squares.flat())].map((name) => (
        <button key={name} type="button" onClick={() => { onSelectPlayer(name); onClose(); }}>{`Pick ${name}`}</button>
      ))}
    </div>
  ),
}));
import BoardView from '../components/BoardView';

const KEY = 'gridone:find-squares:ABCDEFGH';
const squaresFor = (names: string[]) => Array.from({ length: 100 }, (_, index) => (names[index] ? [names[index]] : []));
const setBoard = (names: string[], participants?: Array<{ id: string; displayName: string; publicLabel: string }>) => {
  m.pool.board = {
    leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    squares: squaresFor(names),
    ...(participants ? { participants } : {}),
  };
};
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');
const show = () => render(<MemoryRouter initialEntries={['/b/ABCDEFGH']}><Routes><Route path="/b/:shareCode" element={<BoardView />} /></Routes></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  m.pool = {
    game: { title: 'Published board' }, activePoolId: 'ABCDEFGH', shareCode: 'ABCDEFGH', ownerId: null,
    loadingPool: false, dataReady: true, isShared: false, isPublished: true, isActivated: true, isLocked: false,
    winnerHistory: [], pendingMilestones: [], loadPoolData: vi.fn(), setBoard: vi.fn(), setGame: vi.fn(),
  };
  setBoard(['Ann', 'Bob']);
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Find my squares selection storage', () => {
  it('restores a version 1 selection on a board without participants and rewrites it as version 2', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, displayName: 'Bob' }));
    show();
    expect(screen.getByText('Selected: Bob')).toBeInTheDocument();
    expect(stored()).toEqual({ version: 2, participantId: null, displayName: 'Bob' });
  });

  it('migrates a version 1 selection to the one participant with that name', () => {
    setBoard(['Ann', 'Anna'], [
      { id: 'participant-ann', displayName: 'Ann', publicLabel: 'AN' },
      { id: 'participant-anna', displayName: 'Anna', publicLabel: 'AN' },
    ]);
    localStorage.setItem(KEY, JSON.stringify({ version: 1, displayName: 'Ann' }));
    show();
    expect(screen.getByText('Selected: Ann')).toBeInTheDocument();
    expect(stored()).toEqual({ version: 2, participantId: 'participant-ann', displayName: 'Ann' });
  });

  it('drops a version 1 selection whose name left the board', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, displayName: 'Carla' }));
    show();
    expect(screen.getByText('Selected: nobody')).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('keeps the saved person when two participants share a display name', () => {
    const joses = [
      { id: 'jose-1', displayName: 'Jose', publicLabel: 'JO' },
      { id: 'jose-2', displayName: 'Jose', publicLabel: 'JO2' },
    ];
    setBoard(['Jose', 'Jose'], joses);
    localStorage.setItem(KEY, JSON.stringify({ version: 2, participantId: 'jose-2', displayName: 'Jose' }));
    show();
    expect(screen.getByText('Selected: Jose')).toBeInTheDocument();
    expect(stored()).toEqual({ version: 2, participantId: 'jose-2', displayName: 'Jose' });

    // Re-picking the same name keeps that person rather than guessing.
    fireEvent.click(screen.getByRole('button', { name: 'Find my squares' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick Jose' }));
    expect(stored()).toEqual({ version: 2, participantId: 'jose-2', displayName: 'Jose' });
  });

  it('saves a new pick as version 2 and removes it on clear', () => {
    setBoard(['Ann', 'Bob'], [
      { id: 'participant-ann', displayName: 'Ann', publicLabel: 'AN' },
      { id: 'participant-bob', displayName: 'Bob', publicLabel: 'BO' },
    ]);
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Find my squares' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick Bob' }));
    expect(screen.getByText('Selected: Bob')).toBeInTheDocument();
    expect(stored()).toEqual({ version: 2, participantId: 'participant-bob', displayName: 'Bob' });

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Selected: nobody')).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('keeps working for this visit when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    show();
    expect(screen.getByText('Selected: nobody')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Find my squares' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pick Ann' }));
    expect(screen.getByText('Selected: Ann')).toBeInTheDocument();
    expect(setItem).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Selected: nobody')).toBeInTheDocument();
  });
});
