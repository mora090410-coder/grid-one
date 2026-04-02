import React from 'react';
import InfoCards from '../InfoCards';
import { GameState, BoardData, LiveGameData, WinnerHighlights } from '../../types';

interface PayoutsModalProps {
    game: GameState;
    board: BoardData;
    live: LiveGameData | null;
    liveStatus: string;
    lastUpdated: string;
    highlights: WinnerHighlights;
    onClose: () => void;
}

const PayoutsModal: React.FC<PayoutsModalProps> = ({ game, board, live, liveStatus, lastUpdated, highlights, onClose }) => (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg mx-4 mb-0 md:mb-0 max-h-[80vh] overflow-y-auto bg-surface border border-white/10 rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
            <div className="sticky top-0 z-10 bg-surface p-4 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Payouts</h3>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                    <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="p-4">
                <InfoCards.PayoutsAccordion
                    liveStatus={liveStatus}
                    lastUpdated={lastUpdated}
                    highlights={highlights}
                    board={board}
                    live={live}
                    game={game}
                />
            </div>
        </div>
    </div>
);

export default PayoutsModal;
