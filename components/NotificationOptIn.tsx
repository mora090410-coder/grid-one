import React, { useState } from 'react';
import { CapsuleButton, CapsuleInput } from '../src/design/primitives';

interface NotificationOptInProps {
  shareCode?: string | null;
  participantId?: string;
  displayName: string;
}

const NotificationOptIn: React.FC<NotificationOptInProps> = ({ shareCode, participantId, displayName }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  if (!shareCode || !participantId) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('sending');
    setMessage('');
    try {
      const response = await fetch(`/api/boards/${shareCode}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to start email verification.');
      setStatus('sent');
      setMessage(result.message || 'If this address needs verification, check your inbox. Any already verified address remains active.');
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Unable to start email verification.');
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div className="flex flex-col gap-1">
        <p className="font-ui text-[15px] font-medium text-fg">Quarter-winner email for {displayName}</p>
        <p className="font-ui text-[14px] text-fg-2">One verified email for Q1, halftime, Q3, and Final wins. GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.</p>
      </div>
      {status !== 'sent' && (
        <CapsuleInput
          id="viewer-notification-email"
          label="Email address"
          hideLabel
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          trailing={<CapsuleButton type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Verify email'}</CapsuleButton>}
        />
      )}
      {message && <p role="status" className={`font-ui text-[14px] ${status === 'error' ? 'text-cardinal' : 'text-fg-2'}`}>{message}</p>}
    </form>
  );
};

export default NotificationOptIn;
