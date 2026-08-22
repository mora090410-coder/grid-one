import React from 'react';
import NotificationOptIn from '../../../components/NotificationOptIn';

export interface WinnerEmailDisclosureProps {
  shareCode?: string | null;
  participantId?: string;
  displayName: string;
  enabled: boolean;
}

const WinnerEmailDisclosure: React.FC<WinnerEmailDisclosureProps> = ({ shareCode, participantId, displayName, enabled }) => {
  if (!enabled || !shareCode || !participantId || !displayName || displayName.trim().toUpperCase() === 'OPEN') return null;

  return (
    <section className="border-t border-broadcast-white/20 py-5" aria-labelledby="winner-email-title">
      <details open>
        <summary id="winner-email-title" className="oa-slab min-h-11 cursor-pointer text-broadcast-white" style={{ minHeight: 44 }}>
          Winner email disclosure
        </summary>
        <div className="mt-3" role="form" aria-label="winner email">
          <NotificationOptIn shareCode={shareCode} participantId={participantId} displayName={displayName} />
        </div>
      </details>
    </section>
  );
};

export default WinnerEmailDisclosure;
