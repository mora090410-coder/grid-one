import React, { useRef, useState } from 'react';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface ShareModalProps {
    shareUrl: string;
    onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ shareUrl, onClose }) => {
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(dialogRef, onClose);

    const handleCopy = async () => {
        setCopyStatus('copying');
        try {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
            await navigator.clipboard.writeText(shareUrl);
            setCopyStatus('copied');
            window.setTimeout(() => setCopyStatus('idle'), 2000);
        } catch {
            setCopyStatus('error');
        }
    };

    return (
        <div className="oa-root fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 p-4">
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" className="bg-broadcast-white ring-[3px] ring-ink w-full max-w-sm p-6 text-center flex flex-col items-center gap-4">
                <h2 id="share-dialog-title" className="oa-headline !text-lg text-ink">Share link</h2>
                <div className="bg-broadcast-white ring-1 ring-ink p-4">
                    <QRCodeSVG value={shareUrl} size={160} />
                </div>
                <div className="bg-newsprint p-3 flex items-center gap-3 w-full">
                    <div className="flex-1 oa-data text-xs text-ink/70 truncate text-left">{shareUrl}</div>
                    <button
                        onClick={handleCopy}
                        disabled={copyStatus === 'copying'}
                        className="oa-btn oa-btn-primary !px-4 !py-2"
                    >
                        {copyStatus === 'copying' ? 'Copying…' : copyStatus === 'copied' ? 'Copied' : 'Copy'}
                    </button>
                </div>
                {copyStatus === 'error' && (
                    <p className="oa-body text-[13px] text-cardinal" role="alert">
                        The link could not be copied. Select the address above and copy it manually.
                    </p>
                )}
                {copyStatus === 'copied' && <span className="sr-only" role="status">Viewer link copied.</span>}
                <p className="oa-body text-[13px] text-ink/70 leading-tight px-4">
                    <span className="font-bold text-ink">Note:</span> This link gives{' '}
                    <span className="text-ink">read-only access</span> to viewers. Organizers keep edit access inside their GridOne account.
                </p>
                <button onClick={onClose} className="oa-btn oa-btn-ghost w-full">Close</button>
            </div>
        </div>
    );
};

export default ShareModal;
