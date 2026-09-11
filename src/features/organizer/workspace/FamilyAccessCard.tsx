import React, { useRef, useState } from 'react';
import { supabase } from '../../../../services/supabase';
import { CapsuleButton, CapsuleInput, Glass } from '../../../design/primitives';

type Props = { boardId: string; labels: (string | null)[]; clean: boolean; flush: () => Promise<{ status: string; revision: number }>; onReload: () => Promise<unknown>; onBusy: (busy: boolean) => void };
export function parseSquareNumbers(value: string): number[] | null {
  if (!value.trim()) return null;
  const cells = new Set<number>();
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/);
    if (!match) return null;
    const start = Number(match[1]), end = Number(match[2] ?? match[1]);
    if (start < 1 || end > 100 || end < start) return null;
    for (let number = start; number <= end; number++) cells.add(number - 1);
  }
  return [...cells].sort((a, b) => a - b);
}
export default function FamilyAccessCard({ boardId, labels, clean, flush, onReload, onBusy }: Props) {
  const [label, setLabel] = useState('');
  const [numbers, setNumbers] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [link, setLink] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const families = [...new Set(labels.filter((value): value is string => Boolean(value)))];
  const cells = labels.flatMap((value, index) => value === label ? [index] : []);
  const reassignedCells = parseSquareNumbers(numbers);
  const mutate = async (action: 'invite' | 'revoke' | 'reassign') => {
    if (pending.current || !clean) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pending.current = true; setBusy(true); onBusy(true); setError(''); setMessage(''); setLink('');
    try {
      const saved = await flush();
      if (saved.status !== 'clean') throw new Error('Save or reload your latest changes first.');
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error('Sign in again before changing family access.');
      const body = action === 'reassign'
        ? { action, revision: saved.revision, label: newLabel.trim(), cells: reassignedCells, reviewPaymentNotes: true }
        : { action, revision: saved.revision, label, ...(action === 'invite' ? { cells } : {}) };
      const response = await fetch(`/api/pools/${encodeURIComponent(boardId)}/family`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 409 ? 'This board changed. Reload the latest board before trying again.' : result.message || result.error || 'Family access could not be updated.');
      if (action === 'invite' && typeof result.url === 'string') { setLink(result.url); setExpiresAt(typeof result.expiresAt === 'string' && Number.isFinite(Date.parse(result.expiresAt)) ? result.expiresAt : ''); }
      await onReload();
      setMessage(action === 'invite' ? 'Private link ready. Only send it to this family.' : action === 'revoke' ? 'This family’s edit links are revoked.' : 'Responsibility updated. Names on the board are unchanged.');
      if (action === 'reassign') { setAcknowledged(false); setNumbers(''); setNewLabel(''); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Family access could not be updated. Reload the board before trying again.'); }
    finally { pending.current = false; setBusy(false); onBusy(false); requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); }); }
  };
  return <Glass padding="lg"><details><summary className="min-h-11 cursor-pointer font-ui text-lg text-fg">Family access (optional)</summary>
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-sm text-fg-2">Let a family update names on its assigned squares. Its responsibility stays the same. Anyone with its private link can make those edits; keep it separate from the public board link.</p>
      {!clean && <p role="status" className="text-sm text-fg-2">Save your latest changes before managing family access.</p>}
      <label className="text-sm text-fg-2">Responsible family<select aria-label="Responsible family" value={label} disabled={busy} onChange={event => { setLabel(event.target.value); setLink(''); }} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-ground px-3 text-fg"><option value="">Choose a family</option>{families.map(value => <option key={value}>{value}</option>)}</select></label>
      {!families.length && <p className="text-sm text-fg-2">Assign a responsible family before creating an edit link.</p>}
      <div className="flex flex-wrap gap-2"><CapsuleButton disabled={!clean || busy || !cells.length} onClick={() => void mutate('invite')}>Create private family link</CapsuleButton><CapsuleButton variant="quiet" disabled={!clean || busy || !cells.length} onClick={() => void mutate('revoke')}>Revoke family links</CapsuleButton></div>
      {link && <>{expiresAt && <p className="text-sm text-fg-2">This private link expires <time dateTime={expiresAt}>{new Date(expiresAt).toLocaleString()}</time>. Creating another link replaces this one.</p>}<CapsuleInput label="Private family link" readOnly value={link}/><CapsuleButton variant="quiet" onClick={() => { if (!navigator.clipboard) { setMessage('Select and copy the private link above.'); return; } void navigator.clipboard.writeText(link).then(() => setMessage('Private link copied.')).catch(() => setMessage('Select and copy the private link above.')); }}>Copy private link</CapsuleButton></>}
      <details><summary className="min-h-11 cursor-pointer text-sm font-semibold text-fg">Change responsibility</summary><div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-fg-2">Names stay on the board. Previous family access to these squares ends. Existing private payment notes are archived and the current status resets to Not asked yet. GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.</p>
        <CapsuleInput label="Square numbers" placeholder="13-20, 25" value={numbers} disabled={busy} onChange={event => setNumbers(event.target.value)}/>
        {numbers && !reassignedCells && <p className="text-sm text-tone-cardinal">Use square numbers 1–100, separated by commas or ranges.</p>}
        <CapsuleInput label="New responsible family" maxLength={80} value={newLabel} disabled={busy} onChange={event => setNewLabel(event.target.value)}/>
        {reassignedCells?.length && newLabel.trim() ? <div className="rounded-control border border-hairline p-3 text-sm text-fg" aria-label="Responsibility change review">
          <p>{reassignedCells.length} squares: {reassignedCells.map(cell => cell + 1).join(', ')}</p>
          <p>From: {[...new Set(reassignedCells.map(cell => labels[cell] || 'No responsible family'))].join(', ')}</p>
          <p>To: {newLabel.trim()}</p>
          <p>Names on the board stay unchanged. Previous private payment notes are archived; current payment status becomes Not asked yet.</p>
        </div> : null}
        <label className="flex min-h-11 items-start gap-3 text-sm text-fg-2"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)}/>I reviewed the old private payment notes and understand they will be archived and reset.</label>
        <CapsuleButton variant="quiet" disabled={!clean || busy || !reassignedCells?.length || !newLabel.trim() || !acknowledged} onClick={() => void mutate('reassign')}>Change responsible family</CapsuleButton>
      </div></details>
      {busy && <p role="status">Updating family access…</p>}{message && <p role="status" className="text-sm text-fg-2">{message}</p>}{error && <div role="alert" className="text-sm text-tone-cardinal"><p>{error}</p><CapsuleButton variant="quiet" onClick={() => void onReload()}>Reload latest board</CapsuleButton></div>}
    </div>
  </details></Glass>;
}
