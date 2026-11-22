import React from 'react';
import { CapsuleButton, CapsuleTag, Eyebrow } from '../../../design/primitives';

export interface FindSquaresEntryProps {
  selectedPlayer: string;
  squareNumbers?: number[];
  onFindSquares: () => void;
  onClearPlayer: () => void;
}

const FindSquaresEntry: React.FC<FindSquaresEntryProps> = ({ selectedPlayer, squareNumbers = [], onFindSquares, onClearPlayer }) => (
  <section className="flex flex-col gap-3" aria-label="Find squares">
    <div className="flex flex-wrap items-center justify-between gap-3">
      {selectedPlayer && (
        <div className="flex flex-col gap-1" aria-live="polite">
          <Eyebrow>Selected name</Eyebrow>
          <CapsuleTag tone="turf">{selectedPlayer}</CapsuleTag>
          {squareNumbers.length > 0 && <p className="font-ui text-sm text-fg-2 break-words">{squareNumbers.length} {squareNumbers.length === 1 ? 'square' : 'squares'} · {squareNumbers.slice(0, 10).join(', ')}{squareNumbers.length > 10 ? ` (+${squareNumbers.length - 10} more)` : ''}</p>}
        </div>
      )}
      <div className={`flex flex-wrap items-center gap-2${selectedPlayer ? '' : ' w-full'}`}>
        {/* A single persistent opener lets the picker restore keyboard focus
            even when choosing a name changes this button's label. Keep its
            press ripple contained while the primary button becomes quiet. */}
        <CapsuleButton variant={selectedPlayer ? 'quiet' : 'primary'} size={selectedPlayer ? 'md' : 'lg'} className={`relative overflow-hidden${selectedPlayer ? '' : ' w-full'}`} onClick={onFindSquares}>
          {selectedPlayer ? 'Choose another name' : 'Find my squares'}
        </CapsuleButton>
        {selectedPlayer && <CapsuleButton variant="ghost" onClick={onClearPlayer}>Clear</CapsuleButton>}
      </div>
    </div>
    {!selectedPlayer && <p className="font-ui text-[14px] text-fg-3">Pick your name to see your squares.</p>}
  </section>
);

export default FindSquaresEntry;
