import React, { useRef } from 'react';
import PlayerFilter from '../PlayerFilter';
import { BoardData } from '../../types';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface FindSquaresModalProps {
    board: BoardData;
    selectedPlayer: string;
    onSelectPlayer: (player: string) => void;
    onClose: () => void;
}

const FindSquaresModal: React.FC<FindSquaresModalProps> = ({ board, selectedPlayer, onSelectPlayer, onClose }) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(dialogRef, onClose);
    return (
    <div className="oa-root fixed inset-0 z-[90] flex items-end md:items-center justify-center">
        <button type="button" className="absolute inset-0 bg-ink/80 cursor-default" onClick={onClose} aria-label="Close Find my squares" />
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="find-squares-title" className="relative w-full max-w-md mx-4 mb-0 md:mb-0 bg-broadcast-white ring-[3px] ring-ink">
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 id="find-squares-title" className="oa-headline !text-lg text-ink">Find my squares</h3>
                    <button onClick={onClose} className="min-w-11 min-h-11 p-2 text-ink/60 hover:bg-newsprint transition-colors" aria-label="Close">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <PlayerFilter
                    board={board}
                    setSelected={(player) => { onSelectPlayer(player); onClose(); }}
                    selected={selectedPlayer}
                />
                {selectedPlayer && (
                    <button
                        onClick={() => { onSelectPlayer(''); onClose(); }}
                        className="oa-slab w-full min-h-11 mt-4 py-2 text-ink/50 hover:text-ink transition-colors"
                    >
                        Clear selection
                    </button>
                )}
            </div>
        </div>
    </div>
    );
};

export default FindSquaresModal;
