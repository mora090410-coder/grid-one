
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
    board.squares.forEach(names => {
      if (names.some(n => n.toLowerCase().includes(selected.toLowerCase()))) count++;
    });
    return { count, investment: count * 50 };
  }, [selected, board]);

  return (
    <div className="w-full flex items-center justify-between gap-4 px-4 py-2 liquid-glass border-none shadow-none bg-white/5 rounded-full">
      <div className="flex items-center gap-2 flex-1">
        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Find Player:</label>
        <div className="relative flex-1 max-w-xs">
          <select 
            value={selected} 
            onChange={(e) => setSelected(e.target.value)}
            className={`w-full bg-transparent border-none text-xs focus:ring-0 outline-none appearance-none font-bold ${selected ? 'text-gold' : 'text-white'}`}
          >
            <option value="">-- Show All --</option>
            {playerList.map(p => <option key={p} value={p} className="bg-black text-white">{p}</option>)}
          </select>
        </div>
        {selected && (
          <button onClick={() => setSelected('')} className="text-[10px] text-red-400 hover:text-red-300 uppercase font-bold">X</button>
        )}
      </div>
      
      {stats && (
        <div className="flex items-center gap-3 bg-cardinal-subtle px-3 py-1 rounded-full border border-gold-glass">
          <span className="text-[10px] text-white font-bold">{stats.count} SQUARES</span>
          <span className="w-px h-3 bg-white/20"></span>
          <span className="text-[10px] text-gold font-bold">${stats.investment}</span>
        </div>
      )}
    </div>
  );
};

export default PlayerFilter;
