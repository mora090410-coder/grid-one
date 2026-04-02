import React from 'react';

interface RecoveryModalProps {
    email: string;
    onEmailChange: (email: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
    isRecovering: boolean;
}

const RecoveryModal: React.FC<RecoveryModalProps> = ({ email, onEmailChange, onSubmit, onClose, isRecovering }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-white/20">
            <form onSubmit={onSubmit} className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Recover Board ID</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <p className="text-[11px] text-gray-400 leading-tight">Enter the email you used during setup.</p>
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">Email Address</label>
                    <input
                        autoFocus
                        type="email"
                        value={email}
                        onChange={(e) => onEmailChange(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-white/40 outline-none"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isRecovering}
                    className="w-full btn-secondary py-2 rounded text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-50"
                >
                    {isRecovering ? 'Sending...' : 'Send Recovery Email'}
                </button>
            </form>
        </div>
    </div>
);

export default RecoveryModal;
