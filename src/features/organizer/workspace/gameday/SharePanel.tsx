import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Eyebrow, CapsuleButton, Glass } from '../../../../design/primitives';
import { track } from '../../../instrumentation/track';

export interface SharePanelProps {
  shareUrl: string;
  onOpenViewer: () => void;
}

/** Published board's public link: copy, open, and a scannable QR code. */
export default function SharePanel({ shareUrl, onOpenViewer }: SharePanelProps) {
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
      track({ name: 'recoverable_ui_failure_code', code: 'clipboard_denied', surface: 'organizer' });
    }
  };

  return (
    <Glass padding="lg" className="flex flex-col gap-4">
      <Eyebrow>Public board</Eyebrow>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex-1 min-w-0 font-mono text-[13px] text-fg-2 truncate">{shareUrl}</div>
          <CapsuleButton type="button" variant="quiet" onClick={handleCopy} disabled={copyStatus === 'copying'}>
            {copyStatus === 'copying' ? 'Copying…' : copyStatus === 'copied' ? 'Copied' : 'Copy link'}
          </CapsuleButton>
        </div>
        <div className="hidden sm:block">
          <Glass as="div" padding="none" className="bg-white p-2">
            <QRCodeSVG value={shareUrl} size={128} />
          </Glass>
        </div>
      </div>
      {copyStatus === 'error' && (
        <p role="alert" className="font-ui text-[13px] text-tone-cardinal">The link could not be copied. Select the address above and copy it manually.</p>
      )}
      <CapsuleButton type="button" variant="quiet" className="self-start" onClick={onOpenViewer}>Open public board</CapsuleButton>
    </Glass>
  );
}
