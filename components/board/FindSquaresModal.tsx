import React from 'react';
import PlayerFilter from '../PlayerFilter';
import { BoardData } from '../../types';

interface FindSquaresModalProps {
    board: BoardData;
    selectedPlayer: string;
    onSelectPlayer: (player: string) => void;
    onClose: () => void;
}

const FindSquaresModal: React.FC<FindSquaresModalProps> = ({ board, selectedPlayer, onSelectPlayer, onClose }) => (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md mx-4 mb-0 md:mb-0 bg-surface border border-white/10 rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Find my squares</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                        <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className="w-full mt-4 py-2 text-sm font-medium text-white/50 hover:text-white transition-colors"
                    >
                        Clear selection
                    </button>
                )}
            </div>
        </div>
    </div>
);

export default FindSquaresModal;
