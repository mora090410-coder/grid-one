import React from 'react';
import { useNavigate } from 'react-router-dom';

interface PaywallModalProps {
    onClose: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ onClose }) => {
    const navigate = useNavigate();

    const handleLogin = () => {
        navigate('/login?mode=signup&returnUrl=/board');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-[#1c1c1e] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-center overflow-hidden">

                {/* Background Glow */}
                <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-[#FFC72C]/20 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-6">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#9D2235] to-[#7f1d2b] flex items-center justify-center shadow-lg shadow-red-900/40">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-white tracking-tight">Unlock Your Board</h2>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Pay <b>$14.99</b> to <b>Save</b> your board, <b>Share</b> with friends, and get <b>Live Updates</b> during the game.
                        </p>
                    </div>

                    <div className="space-y-3 pt-2">
                        <button
                            onClick={handleLogin}
                            className="w-full py-3.5 rounded-xl bg-[#FFC72C] text-black font-bold text-sm uppercase tracking-wider hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                        >
                            Pay $14.99 to Unlock Board
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 rounded-xl text-gray-500 font-bold text-xs uppercase tracking-wider hover:text-white hover:bg-white/5 transition-all"
                        >
                            Keep Editing Locally
                        </button>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <div className="flex justify-center gap-4 text-[10px] text-gray-600 font-medium uppercase tracking-widest">
                            <span>Cloud Save</span> • <span>Live Sync</span> • <span>Sharing</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
