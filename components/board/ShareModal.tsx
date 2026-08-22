import React, { useState } from 'react';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';
import { ActionButton } from '../primitives/ActionButton';
import { Dialog } from '../primitives/Dialog';

interface ShareModalProps {
    shareUrl: string;
    onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ shareUrl, onClose }) => {
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');

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
        <Dialog titleId="share-dialog-title" onClose={onClose} overlayClassName="z-[100]" placement="center" panelClassName="max-w-sm p-6 text-center flex flex-col items-center gap-4">
                <h2 id="share-dialog-title" className="oa-headline !text-lg text-ink">Share link</h2>
                <div className="bg-broadcast-white ring-1 ring-ink p-4">
                    <QRCodeSVG value={shareUrl} size={160} />
                </div>
                <div className="bg-newsprint p-3 flex items-center gap-3 w-full">
                    <div className="flex-1 oa-data text-xs text-ink/70 truncate text-left">{shareUrl}</div>
                    <ActionButton
                        onClick={handleCopy}
                        busy={copyStatus === 'copying'}
                        className="!px-4 !py-2"
                    >
                        {copyStatus === 'copying' ? 'Copying…' : copyStatus === 'copied' ? 'Copied' : 'Copy'}
                    </ActionButton>
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
                <ActionButton variant="ghost" onClick={onClose} fullWidth>Close</ActionButton>
        </Dialog>
    );
};

export default ShareModal;
