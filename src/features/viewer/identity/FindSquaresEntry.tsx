import React from 'react';
import { CapsuleButton, CapsuleTag, Eyebrow } from '../../../design/primitives';

export interface FindSquaresEntryProps {
  selectedPlayer: string;
  onFindSquares: () => void;
  onClearPlayer: () => void;
}

const FindSquaresEntry: React.FC<FindSquaresEntryProps> = ({ selectedPlayer, onFindSquares, onClearPlayer }) => (
  <section className="flex flex-col gap-3" aria-label="Find squares">
    {selectedPlayer ? (
      <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <div className="flex flex-col gap-1">
          <Eyebrow>Selected name</Eyebrow>
          <CapsuleTag tone="turf">{selectedPlayer}</CapsuleTag>
        </div>
        <div className="flex items-center gap-2">
          <CapsuleButton variant="quiet" onClick={onFindSquares}>Choose another name</CapsuleButton>
          <CapsuleButton variant="ghost" onClick={onClearPlayer}>Clear</CapsuleButton>
        </div>
      </div>
    ) : (
      <>
        <CapsuleButton size="lg" className="w-full" onClick={onFindSquares}>Find my squares</CapsuleButton>
        <p className="font-ui text-[14px] text-fg-3">Pick your name to see your squares.</p>
      </>
    )}
  </section>
);

export default FindSquaresEntry;
