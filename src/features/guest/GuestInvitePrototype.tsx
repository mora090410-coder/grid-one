import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Base, CapsuleButton, CapsuleInput, Eyebrow, Glass } from '../../design/primitives';
import GuestPoolPage from './GuestPoolPage';
import type { GuestReceipt, GuestSnapshot, GuestTransport } from './guestInviteTypes';

function createPrototypeTransport(label: string, onChange: (claims: GuestReceipt[]) => void): GuestTransport {
  const claims: GuestReceipt[] = [];
  let held: number[] = [];
  const makeSnapshot = (): GuestSnapshot => ({
    boardId: 'prototype', title: 'Anthony family board', shareCode: 'DEMO2026', revision: 1,
    serverTime: new Date().toISOString(), stage: 'selling',
    squares: Array.from({ length: 100 }, (_, index) => claims.find(claim => claim.cells.includes(index))?.displayName ? [claims.find(claim => claim.cells.includes(index))!.displayName] : index < 10 ? ['Anthony'] : []),
    allocationLabels: Array.from({ length: 100 }, (_, index) => index < 10 ? label : null),
    availability: Array.from({ length: 100 }, (_, index) => index < 10 && !claims.some(claim => claim.cells.includes(index)) ? 'available' : 'unspecified'),
    holds: held.map(index => ({ index, mine: true, expiresAt: new Date(Date.now() + 90_000).toISOString() })),
    heldCells: held, claimedCells: claims.flatMap(claim => claim.cells),
    invite: { id: 'prototype-invite', label, cells: Array.from({ length: 10 }, (_, index) => index), maxSquares: 1, version: 1, expiresAt: null, disabledAt: null },
  });
  return {
    snapshot: async request => {
      if (request.action === 'hold') held = request.cells || [];
      return makeSnapshot();
    },
    manage: async request => {
      if (request.action === 'confirm') {
        const receipt: GuestReceipt = { groupId: `group-${claims.length + 1}`, inviteId: 'prototype-invite', displayName: request.name || 'Guest', cells: [...(request.cells || held)], claimedAt: new Date().toISOString(), canManage: true, claimCode: 'amber-river-maple-star', payment: { label: 'Arrange payment with Anthony', detail: 'Use the instructions Anthony shared with you.' } };
        claims.push(receipt); held = []; onChange([...claims]); return receipt;
      }
      const receipt = claims[0];
      if (!receipt) throw Object.assign(new Error('That simulated claim has not been created yet.'), { code: 'CLAIM_NOT_FOUND' });
      if (request.action === 'swap' && request.cells?.length) receipt.cells = [...request.cells];
      if (request.action === 'release') { receipt.cells = []; onChange([...claims]); return { ...receipt, cells: [], canManage: true }; }
      onChange([...claims]); return { ...receipt };
    },
  };
}

export default function GuestInvitePrototype() {
  const [searchParams] = useSearchParams();
  const guestOnly = searchParams.get('guest') === '1';
  const linkedSeller = (searchParams.get('seller') || 'Anthony').trim().slice(0, 60) || 'Anthony';
  const [created, setCreated] = useState(false);
  const [label, setLabel] = useState('Anthony');
  const [createdLabel, setCreatedLabel] = useState('Anthony');
  const [claims, setClaims] = useState<GuestReceipt[]>([]);
  const [message, setMessage] = useState('');
  const previewLabel = guestOnly ? linkedSeller : createdLabel;
  const transport = useMemo(() => createPrototypeTransport(previewLabel, setClaims), [previewLabel]);
  const link = `${window.location.origin}/dev/guest-invites?guest=1&seller=${encodeURIComponent(createdLabel)}`;
  if (guestOnly) return <div className="min-h-[100dvh] bg-ground"><div role="status" className="m-4 rounded-control border border-fg bg-panel p-4 font-ui text-fg"><strong>Simulated prototype — no live database, payment, or account connections.</strong></div><GuestPoolPage transport={transport} /></div>;
  return <Base kind="cream"><main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
    <div role="status" className="rounded-control border border-fg bg-panel p-4 font-ui text-fg"><strong>Simulated prototype — no live database, payment, or account connections.</strong></div>
    <header><Eyebrow>Organizer prototype</Eyebrow><h1 className="font-display text-[40px] text-fg">Guest claim links</h1></header>
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="flex flex-col gap-4"><Glass padding="lg" className="flex flex-col gap-3"><h2 className="font-display text-[28px] text-fg">Create seller link</h2><CapsuleInput label="Public seller name" value={label} onChange={event => setLabel(event.target.value)} /><p className="font-ui text-sm text-fg-2">10 reviewed squares · 1–10 · all explicitly available. Claims replace the public placeholder and preserve the seller’s responsibility.</p><CapsuleButton disabled={!label.trim()} onClick={() => { setCreatedLabel(label.trim()); setCreated(true); setClaims([]); setMessage('Simulated guest link ready.'); }}>Create guest link</CapsuleButton>{created && <><CapsuleInput label="Guest link" readOnly value={link} /><div className="flex flex-wrap gap-2"><CapsuleButton variant="quiet" onClick={() => { void navigator.clipboard?.writeText(link); setMessage('Simulated link copied.'); }}>Copy link</CapsuleButton><a href={link} className="inline-flex min-h-11 items-center rounded-capsule border border-hairline px-5 font-ui text-action focus-visible:ring-2 focus-visible:ring-action">Open guest link</a></div></>}{message && <p role="status" className="font-ui text-sm text-fg-2">{message}</p>}</Glass>
        <Glass padding="lg"><h2 className="font-display text-[28px] text-fg">Claims</h2>{claims.length ? <ul className="mt-3 flex flex-col gap-2">{claims.map(claim => <li key={claim.groupId} className="font-ui text-fg">{claim.displayName} · {claim.cells.map(index => `Square ${index + 1}`).join(', ')}</li>)}</ul> : <p className="mt-2 font-ui text-sm text-fg-2">No simulated claims yet.</p>}</Glass>
      </aside>
      <section aria-label="Guest preview" className="min-w-0 overflow-hidden rounded-card border border-hairline bg-ground">{created ? <GuestPoolPage transport={transport} embedded /> : <div className="p-8 font-ui text-fg-2">Create the simulated link to open the guest experience.</div>}</section>
    </div>
  </main></Base>;
}
