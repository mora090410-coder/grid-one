import React, { useEffect, useRef, useState } from 'react';
import { CapsuleButton, Glass } from '../../design/primitives';

type Sharing = { state: 'active' | 'not_created' | 'not_shared' | 'locked' | 'no_available'; url?: string; availableCount: number };
function parseSharing(value: Sharing): Sharing {
  if (!value || !['active', 'not_created', 'not_shared', 'locked', 'no_available'].includes(value.state) || !Number.isInteger(value.availableCount) || value.availableCount < 0 || value.availableCount > 100) throw new Error('Invalid sharing response');
  if (value.state === 'active') {
    if (value.availableCount === 0 || typeof value.url !== 'string') throw new Error('Missing buyer link');
    const url = new URL(value.url, window.location.origin);
    if (url.origin !== window.location.origin || url.username || url.password || url.search || url.hash || !/^\/s\/[a-f0-9]{16}$/.test(url.pathname)) throw new Error('Invalid buyer link');
    return { ...value, url: url.href };
  }
  return { state: value.state, availableCount: value.availableCount };
}

export default function FamilySellerShareCard({ token, revision, disabled }: { token: string; revision: number; disabled: boolean }) {
  const [sharing, setSharing] = useState<Sharing | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [manualCopy, setManualCopy] = useState(false);
  const generation = useRef(0);
  const creating = useRef(false);
  async function request(action: 'read' | 'create', version: number) {
    setBusy(true); setError(''); setNotice(''); setManualCopy(false);
    try {
      const response = await fetch('/api/family/seller-link', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action }), cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('Unavailable');
      const next = parseSharing(await response.json());
      if (version === generation.current) setSharing(next);
    } catch {
      if (version === generation.current) { setSharing(null); setError('Could not load your buyer link. Check your connection or ask your organizer for help.'); }
    } finally { if (version === generation.current) setBusy(false); }
  }
  useEffect(() => {
    const version = ++generation.current;
    setSharing(null);
    void request('read', version);
    return () => { generation.current++; };
  }, [token, revision]);
  async function create() {
    if (disabled || busy || creating.current) return;
    creating.current = true;
    try { await request('create', generation.current); } finally { creating.current = false; }
  }
  async function copy() {
    if (!sharing?.url || disabled || busy) return;
    try { await navigator.clipboard.writeText(sharing.url); setNotice('Buyer link copied.'); }
    catch { setManualCopy(true); setNotice('Select and copy the buyer link below.'); }
  }
  async function share() {
    if (!sharing?.url || disabled || busy) return;
    try { await navigator.share({ title: 'Choose your squares', url: sharing.url }); }
    catch (cause) { if (!(cause instanceof Error && cause.name === 'AbortError')) await copy(); }
  }
  const messages = {
    not_shared: 'Your organizer needs to share the board while selling before you can send a buyer link.',
    locked: 'The numbers are locked. Buyers can no longer claim squares.',
    no_available: 'No squares are available to claim. Update and save an unsold square’s availability to share it.',
    not_created: 'Create a buyer link to let people choose from your available squares.',
    active: `${sharing?.availableCount ?? 0} ${sharing?.availableCount === 1 ? 'square' : 'squares'} available for buyers.`,
  };
  return <Glass padding="lg" className="flex flex-col gap-3">
    <h2 className="font-display text-[28px] text-fg">Share available squares</h2>
    <p className="font-ui text-sm text-fg-2">Send buyers this separate link, not your private family link. They choose available squares and add their names. You collect payment outside GridOne.</p>
    <p role="status" className="font-ui text-base text-fg">{busy ? 'Checking available squares…' : sharing ? messages[sharing.state] : ''}</p>
    {disabled && <p className="font-ui text-sm text-fg-2">Save or resolve your changes before sharing.</p>}
    {error && <p role="alert" className="font-ui text-sm text-fg">{error}</p>}
    <div className="flex flex-wrap gap-3">
      {sharing?.state === 'not_created' && <CapsuleButton type="button" disabled={disabled || busy} onClick={() => void create()}>Create buyer link</CapsuleButton>}
      {sharing?.state === 'active' && <>
        {typeof navigator.share === 'function' && <CapsuleButton type="button" disabled={disabled || busy} onClick={() => void share()}>Share buyer link</CapsuleButton>}
        <CapsuleButton type="button" disabled={disabled || busy} onClick={() => void copy()}>Copy buyer link</CapsuleButton>
      </>}
      {error && <CapsuleButton type="button" variant="quiet" disabled={busy || disabled} onClick={() => void request('read', generation.current)}>Try buyer link again</CapsuleButton>}
    </div>
    {notice && <p role="status" className="font-ui text-sm text-fg">{notice}</p>}
    {manualCopy && sharing?.url && !disabled && <label className="flex flex-col gap-2 font-ui text-sm text-fg">Buyer link<input readOnly value={sharing.url} onFocus={event => event.currentTarget.select()} className="min-h-11 w-full rounded-control border border-hairline bg-panel px-3 text-base text-fg focus-visible:ring-2 focus-visible:ring-action" /></label>}
  </Glass>;
}
