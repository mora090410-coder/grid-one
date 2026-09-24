import React, { useEffect } from 'react';
import NotificationOptIn from '../../../../components/NotificationOptIn';
import { track } from '../../instrumentation/track';

export interface WinnerEmailDisclosureProps {
  shareCode?: string | null;
  participantId?: string;
  displayName: string;
  enabled: boolean;
}

const WinnerEmailDisclosure: React.FC<WinnerEmailDisclosureProps> = ({ shareCode, participantId, displayName, enabled }) => {
  const visible = Boolean(enabled && shareCode && participantId && displayName && displayName.trim().toUpperCase() !== 'OPEN');

  useEffect(() => {
    if (visible) track({ name: 'notification_form_opened', surface: 'viewer', notificationIntent: 'winner_updates' });
  }, [visible, participantId]);

  if (!visible) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="winner-email-title">
      <h2 id="winner-email-title" className="font-display text-[26px] leading-[1.1] text-fg">Get winner emails</h2>
      <div role="form" aria-label="winner email">
        <NotificationOptIn shareCode={shareCode} participantId={participantId} displayName={displayName} />
      </div>
    </section>
  );
};

export default WinnerEmailDisclosure;
