import React, { useState } from 'react';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';

interface ShareModalProps {
    shareUrl: string;
    onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ shareUrl, onClose }) => {
    const [copyFeedback, setCopyFeedback] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="premium-glass w-full max-w-sm p-6 text-center flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                <h2 className="text-lg font-semibold text-white tracking-tight">Share link</h2>
                <div className="bg-white p-4 rounded-xl shadow-lg">
                    <QRCodeSVG value={shareUrl} size={160} />
                </div>
                <div className="bg-black/20 border border-white/5 rounded-lg p-3 flex items-center gap-3 w-full">
                    <div className="flex-1 text-xs font-mono text-gray-400 truncate text-left">{shareUrl}</div>
                    <button
                        onClick={handleCopy}
                        className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        {copyFeedback ? 'Copied' : 'Copy'}
                    </button>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight px-4">
                    <span className="font-bold text-white/60">Note:</span> This link gives{' '}
                    <span className="text-white/60">read-only access</span> to viewers. Organizers keep edit access inside their GridOne account.
                </p>
                <button onClick={onClose} className="w-full btn-secondary text-sm">Close</button>
            </div>
        </div>
    );
};

export default ShareModal;
