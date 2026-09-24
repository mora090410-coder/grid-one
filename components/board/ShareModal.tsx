import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CapsuleButton, Sheet } from '../../src/design/primitives';

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
        <div data-base="dark">
            <Sheet open onClose={onClose} title="Share link" layer="raised">
                <div className="flex flex-col items-center gap-4">
                    <div className="rounded-card border border-hairline bg-broadcast-white p-4">
                        <QRCodeSVG value={shareUrl} size={160} />
                    </div>
                    <div className="flex w-full items-center gap-3 rounded-card border border-hairline bg-panel p-3">
                        <div className="min-w-0 flex-1 truncate text-left font-mono text-[12px] text-fg-2">{shareUrl}</div>
                        <CapsuleButton onClick={handleCopy} disabled={copyStatus === 'copying'} aria-busy={copyStatus === 'copying'}>
                            {copyStatus === 'copying' ? 'Copying…' : copyStatus === 'copied' ? 'Copied' : 'Copy'}
                        </CapsuleButton>
                    </div>
                    {copyStatus === 'error' && (
                        <p className="font-ui text-[14px] text-tone-cardinal" role="alert">
                            The link could not be copied. Select the address above and copy it manually.
                        </p>
                    )}
                    {copyStatus === 'copied' && <span className="sr-only" role="status">Viewer link copied.</span>}
                    <p className="font-ui text-[14px] leading-snug text-fg-2">
                        <span className="font-semibold text-fg">Note:</span> This link gives{' '}
                        <span className="text-fg">read-only access</span> to viewers. Organizers keep edit access inside their GridOne account.
                    </p>
                </div>
            </Sheet>
        </div>
    );
};

export default ShareModal;
