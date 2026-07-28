import React, { useState } from 'react';

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
      setMessage('Check your inbox and verify this email. Notifications begin only after verification.');
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Unable to start email verification.');
    }
  };

  return (
    <form className="gdh-notify" onSubmit={submit}>
      <div>
        <strong>Quarter-winner email for {displayName}</strong>
        <span>One verified email for Q1, halftime, Q3, and Final wins. GridOne does not handle payouts.</span>
      </div>
      {status !== 'sent' && (
        <div className="gdh-notify-controls">
          <label className="sr-only" htmlFor="viewer-notification-email">Email address</label>
          <input
            id="viewer-notification-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Verify email'}
          </button>
        </div>
      )}
      {message && <p role="status" className={status === 'error' ? 'is-error' : ''}>{message}</p>}
    </form>
  );
};

export default NotificationOptIn;
