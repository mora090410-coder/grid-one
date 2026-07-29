
import React, { useMemo } from 'react';
import { BoardData } from '../types';

interface PlayerFilterProps {
  board: BoardData;
  selected: string;
  setSelected: (n: string) => void;
}

const PlayerFilter: React.FC<PlayerFilterProps> = ({ board, selected, setSelected }) => {
  const playerList = useMemo(() => {
    const set = new Set<string>();
    board.squares.forEach(names => {
      names.forEach(n => set.add(n));
    });
    return Array.from(set).sort();
  }, [board]);

  const stats = useMemo(() => {
    if (!selected) return null;
    let count = 0;
    const normalizedSelected = selected.trim().toLocaleLowerCase();
    board.squares.forEach(names => {
      if (names.some(n => n.trim().toLocaleLowerCase() === normalizedSelected)) count++;
    });
    return { count };
  }, [selected, board]);

  return (
    <div className="w-full flex items-center justify-between gap-4 px-4 py-2 bg-broadcast-white ring-1 ring-inset ring-ink">
      <div className="flex items-center gap-2 flex-1">
        <label htmlFor="player-filter" className="oa-slab text-ink/60 whitespace-nowrap">Find Player:</label>
        <div className="relative flex-1 max-w-xs">
          <select
            id="player-filter"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={`oa-data min-h-11 w-full bg-transparent border-none text-xs focus:ring-0 outline-none appearance-none font-bold ${selected ? 'text-cardinal' : 'text-ink'}`}
          >
            <option value="">-- Show All --</option>
            {playerList.map(p => <option key={p} value={p} className="bg-broadcast-white text-ink">{p}</option>)}
          </select>
        </div>
        {selected && (
          <button onClick={() => setSelected('')} className="oa-slab min-h-11 min-w-11 text-cardinal hover:text-cardinal-deep" aria-label="Clear player filter">X</button>
        )}
      </div>

      {stats && (
        <div className="flex items-center gap-3 bg-cardinal px-3 py-1">
          <span className="oa-slab text-broadcast-white">{stats.count} SQUARES</span>
        </div>
      )}
    </div>
  );
};

export default PlayerFilter;
