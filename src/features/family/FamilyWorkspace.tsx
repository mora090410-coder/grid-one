import React, { useEffect, useRef, useState } from 'react';
import { Base, CapsuleButton, Eyebrow, Glass } from '../../design/primitives';

type Availability = 'unspecified' | 'available' | 'unavailable';
interface FamilyCell { index: number; name: string; availability: Availability }
interface FamilyRecord { title: string; revision: number; label: string; cells: FamilyCell[] }

export default function FamilyWorkspace() {
  // Fragments never reach the server. Retaining it lets a family reload its private link.
  const token = useRef(window.location.hash.slice(1));
  const validToken = /^[a-f0-9]{64}$/.test(token.current);
  const [record, setRecord] = useState<FamilyRecord | null>(null);
  const [draft, setDraft] = useState<FamilyCell[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(validToken ? '' : 'This family link is incomplete. Ask your organizer for a new link.');
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const mounted = useRef(true);
  const submitting = useRef(false);

  async function request(body: unknown) {
    const response = await fetch('/api/family', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.current}` }, body: JSON.stringify(body), referrerPolicy: 'no-referrer', cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 409) {
        const issue = await response.json().catch(() => null) as { code?: string } | null;
        throw new Error(issue?.code === 'BOARD_LOCKED' ? 'locked' : 'conflict');
      }
      if ([401, 403, 404, 410].includes(response.status)) throw new Error('expired');
      throw new Error('failed');
    }
    const next = await response.json() as FamilyRecord;
    if (!next || typeof next.title !== 'string' || typeof next.label !== 'string' || !Number.isSafeInteger(next.revision) || next.revision < 1 || !Array.isArray(next.cells) || next.cells.length < 1 || next.cells.length > 100 || new Set(next.cells.map(cell => cell.index)).size !== next.cells.length || next.cells.some(cell => !Number.isInteger(cell.index) || cell.index < 0 || cell.index > 99 || typeof cell.name !== 'string' || cell.name.length > 80 || !['unspecified', 'available', 'unavailable'].includes(cell.availability))) throw new Error('failed');
    return next;
  }
  async function load() {
    if (!validToken) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const next = await request({ action: 'read' });
      if (!mounted.current) return;
      setRecord(next); setDraft(next.cells); setConflict(false);
    } catch {
      if (mounted.current) setError('Could not open this family board. Check your connection or ask your organizer for a current link.');
    } finally { if (mounted.current) setBusy(false); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, []);

  const changes = draft.filter(cell => {
    const previous = record?.cells.find(item => item.index === cell.index);
    return previous && (cell.name.trim() !== previous.name || cell.availability !== previous.availability);
  }).map(cell => ({ ...cell, name: cell.name.trim() }));
  useEffect(() => {
    if (!changes.length) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changes.length]);
  const invalid = changes.some(cell => !cell.name.trim() || cell.name.trim().length > 80);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!record || submitting.current || busy || conflict || invalid || changes.length === 0) return;
    submitting.current = true;
    setBusy(true); setError(''); setSaved(false);
    try {
      const next = await request({ action: 'edit', revision: record.revision, changes });
      if (!mounted.current) return;
      setRecord(next); setDraft(next.cells); setSaved(true);
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof Error && cause.message === 'conflict') {
        setConflict(true); setError('The board changed while you were editing. Your entries are still here. Reload the latest board before making another change.');
      } else if (cause instanceof Error && cause.message === 'locked') {
        setConflict(true); setError('This board has been finalized. Your entries are still here. Contact your organizer to request a correction.');
      } else if (cause instanceof Error && cause.message === 'expired') {
        setConflict(true); setError('This link can no longer edit these squares. Your entries are still here. Ask your organizer for a current link.');
      } else setError('Could not save changes. Your entries are still here. Check your connection and try again.');
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }
  const edit = (index: number, patch: Partial<FamilyCell>) => { setSaved(false); setDraft(current => current.map(cell => cell.index === index ? { ...cell, ...patch } : cell)); };

  return <Base kind="cream"><main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12">
    <header className="flex flex-col gap-3"><Eyebrow>Family board</Eyebrow><h1 className="break-words font-display text-[40px] leading-none text-fg">{record?.title || 'Your assigned squares'}</h1>
      <p className="font-ui text-base text-fg-2">Keep this private link within your family. It allows changes to your assigned squares.</p>
    </header>
    {error && <p role="alert" className="rounded-control border border-hairline bg-panel p-4 font-ui text-base text-fg">{error}</p>}
    {!record && busy && <p role="status" className="font-ui text-base text-fg-2">Opening your squares…</p>}
    {!record && validToken && !busy && <CapsuleButton onClick={() => void load()}>Try again</CapsuleButton>}
    {record && <form onSubmit={save} className="flex flex-col gap-6">
      <Glass padding="lg" className="flex flex-col gap-3"><h2 className="font-display text-[32px] text-fg">Your {draft.length} {draft.length === 1 ? 'square' : 'squares'}</h2>
        <p className="break-words font-ui text-base text-fg">Responsible family: {record.label}</p>
        <p className="font-ui text-sm text-fg-2">These are your squares. Add each buyer’s name as you sell. Collect the money yourself, outside GridOne.</p>
      </Glass>
      <ul className="flex flex-col gap-3">{draft.map(cell => <li key={cell.index} className="rounded-card border border-hairline bg-panel p-4">
        <p className="mb-3 font-mono text-sm text-fg-2">Square {cell.index + 1}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-2 font-ui text-sm text-fg">Name on square {cell.index + 1}
            <input value={cell.name} maxLength={80} disabled={busy} onChange={event => edit(cell.index, { name: event.target.value })} className="min-h-11 w-full rounded-control border border-hairline bg-panel px-3 text-base text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action" />
          </label>
          <label className="flex min-w-0 flex-col gap-2 font-ui text-sm text-fg">Availability for square {cell.index + 1}
            <select value={cell.availability} disabled={busy} onChange={event => edit(cell.index, { availability: event.target.value as Availability })} className="min-h-11 w-full rounded-control border border-hairline bg-panel px-3 text-base text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">
              <option value="unspecified">Not specified</option><option value="available">Available</option><option value="unavailable">Not available</option>
            </select>
          </label>
        </div>
      </li>)}</ul>
      <p className="font-ui text-sm text-fg-2">Everyone with the board link sees these names. Mark a square available only if you still have it to sell.</p>
      {saved && <p role="status" className="font-ui text-base text-fg">Changes saved.</p>}
      <div className="flex flex-wrap gap-3"><CapsuleButton type="submit" disabled={busy || conflict || invalid || !changes.length}>{busy ? 'Saving…' : 'Save changes'}</CapsuleButton>
        {conflict && <CapsuleButton variant="quiet" disabled={busy} onClick={() => { if (window.confirm('Reload the latest board? This replaces your unsaved entries.')) void load(); }}>Reload latest</CapsuleButton>}
      </div>
    </form>}
  </main></Base>;
}
