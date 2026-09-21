import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardData } from '../../../../types';
import { supabase } from '../../../../services/supabase';
import type { OrganizerInvite, OrganizerInvites, OwnerInviteRequest } from '../../guest/guestInviteTypes';
import { CapsuleButton, CapsuleInput, Glass } from '../../../design/primitives';
import { parseSquareNumbers } from './FamilyAccessCard';
import { useGuestSync } from '../../guest/useGuestSync';
import { subscribeGuestInvalidations } from '../../guest/guestInviteService';

type Props = {
  boardId: string;
  board: BoardData;
  clean: boolean;
  workspaceRevision: number;
  flush: () => Promise<{ status: string; revision: number }>;
  onReload: () => Promise<unknown>;
  onSync: () => Promise<unknown>;
  onBusy: (busy: boolean) => void;
};

const emptyList: OrganizerInvites = { revision: 0, invites: [], claims: [], holds: [] };

async function ownerToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Sign in again before changing guest links.');
  return data.session.access_token;
}

function responseMessage(response: Response, result: unknown) {
  const body = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  if (response.status === 409 && body.code === 'REVISION_CONFLICT') return 'This board changed. Your board edits are still here; reload the latest board before trying again.';
  return typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : 'Guest links could not be updated.';
}

function validHttpsUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const ipLiteral = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':') || (host.startsWith('[') && host.endsWith(']'));
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash
      && host.includes('.') && !host.endsWith('.local') && !host.endsWith('.localhost') && !ipLiteral;
  } catch { return false; }
}

