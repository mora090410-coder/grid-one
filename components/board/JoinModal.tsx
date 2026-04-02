import React from 'react';

interface JoinModalProps {
    joinInput: string;
    onJoinInputChange: (value: string) => void;
    onSubmit: (gameCode: string) => void;
    onClose: () => void;
    isJoining: boolean;
    showCommissionerEntry: boolean;
}

const JoinModal: React.FC<JoinModalProps> = ({
    joinInput,
    onJoinInputChange,
    onSubmit,
    onClose,
    isJoining,
    showCommissionerEntry,
}) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-white/20">
            <form onSubmit={(e) => { e.preventDefault(); onSubmit(joinInput); }} className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Join Game</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Enter the Game Code shared by your Commissioner.</p>
                <input
                    autoFocus
                    type="text"
                    value={joinInput}
                    onChange={(e) => onJoinInputChange(e.target.value)}
                    placeholder="Game Code"
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-white/40 outline-none font-mono uppercase"
                />
                <button
                    type="submit"
                    disabled={isJoining}
                    className="w-full btn-cardinal py-3 rounded text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-50"
                >
                    {isJoining ? 'Verifying...' : (showCommissionerEntry ? 'Enter Commissioner Hub' : 'Enter Stadium')}
                </button>
            </form>
        </div>
    </div>
);

export default JoinModal;
