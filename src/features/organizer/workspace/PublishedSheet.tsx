import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Sheet, CapsuleButton, Glass } from '../../../design/primitives';

export interface PublishedSheetProps {
  open: boolean;
  shareUrl: string;
  onClose: () => void;
  onOpenViewer: () => void;
  onEnterGameDay: () => void;
}

/** Success sheet after a board is published: copy link, QR, open viewer, enter game day. */
export default function PublishedSheet({ open, shareUrl, onClose, onOpenViewer, onEnterGameDay }: PublishedSheetProps) {
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
    <Sheet open={open} onClose={onClose} title="Published">
      <div className="flex flex-col items-center gap-4">
        <Glass as="div" padding="md" className="bg-white">
          <QRCodeSVG value={shareUrl} size={160} />
        </Glass>
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 font-mono text-[13px] text-fg-2 truncate">{shareUrl}</div>
          <CapsuleButton type="button" variant="quiet" onClick={handleCopy} disabled={copyStatus === 'copying'}>
            {copyStatus === 'copying' ? 'Copying…' : copyStatus === 'copied' ? 'Copied' : 'Copy link'}
          </CapsuleButton>
        </div>
        {copyStatus === 'error' && (
          <p role="alert" className="font-ui text-[13px] text-tone-cardinal">The link could not be copied. Select the address above and copy it manually.</p>
        )}
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CapsuleButton type="button" variant="quiet" onClick={onOpenViewer}>Open public board</CapsuleButton>
          <CapsuleButton type="button" onClick={onEnterGameDay}>Manage board</CapsuleButton>
        </div>
      </div>
    </Sheet>
  );
}