function remainingHold(expiresAt: string) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
  return seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} left` : 'expiring now';
}

function InviteSettings({ invite, board, clean, busy, onSave }: {
  invite: OrganizerInvite; board: BoardData; clean: boolean; busy: boolean;
  onSave: (request: Omit<OwnerInviteRequest, 'revision'>) => void;
}) {
  const [label, setLabel] = useState(invite.label);
  const [numbers, setNumbers] = useState(invite.cells.map(index => index + 1).join(', '));
  const [maxSquares, setMaxSquares] = useState(invite.maxSquares);
  const [expiresAt, setExpiresAt] = useState(invite.expiresAt?.slice(0, 16) ?? '');
  const [paymentLabel, setPaymentLabel] = useState(invite.payment?.label ?? '');
  const [paymentDetail, setPaymentDetail] = useState(invite.payment?.detail ?? '');
  const [paymentUrl, setPaymentUrl] = useState(invite.payment?.url ?? '');
  const [acknowledged, setAcknowledged] = useState(false);
  const cells = parseSquareNumbers(numbers);
  const unavailable = cells?.filter(index => !invite.cells.includes(index) && board.availability?.[index] !== 'available') ?? [];
  const paymentConfigured = Boolean(paymentLabel.trim() || paymentDetail.trim() || paymentUrl.trim());
  const paymentValid = !paymentConfigured || (paymentLabel.trim().length <= 60 && Boolean(paymentDetail.trim()) && validHttpsUrl(paymentUrl));
  const valid = Boolean(label.trim() && cells?.length && maxSquares >= 1 && maxSquares <= (cells?.length ?? 0) && !unavailable.length && paymentValid && acknowledged);
  return <details><summary className="min-h-11 cursor-pointer text-sm font-semibold text-fg">Manage settings</summary><div className="mt-3 flex flex-col gap-3 rounded-control bg-ground p-3">
    <CapsuleInput label="Managed seller label" maxLength={80} value={label} disabled={busy} onChange={event => { setLabel(event.target.value); setAcknowledged(false); }} />
    <CapsuleInput label="Managed square numbers" value={numbers} disabled={busy} onChange={event => { setNumbers(event.target.value); setAcknowledged(false); }} />
    {cells?.length ? <div aria-label={`Updated offer review for ${invite.label}`} className="text-sm text-fg-2"><p>Current public names:</p><ul>{cells.map(index => <li key={index}>Square {index + 1}: {board.squares[index]?.filter(Boolean).join(', ') || 'Blank'}</li>)}</ul></div> : null}
    {unavailable.length > 0 && <p className="text-sm text-tone-cardinal">Mark every offered square available first: {unavailable.map(index => index + 1).join(', ')}.</p>}
    <label className="text-sm text-fg-2">Managed maximum squares per guest<input aria-label="Managed maximum squares per guest" type="number" min={1} max={cells?.length || 100} value={maxSquares} disabled={busy} onChange={event => setMaxSquares(Number(event.target.value) || 1)} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-panel px-3 text-fg" /></label>
    {cells?.length && maxSquares > cells.length ? <p className="text-sm text-tone-cardinal">Maximum squares cannot exceed this link’s {cells.length} offered squares.</p> : null}
    <label className="text-sm text-fg-2">Managed link expiry (optional)<input aria-label="Managed link expiry (optional)" type="datetime-local" value={expiresAt} disabled={busy} onChange={event => setExpiresAt(event.target.value)} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-panel px-3 text-fg" /></label>
    <CapsuleInput label="Managed payment heading" maxLength={60} value={paymentLabel} disabled={busy} onChange={event => setPaymentLabel(event.target.value)} />
    <label className="text-sm text-fg-2">Managed payment details<textarea aria-label="Managed payment details" maxLength={500} value={paymentDetail} disabled={busy} onChange={event => setPaymentDetail(event.target.value)} className="mt-2 min-h-24 w-full rounded-control border border-hairline bg-panel p-3 text-fg" /></label>
    <CapsuleInput label="Managed HTTPS payment link" value={paymentUrl} disabled={busy} onChange={event => setPaymentUrl(event.target.value)} />
    {paymentConfigured && !paymentDetail.trim() && <p className="text-sm text-tone-cardinal">Add recipient details when payment instructions are configured.</p>}
    {paymentUrl && !validHttpsUrl(paymentUrl) && <p className="text-sm text-tone-cardinal">Use a public HTTPS link without credentials, fragments, or local addresses.</p>}
    <label className="flex min-h-11 items-start gap-3 text-sm text-fg-2"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} aria-label="I reviewed the updated offer and current public names." />I reviewed the updated offer and current public names.</label>
    <CapsuleButton disabled={!clean || busy || !valid} onClick={() => onSave({
      action: 'update', inviteId: invite.id, label: label.trim(), cells: cells!, maxSquares,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      payment: paymentConfigured ? { label: paymentLabel.trim() || `Arrange payment with ${label.trim()}`, detail: paymentDetail.trim(), ...(paymentUrl.trim() ? { url: paymentUrl.trim() } : {}) } : null,
      offerAcknowledged: true,
    })}>Save guest link settings</CapsuleButton>
  </div></details>;
}

export default function GuestInvitesCard({ boardId, board, clean, workspaceRevision, flush, onReload, onSync, onBusy }: Props) {
  const [featureAvailable, setFeatureAvailable] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<OrganizerInvites>(emptyList);
  const [label, setLabel] = useState('');
  const [numbers, setNumbers] = useState('');
  const [maxSquares, setMaxSquares] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [paymentLabel, setPaymentLabel] = useState('');
  const [paymentDetail, setPaymentDetail] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [oneTimeCode, setOneTimeCode] = useState('');
  const pending = useRef(false);
  const cleanRef = useRef(clean);
  const workspaceRevisionRef = useRef(workspaceRevision);
  const syncingRef = useRef(false);
  cleanRef.current = clean;
  workspaceRevisionRef.current = workspaceRevision;
  const cells = parseSquareNumbers(numbers);
  const unavailableCells = cells?.filter(index => board.availability?.[index] !== 'available') ?? [];
  const paymentUrlValid = validHttpsUrl(paymentUrl);
  const paymentConfigured = Boolean(paymentLabel.trim() || paymentDetail.trim() || paymentUrl.trim());
  const paymentValid = !paymentConfigured || (paymentLabel.trim().length <= 60 && Boolean(paymentDetail.trim()) && paymentUrlValid);
  const maxSquaresValid = Boolean(cells?.length && maxSquares >= 1 && maxSquares <= cells.length);

  const load = useCallback(async () => {
    try {
      const token = await ownerToken();
      const response = await fetch(`/api/pools/${encodeURIComponent(boardId)}/invites`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (response.status === 404) { setFeatureAvailable(false); return; }
      const result = await response.json() as OrganizerInvites & { error?: string };
      if (!response.ok) throw new Error(responseMessage(response, result));
      if (!Array.isArray(result.invites) || !Array.isArray(result.claims) || !Array.isArray(result.holds) || typeof result.revision !== 'number') {
        setFeatureAvailable(false); return;
      }
      setSummary(current => result.revision >= current.revision ? result : current);
      setFeatureAvailable(true); setError('');
      if (result.revision > workspaceRevisionRef.current) {
        if (cleanRef.current && !syncingRef.current) {
          syncingRef.current = true;
          try { await onSync(); }
          finally { syncingRef.current = false; }
        } else if (!cleanRef.current) {
          setError('Guest activity changed this board while you were editing. Your edits are still here; reload the latest board when you are ready.');
        }
      }
    } catch (failure) {
      setFeatureAvailable(true);
      setError(failure instanceof Error ? failure.message : 'Guest links could not be loaded.');
    }
  }, [boardId, onSync]);
  useGuestSync({ boardId, enabled: featureAvailable === true, refresh: load, subscribe: subscribeGuestInvalidations });
  useEffect(() => {
    const deadline = Math.min(...summary.holds.map(hold => Date.parse(hold.expiresAt)).filter(Number.isFinite));
    if (!Number.isFinite(deadline) || deadline <= Date.now()) return;
    const timer = window.setTimeout(() => void load(), Math.max(0, deadline - Date.now()) + 50);
    return () => window.clearTimeout(timer);
  }, [load, summary.holds]);

  const mutate = async (request: Omit<OwnerInviteRequest, 'revision'>, confirmation?: string) => {
    if (pending.current || !clean) return;
    if (confirmation && !window.confirm(confirmation)) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pending.current = true; setBusy(true); onBusy(true); setError(''); setMessage(''); setOneTimeCode('');
    try {
      const saved = await flush();
      if (saved.status !== 'clean') throw new Error('Save or reload your latest board changes first.');
      const token = await ownerToken();
      const response = await fetch(`/api/pools/${encodeURIComponent(boardId)}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...request, revision: saved.revision }),
      });
      const result = await response.json() as OrganizerInvites & { error?: string };
      if (!response.ok) throw new Error(responseMessage(response, result));
      setSummary(result);
      if (result.claimCode) setOneTimeCode(result.claimCode);
      if (request.action === 'create') { setLabel(''); setNumbers(''); setAcknowledged(false); }
      setMessage(request.action === 'create' ? 'Guest link ready to share.' : request.action === 'rotate_code' ? 'New recovery code ready.' : 'Guest link details updated.');
      await onReload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Guest links could not be updated.');
    } finally {
      pending.current = false; setBusy(false); onBusy(false);
      requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); });
    }
  };

  const create = () => {
    if (!cells?.length || unavailableCells.length || !label.trim() || !acknowledged || !paymentValid || !maxSquaresValid) return;
    const payment = paymentConfigured
      ? { label: paymentLabel.trim() || `Arrange payment with ${label.trim()}`, detail: paymentDetail.trim(), ...(paymentUrl.trim() ? { url: paymentUrl.trim() } : {}) }
      : null;
    void mutate({ action: 'create', label: label.trim(), cells, maxSquares, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, payment, offerAcknowledged: true });
  };

  const copy = async (url: string) => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url); setMessage('Guest link copied.');
    } catch { setMessage('Select and copy the guest link shown below.'); }
  };

  const share = async (inviteLabel: string, url: string) => {
    const text = `Here’s the link for ${inviteLabel}’s squares. Choose available squares and enter your name without signing up: ${url}`;
    try {
      if (!navigator.share) throw new Error('Share unavailable');
      await navigator.share({ title: `${inviteLabel} guest squares`, text, url });
    } catch { await copy(url); }
  };

  if (featureAvailable === false) return null;
  return <Glass padding="lg"><details onToggle={event => { if (event.currentTarget.open && featureAvailable === null) void load(); }}><summary className="min-h-11 cursor-pointer font-ui text-lg text-fg">Guest claim links (optional)</summary>
    <div className="mt-4 flex flex-col gap-5">
      <p className="text-sm text-fg-2">Create a public link for reviewed squares that are already marked available. Guests can claim without an account. GridOne does not collect square money or confirm external payments.</p>
      {featureAvailable === null && <p role="status" className="text-sm text-fg-2">Loading guest links…</p>}
      {!clean && <p role="status" className="text-sm text-fg-2">Save your latest board changes before managing guest links.</p>}
      <section aria-label="Create guest link" className="flex flex-col gap-3 border-t border-hairline pt-4">
        <CapsuleInput label="Seller label" maxLength={80} value={label} disabled={busy} onChange={event => setLabel(event.target.value)} />
        <CapsuleInput label="Guest square numbers" placeholder="1-10, 25" value={numbers} disabled={busy} onChange={event => { setNumbers(event.target.value); setAcknowledged(false); }} />
        {numbers && !cells && <p className="text-sm text-tone-cardinal">Use square numbers 1–100, separated by commas or ranges.</p>}
        {unavailableCells.length > 0 && <p className="text-sm text-tone-cardinal">Mark every offered square available first: {unavailableCells.map(index => index + 1).join(', ')}.</p>}
        {cells?.length ? <div aria-label="Guest link offer review" className="rounded-control border border-hairline p-3 text-sm text-fg">
          <p className="font-semibold">Review {cells.length} offered {cells.length === 1 ? 'square' : 'squares'}</p>
          <ul className="mt-2 grid gap-1">{cells.map(index => <li key={index}>Square {index + 1}: {board.squares[index]?.filter(Boolean).join(', ') || 'Blank'}</li>)}</ul>
        </div> : null}
        <label className="text-sm text-fg-2">Maximum squares per guest<input aria-label="Maximum squares per guest" type="number" min={1} max={100} value={maxSquares} disabled={busy} onChange={event => setMaxSquares(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-ground px-3 text-fg" /></label>
        <label className="text-sm text-fg-2">Link expiry (optional)<input aria-label="Link expiry (optional)" type="datetime-local" value={expiresAt} disabled={busy} onChange={event => setExpiresAt(event.target.value)} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-ground px-3 text-fg" /></label>
        <details><summary className="min-h-11 cursor-pointer text-sm font-semibold text-fg">External payment instructions (optional)</summary><div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-fg-2">A successful claimant can copy and forward these recipient details. Following the link never marks a square paid.</p>
          <CapsuleInput label="Payment heading" maxLength={60} placeholder={`Arrange payment with ${label.trim() || 'seller'}`} value={paymentLabel} disabled={busy} onChange={event => setPaymentLabel(event.target.value)} />
          <label className="text-sm text-fg-2">Payment details<textarea aria-label="Payment details" maxLength={500} value={paymentDetail} disabled={busy} onChange={event => setPaymentDetail(event.target.value)} className="mt-2 min-h-24 w-full rounded-control border border-hairline bg-ground p-3 text-fg" /></label>
          <CapsuleInput label="HTTPS payment link" value={paymentUrl} disabled={busy} onChange={event => setPaymentUrl(event.target.value)} />
          {paymentConfigured && !paymentDetail.trim() && <p className="text-sm text-tone-cardinal">Add recipient details when payment instructions are configured.</p>}
          {!paymentUrlValid && <p className="text-sm text-tone-cardinal">Use a public HTTPS link without credentials, fragments, or local addresses.</p>}
          {(paymentLabel || paymentDetail || paymentUrl) && <div aria-label="Payment preview" className="rounded-control border border-hairline p-3 text-sm text-fg"><p className="font-semibold">{paymentLabel || `Arrange payment with ${label.trim() || 'seller'}`}</p><p className="whitespace-pre-wrap text-fg-2">{paymentDetail || 'No recipient details entered.'}</p>{paymentUrlValid && paymentUrl && <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="underline">Open external payment link</a>}</div>}
        </div></details>
        <label className="flex min-h-11 items-start gap-3 text-sm text-fg-2"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} aria-label="I reviewed the offered squares and understand guest claims replace the current public names." />I reviewed these squares and understand guest claims replace the current public names. Responsibility and private payment notes stay unchanged.</label>
        {cells?.length && !maxSquaresValid && <p className="text-sm text-tone-cardinal">Maximum squares cannot exceed the {cells.length} offered squares.</p>}
        <CapsuleButton disabled={!clean || busy || !label.trim() || !cells?.length || unavailableCells.length > 0 || !acknowledged || !paymentValid || !maxSquaresValid} onClick={create}>Create guest link</CapsuleButton>
      </section>
      {summary.invites.map(invite => {
        const claims = summary.claims.filter(claim => claim.inviteId === invite.id);
        const inviteHolds = summary.holds.filter(hold => hold.inviteId === invite.id);
        const expired = Boolean(invite.expiresAt && Date.parse(invite.expiresAt) <= Date.now());
        return <article key={invite.id} aria-label={`Guest link for ${invite.label}`} className="flex flex-col gap-3 rounded-card border border-hairline p-4">
          <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-ui text-lg font-semibold text-fg">{invite.label}</h3>{invite.disabledAt && expired ? <span className="rounded-capsule bg-ground px-2 py-1 text-xs text-fg-2">Disabled · expired</span> : invite.disabledAt ? <span className="rounded-capsule bg-ground px-2 py-1 text-xs text-fg-2">Disabled</span> : expired ? <span className="rounded-capsule bg-ground px-2 py-1 text-xs text-fg-2">Expired</span> : <span className="rounded-capsule bg-ground px-2 py-1 text-xs text-fg-2">Active</span>}</div><p className="text-sm text-fg-2">Squares {invite.cells.map(index => index + 1).join(', ')} · Up to {invite.maxSquares} per guest{invite.expiresAt ? ` · Expires ${new Date(invite.expiresAt).toLocaleString()}` : ''}</p></div>
          <p className="text-sm text-fg">{invite.counts.available} available · {invite.counts.held} held · {invite.counts.claimed} claimed</p>
          {inviteHolds.length > 0 && <ul aria-label={`Anonymous holds for ${invite.label}`} className="grid gap-1 text-sm text-fg-2">{inviteHolds.map(hold => <li key={`${hold.index}-${hold.expiresAt}`}>Guest selecting square {hold.index + 1} · {remainingHold(hold.expiresAt)}</li>)}</ul>}
          <label className="text-sm text-fg-2">Guest link URL<input aria-label="Guest link URL" readOnly value={invite.url} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-ground px-3 text-fg" /></label>
          <div className="flex flex-wrap gap-2"><CapsuleButton variant="quiet" onClick={() => void copy(invite.url)}>Copy link</CapsuleButton><CapsuleButton variant="quiet" onClick={() => void share(invite.label, invite.url)}>Share link</CapsuleButton></div>
          {invite.payment && <div aria-label={`Payment preview for ${invite.label}`} className="rounded-control bg-ground p-3 text-sm"><p className="font-semibold">{invite.payment.label}</p><p className="whitespace-pre-wrap text-fg-2">{invite.payment.detail}</p>{invite.payment.url && <a href={invite.payment.url} target="_blank" rel="noopener noreferrer" className="underline">Preview payment destination</a>}</div>}
          <InviteSettings invite={invite} board={board} clean={clean} busy={busy} onSave={request => void mutate(request)} />
          {claims.length > 0 && <div><h4 className="text-sm font-semibold text-fg">Guest claims</h4><ul className="mt-2 grid gap-2">{claims.map(claim => <li key={claim.groupId} className="rounded-control bg-ground p-3 text-sm text-fg"><p>{claim.displayName} · Squares {claim.cells.map(index => index + 1).join(', ')} · Claimed through {invite.label}{claim.claimedAt ? ` · ${new Date(claim.claimedAt).toLocaleString()}` : ''}</p><div className="mt-2 flex flex-wrap gap-2"><CapsuleButton variant="quiet" disabled={busy || !clean} onClick={() => void mutate({ action: 'rotate_code', groupId: claim.groupId }, `Rotate ${claim.displayName}’s claim code? Their old code will stop working.`)}>Rotate {claim.displayName} claim code</CapsuleButton><CapsuleButton variant="quiet" disabled={busy || !clean} onClick={() => void mutate({ action: 'release_claim', groupId: claim.groupId }, `Release ${claim.displayName}’s claimed squares? This cannot be undone.`)}>Release claim</CapsuleButton></div></li>)}</ul></div>}
          {expired && <p className="text-sm text-fg-2">Set a future expiry in Manage settings before generating an active link.</p>}
          <div className="flex flex-wrap gap-2">{invite.counts.held > 0 && <CapsuleButton variant="quiet" disabled={busy || !clean} onClick={() => void mutate({ action: 'cancel_holds', inviteId: invite.id }, `Cancel all active holds for ${invite.label}? Guests selecting now will lose those holds.`)}>Cancel active holds</CapsuleButton>}<CapsuleButton variant="quiet" disabled={busy || !clean || expired} onClick={() => void mutate({ action: 'regenerate', inviteId: invite.id }, invite.disabledAt ? `Reactivate ${invite.label} with a new link? Confirmed claims and limits stay in place.` : `Regenerate ${invite.label}’s link? Previously posted copies will stop accepting guests.`)}>{invite.disabledAt ? 'Reactivate with new link' : 'Regenerate link'}</CapsuleButton>{!invite.disabledAt && <CapsuleButton variant="quiet" disabled={busy || !clean} onClick={() => void mutate({ action: 'disable', inviteId: invite.id }, `Disable ${invite.label}’s link? Pending holds will be released; confirmed claims remain.`)}>Disable link</CapsuleButton>}</div>
        </article>;
      })}
      {oneTimeCode && <div role="status" className="rounded-control border border-hairline p-3"><p className="font-semibold">New recovery code</p><p className="font-mono text-base text-fg">{oneTimeCode}</p><p className="text-sm text-fg-2">Copy this now. It is displayed once and remains valid until you rotate it again.</p></div>}
      {busy && <p role="status">Updating guest links…</p>}{message && <p role="status" className="text-sm text-fg-2">{message}</p>}{error && <div role="alert" className="text-sm text-tone-cardinal"><p>{error}</p><CapsuleButton variant="quiet" onClick={() => void onReload().then(load)}>Reload latest board</CapsuleButton></div>}
    </div>
  </details></Glass>;
}
