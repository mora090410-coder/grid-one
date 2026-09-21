import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CapsuleButton, CapsuleInput, Glass } from '../../design/primitives';
import { familyGuestShareMessage, parseFamilyGuestLinkRecord, unavailableStateMessage, type FamilyGuestLinkRecord } from './familyGuestLinkModel';

interface Props {
  token: string;
  dirty: boolean;
  disabled: boolean;
  refreshKey: number;
  onBusy: (busy: boolean) => void;
  onCreated: () => Promise<void>;
}

async function request(token: string, action: 'read' | 'create') {
  const response = await fetch('/api/family/guest-link', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action }), referrerPolicy: 'no-referrer', cache: 'no-store',
  });
  if (response.status === 404) return { rolloutOff: true as const };
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 409 ? 'This board changed. Save or reload the family workspace, then try again.' : 'Public sharing could not be loaded. Check your connection and try again.');
  const record = parseFamilyGuestLinkRecord(body);
  if (!record) throw new Error('Public sharing returned an invalid response. Try again later.');
  return { rolloutOff: false as const, record };
}

export default function FamilyShareCard({ token, dirty, disabled, refreshKey, onBusy, onCreated }: Props) {
  const [record, setRecord] = useState<FamilyGuestLinkRecord | null>(null);
  const [rolloutOff, setRolloutOff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const requestGeneration = ++generation.current;
    setLoading(true); setError('');
    try {
      const result = await request(token, 'read');
      if (!mounted.current || requestGeneration !== generation.current) return;
      setRolloutOff(result.rolloutOff);
      setRecord(result.rolloutOff ? null : result.record);
    } catch (cause) {
      if (mounted.current && requestGeneration === generation.current) setError(cause instanceof Error ? cause.message : 'Public sharing could not be loaded.');
    } finally { if (mounted.current && requestGeneration === generation.current) setLoading(false); }
  }, [token]);

  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load, refreshKey]);

  const create = async () => {
    if (dirty || disabled || creating) return;
    const requestGeneration = ++generation.current;
    setLoading(false); setCreating(true); onBusy(true); setMessage(''); setError('');
    try {
      const result = await request(token, 'create');
      if (!mounted.current || requestGeneration !== generation.current) return;
      if (result.rolloutOff) { setRolloutOff(true); setRecord(null); return; }
      setRecord(result.record); setRolloutOff(false);
      if (result.record.state !== 'active' || !result.record.url) return;
      try { await onCreated(); }
      catch { throw new Error('Your buyer link was created, but this private workspace could not refresh. Reload it before editing names or availability.'); }
      setMessage('Your public buyer link is ready to send.');
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Public sharing could not be created.');
    } finally { if (mounted.current) setCreating(false); onBusy(false); }
  };

  const copy = async (text: string, success: string, failure: string) => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text); setMessage(success); setError('');
    } catch { setMessage(''); setError(failure); }
  };

  const share = async () => {
    if (!record?.url) return;
    const text = familyGuestShareMessage(record);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${record.title} squares`, text, url: record.url });
        setMessage('Share options opened.'); setError('');
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        await copy(text, 'Share message copied.', 'The share message could not be copied. Select it below and copy it manually.');
      }
      return;
    }
    await copy(text, 'Share message copied.', 'The share message could not be copied. Select it below and copy it manually.');
  };

  const available = record ? `${record.availableCount} of ${record.cells.length} ${record.cells.length === 1 ? 'square' : 'squares'} available` : '';
  const active = record?.state === 'active' && record.url ? record : null;
  const activeUrl = active?.url;
  return <Glass as="section" padding="lg" aria-labelledby="family-share-title" className="flex flex-col gap-3">
    <h2 id="family-share-title" className="font-display text-[32px] text-fg">Share your squares</h2>
    <p className="font-ui text-base text-fg">Send this link by text, email, or social media. People choose a square and enter their name—no account needed.</p>
    <p className="font-ui text-sm text-fg-2">This page lets your family change names and availability. Keep this page’s address private. Only send the public buyer link shown here.</p>
    {loading && <p role="status" className="font-ui text-sm text-fg-2">Checking public sharing…</p>}
    {rolloutOff && !loading && <p className="font-ui text-sm text-fg-2">Public guest sharing is not available for this board yet.</p>}
    {record && <p className="font-ui text-base font-semibold text-fg">{available}</p>}
    {record && dirty && <p className="font-ui text-sm text-fg-2">This count uses saved availability. Save your changes to refresh it.</p>}
    {record?.availableCount === 0 && <p className="font-ui text-sm text-fg-2">Mark squares Available below and save when you want people to claim them. You can create the link now and send it later.</p>}
    {record?.state === 'not_created' && <>
      <p className="font-ui text-sm text-fg-2">The link always covers your assigned squares. People can claim only the ones you deliberately mark Available.</p>
      {dirty && <p className="font-ui text-sm text-fg-2">Save changes before creating your share link.</p>}
      <CapsuleButton disabled={dirty || disabled || creating} onClick={() => void create()}>{creating ? 'Creating…' : 'Create public buyer link'}</CapsuleButton>
    </>}
    {record && !['not_created', 'active'].includes(record.state) && <p className="font-ui text-sm text-fg-2">{unavailableStateMessage(record.state as Exclude<typeof record.state, 'not_created' | 'active'>)}</p>}
    {active && activeUrl && <>
      <CapsuleInput label="Public buyer link" readOnly value={activeUrl} />
      <label className="flex flex-col gap-2 font-ui text-sm text-fg-2">Prepared share message<textarea aria-label="Prepared share message" readOnly value={familyGuestShareMessage(active)} className="min-h-28 w-full rounded-control border border-hairline bg-ground p-3 text-base text-fg" /></label>
      <div className="flex flex-wrap gap-2">
        <CapsuleButton variant="quiet" disabled={creating} onClick={() => void copy(activeUrl, 'Buyer link copied.', 'The buyer link could not be copied. Select it above and copy it manually.')}>Copy buyer link</CapsuleButton>
        <CapsuleButton disabled={creating} onClick={() => void share()}>Share buyer link</CapsuleButton>
      </div>
    </>}
    {message && <p role="status" className="font-ui text-sm text-fg">{message}</p>}
    {error && <p role="alert" className="font-ui text-sm text-tone-cardinal">{error}</p>}
  </Glass>;
}
