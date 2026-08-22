import React from 'react';

export interface FindSquaresEntryProps {
  selectedPlayer: string;
  onFindSquares: () => void;
  onClearPlayer: () => void;
}

const FindSquaresEntry: React.FC<FindSquaresEntryProps> = ({ selectedPlayer, onFindSquares, onClearPlayer }) => (
  <section className="py-5" aria-label="Find squares">
    <button
      type="button"
      className="oa-btn oa-btn-primary w-full min-h-11 px-5 py-3 text-base"
      style={{ minHeight: 44 }}
      onClick={onFindSquares}
    >
      Find my squares
    </button>
    {selectedPlayer ? (
      <div className="mt-3 flex items-center justify-between gap-3 border border-broadcast-white/20 p-3" aria-live="polite">
        <span className="oa-body text-broadcast-white">Selected: <strong>{selectedPlayer}</strong></span>
        <button type="button" className="oa-slab min-h-11 px-3 text-broadcast-white/75 underline" style={{ minHeight: 44 }} onClick={onClearPlayer}>Clear</button>
      </div>
    ) : (
      <p className="oa-body mt-3 text-sm text-broadcast-white/70">Select the organizer-entered name to highlight squares and possible next results.</p>
    )}
  </section>
);

export default FindSquaresEntry;
