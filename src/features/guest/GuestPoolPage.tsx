import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Base, CapsuleButton, CapsuleInput, Eyebrow, Glass } from '../../design/primitives';
import type { GuestReceipt, GuestSnapshot, GuestTransport } from './guestInviteTypes';
import { createGuestCredentialStore, createHttpGuestTransport, GuestApiError, subscribeGuestInvalidations } from './guestInviteService';
import { validClaimCode, validGuestName, normalizeClaimCode } from './guestInviteModel';
import { useGuestSync } from './useGuestSync';
import GuestClaimBoard from './GuestClaimBoard';
import ClaimReceipt from './ClaimReceipt';

type Props = { transport?: GuestTransport; embedded?: boolean };

const deadLinkMessage = (error: unknown) => {
  const code = error instanceof GuestApiError ? error.code : (error as { code?: string })?.code;
  if (['INVITE_DISABLED', 'INVITE_EXPIRED', 'INVITE_ROTATED', 'INVITE_NOT_FOUND', 'INVITE_INACTIVE', 'ACCESS_DENIED', 'NOT_FOUND'].includes(code || '')) return 'This invite link is no longer active.';
  return error instanceof Error ? error.message : 'This guest board could not be opened. Check your connection and try again.';
};

const terminalInviteError = (error: unknown) => {
  const status = (error as { status?: number })?.status;
  const code = (error as { code?: string })?.code || '';
  return [403, 404, 410].includes(status || 0) || /INVITE_(DISABLED|EXPIRED|ROTATED|NOT_FOUND|REQUIRED|INACTIVE)|GUEST_ACCESS_DENIED|ACCESS_DENIED|NOT_FOUND/.test(code);
};

export default function GuestPoolPage({ transport: injectedTransport, embedded = false }: Props) {
  const { poolId = '' } = useParams<{ poolId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inviteFromUrl = searchParams.get('invite');
  const initialInviteToken = useRef(inviteFromUrl);
  const store = useMemo(() => createGuestCredentialStore(poolId, initialInviteToken.current), [poolId]);
  const transport = useMemo(() => injectedTransport ?? createHttpGuestTransport(poolId, store), [injectedTransport, poolId, store]);
  const [snapshot, setSnapshot] = useState<GuestSnapshot | null>(null);
  const [receipt, setReceipt] = useState<GuestReceipt | null>(null);
  const [name, setName] = useState('');
  const [claimCode, setClaimCode] = useState(store.claimCode);
  const [selected, setSelected] = useState<number[]>([]);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [continueDismissed, setContinueDismissed] = useState(false);
  const mounted = useRef(true);
  const changingRef = useRef(false);
  const latestSnapshotRef = useRef<GuestSnapshot | null>(null);
  const mutationVersionRef = useRef(0);
  const selectionMutationRef = useRef(false);
  const nameFormRef = useRef<HTMLDivElement>(null);
  changingRef.current = changing;

  const preserveClaimCode = useCallback((next: GuestReceipt, current: GuestReceipt | null) => ({
    ...next,
    claimCode: next.claimCode || current?.claimCode || store.claimCode || undefined,
  }), [store]);

  const acceptSnapshot = useCallback((next: GuestSnapshot) => {
    const current = latestSnapshotRef.current;
    if (current && current.boardId !== next.boardId) return false;
    if (current && next.revision < current.revision) return false;
    if (current && next.revision === current.revision) {
      const currentTime = Date.parse(current.serverTime);
      const nextTime = Date.parse(next.serverTime);
      if (Number.isFinite(currentTime) && Number.isFinite(nextTime) && nextTime < currentTime) return false;
    }
    latestSnapshotRef.current = next;
    setSnapshot(next);
    return true;
  }, []);

  const clearSnapshot = useCallback(() => {
    latestSnapshotRef.current = null;
    setSnapshot(null);
    setSelected([]);
  }, []);

  const read = useCallback(async (background = false) => {
    const mutationVersion = mutationVersionRef.current;
    if (!background) setLoading(true);
    try {
      const next = await transport.snapshot({ action: 'read' });
      if (!mounted.current) return;
      if (mutationVersion !== mutationVersionRef.current || selectionMutationRef.current) return;
      if (!acceptSnapshot(next)) return;
      if (!changingRef.current) setSelected(next.heldCells || []);
      if (next.mine) setReceipt(current => preserveClaimCode(next.mine!, current));
      setError('');
    } catch (cause) {
      if (mounted.current) {
        setError(deadLinkMessage(cause));
        if (terminalInviteError(cause)) clearSnapshot();
      }
      throw cause;
    } finally { if (mounted.current && !background) setLoading(false); }
  }, [acceptSnapshot, clearSnapshot, preserveClaimCode, transport]);

  useEffect(() => {
    if (initialInviteToken.current) {
      store.rememberInvite(initialInviteToken.current);
      navigate(`/p/${encodeURIComponent(poolId)}`, { replace: true });
    }
  }, [navigate, poolId, store]);

  useEffect(() => {
    mounted.current = true;
    void read().catch(() => undefined);
    return () => { mounted.current = false; };
  }, [read]);

  const sync = useGuestSync({ boardId: poolId, enabled: Boolean(snapshot), refresh: () => read(true), subscribe: injectedTransport ? undefined : subscribeGuestInvalidations });
  const active = Boolean(snapshot?.invite && !snapshot.invite.disabledAt && snapshot.stage === 'selling');
  const maxSquares = snapshot?.invite?.maxSquares ?? 1;
  useEffect(() => {
    if (!snapshot?.holds.some(item => item.mine)) return;
    const receivedAt = Date.now();
    const serverAt = Date.parse(snapshot.serverTime);
    const update = () => setClockNow((Number.isFinite(serverAt) ? serverAt : receivedAt) + (Date.now() - receivedAt));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [snapshot?.serverTime, snapshot?.holds]);
  const holdDeadline = snapshot?.holds.filter(item => item.mine).reduce<number | null>((soonest, item) => {
    const value = Date.parse(item.expiresAt);
    return Number.isFinite(value) && (soonest === null || value < soonest) ? value : soonest;
  }, null) ?? null;
  const holdSeconds = holdDeadline === null ? null : Math.max(0, Math.ceil((holdDeadline - clockNow) / 1_000));
  const holdLabel = holdSeconds === null ? null : `${Math.floor(holdSeconds / 60)}:${String(holdSeconds % 60).padStart(2, '0')}`;
  const refreshDeadline = [...(snapshot?.holds.map(item => item.expiresAt) || []), snapshot?.invite?.expiresAt]
    .filter((value): value is string => Boolean(value))
    .reduce<number | null>((soonest, value) => {
      const time = Date.parse(value);
      return Number.isFinite(time) && (soonest === null || time < soonest) ? time : soonest;
    }, null);
  useEffect(() => {
    if (refreshDeadline === null) return;
    const serverAt = Date.parse(snapshot?.serverTime || '');
    const delay = Math.max(0, refreshDeadline - (Number.isFinite(serverAt) ? serverAt : Date.now())) + 50;
    const timeout = window.setTimeout(sync.invalidate, delay);
    return () => window.clearTimeout(timeout);
  }, [refreshDeadline, snapshot?.serverTime, sync.invalidate]);

  const hold = async (index: number) => {
    if (!snapshot || pendingIndex !== null || !active) return;
    const removing = selected.includes(index);
    const next = removing ? selected.filter(value => value !== index) : [...selected, index];
    if (!removing && next.length > maxSquares) {
      setError(`You can claim up to ${maxSquares} ${maxSquares === 1 ? 'square' : 'squares'} with this guest pass. Remove one before choosing another.`);
      return;
    }
    mutationVersionRef.current += 1;
    selectionMutationRef.current = true;
    setPendingIndex(index); setError('');
    try {
      const updated = await transport.snapshot({ action: 'hold', cells: next });
      if (!mounted.current) return;
      if (acceptSnapshot(updated)) { setSelected(updated.heldCells || next); setContinueDismissed(false); }
    } catch (cause) {
      if (mounted.current) {
        setError(deadLinkMessage(cause));
        if (terminalInviteError(cause)) clearSnapshot();
      }
    } finally { selectionMutationRef.current = false; if (mounted.current) setPendingIndex(null); }
  };

  const confirm = async () => {
    if (!validGuestName(name) || !selected.length || busy) return;
    mutationVersionRef.current += 1;
    setBusy(true); setError('');
    try {
      const next = await transport.manage({ action: 'confirm', cells: selected, name: name.trim() });
      if (!mounted.current) return;
      if (next.claimCode) { store.rememberClaimCode(next.claimCode); setClaimCode(next.claimCode); }
      setReceipt(current => preserveClaimCode(next, current)); setChanging(false);
    } catch (cause) { if (mounted.current) { setError(deadLinkMessage(cause)); if (terminalInviteError(cause)) clearSnapshot(); } }
    finally { if (mounted.current) setBusy(false); }
  };

  const recover = async () => {
    const normalized = normalizeClaimCode(claimCode);
    if (!validClaimCode(normalized) || busy) return;
    setBusy(true); setError('');
    try {
      const next = await transport.manage({ action: 'receipt', claimCode: normalized });
      if (!mounted.current) return;
      store.rememberClaimCode(normalized); setClaimCode(normalized); setReceipt(current => preserveClaimCode(next, current)); setSelected(next.cells);
    } catch (cause) { if (mounted.current) setError(deadLinkMessage(cause)); }
    finally { if (mounted.current) setBusy(false); }
  };

  const swap = async () => {
    if (!receipt || !selected.length || busy) return;
    mutationVersionRef.current += 1;
    setBusy(true); setError('');
    try {
      const next = await transport.manage({ action: 'swap', claimCode: claimCode || undefined, cells: selected });
      if (mounted.current) { setReceipt(current => preserveClaimCode(next, current)); setSelected(next.cells); setChanging(false); }
    } catch (cause) { if (mounted.current) setError(deadLinkMessage(cause)); }
    finally { if (mounted.current) setBusy(false); }
  };

  const chooseReplacement = (index: number) => {
    setError('');
    setSelected(current => {
      if (current.includes(index)) return current.filter(value => value !== index);
      if (current.length >= maxSquares) return [index];
      return [...current, index];
    });
  };

  const release = async () => {
    if (!receipt || busy) return;
    mutationVersionRef.current += 1;
    setBusy(true); setError('');
    try {
      const next = await transport.manage({ action: 'release', claimCode: claimCode || undefined });
      if (mounted.current) { setReceipt(current => preserveClaimCode(next, current)); setSelected([]); setChanging(false); await read(true); }
    } catch (cause) { if (mounted.current) setError(deadLinkMessage(cause)); }
    finally { if (mounted.current) setBusy(false); }
  };

  if (loading && !snapshot) return <Base kind="dark"><main className="mx-auto max-w-3xl px-4 py-16"><p role="status" className="font-ui text-fg-2">Opening guest board…</p></main></Base>;
  if (!snapshot && receipt) return <Base kind="dark"><main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16"><Eyebrow>Private claim receipt</Eyebrow><ClaimReceipt receipt={receipt} busy={busy} /></main></Base>;
  if (!snapshot) return <Base kind="dark"><main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16"><div className="flex flex-col gap-3"><Eyebrow>Guest pass</Eyebrow><h1 className="font-display text-[40px] text-fg">This guest board is unavailable.</h1><p role="alert" className="font-ui text-fg-2">{error}</p><CapsuleButton className="self-start" onClick={() => void read().catch(() => undefined)}>Try again</CapsuleButton></div><Glass padding="lg" className="flex flex-col gap-3"><h2 className="font-display text-[28px] text-fg">Open an existing claim</h2><p className="font-ui text-sm text-fg-2">An expired or disabled invite cannot create or change claims. Your private code can still open its receipt.</p><CapsuleInput label="Private claim code" value={claimCode} autoComplete="off" onChange={event => setClaimCode(event.target.value)} /><CapsuleButton disabled={busy || !validClaimCode(claimCode)} onClick={() => void recover()}>Open my claim</CapsuleButton></Glass></main></Base>;

  const label = snapshot.invite?.label || 'the organizer';
  const finalized = snapshot.stage === 'finalized';
  const dead = Boolean(snapshot.invite?.disabledAt || !snapshot.invite);
  const continueToName = () => {
    setContinueDismissed(true);
    nameFormRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    document.getElementById('guest-claim-name')?.focus({ preventScroll: true });
  };
  const Page = embedded ? 'section' : 'main';
  const Title = embedded ? 'h2' : 'h1';
  return <Base kind="dark"><Page aria-label={`${snapshot.title} guest claim`} className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12">
    <header className="flex flex-col gap-3"><Eyebrow>Guest claim link · Simpler than signing up</Eyebrow><Title className="font-display text-[40px] leading-none text-fg md:text-[56px]">Choose from {label}'s available squares</Title><p className="font-ui text-lg text-fg-2">{snapshot.title}. Choose a square and enter the name that should appear on the board.</p><p className="font-ui text-sm text-fg-2">GridOne tracks the board. It does not collect square money, confirm payment, settle disputes, or pay winners.</p></header>
    <p role="status" className="font-ui text-sm text-fg-2">{sync.connection === 'live' ? 'Live availability' : sync.connection === 'offline' ? 'Offline · showing last known availability' : 'Reconnecting…'}{sync.stale ? ' Availability may have changed.' : ''}</p>
    {finalized && <Glass padding="lg"><p className="font-ui text-lg text-fg">Game numbers are locked. You can still follow the board.</p><a href={`/b/${snapshot.shareCode}`} className="mt-3 inline-flex min-h-11 items-center rounded-capsule px-5 font-ui text-action focus-visible:ring-2 focus-visible:ring-action">Open game board</a></Glass>}
    {dead && !finalized && <Glass padding="lg"><p className="font-ui text-lg text-fg">This invite link is no longer active.</p></Glass>}
    {error && <p role="alert" className="rounded-control border border-hairline bg-panel p-4 font-ui text-tone-cardinal">{error}</p>}
    {receipt && !changing ? <ClaimReceipt receipt={receipt} busy={busy} onChange={active ? () => { setChanging(true); setSelected(receipt.cells); } : undefined} onRelease={active ? () => void release() : undefined} /> : <>
      <GuestClaimBoard snapshot={snapshot} sellerLabel={label} selected={selected} ownedIndices={receipt?.cells} managing={changing} pendingIndex={pendingIndex} disabled={!active} onToggle={(index) => changing ? chooseReplacement(index) : void hold(index)} />
      {active && !changing && selected.length > 0 && !continueDismissed && <div className="fixed inset-x-4 bottom-4 z-30 md:hidden"><CapsuleButton className="w-full shadow-[var(--g-shadow)]" onClick={continueToName}>Continue with {selected.length === 1 ? `Square ${selected[0] + 1}` : `${selected.length} squares`}</CapsuleButton></div>}
      {active && <Glass padding="lg" className="flex flex-col gap-4">
        {holdLabel && <p role="timer" aria-label={`Held for you, ${holdLabel} left`} className="font-mono text-sm text-fg">Held for you — {holdLabel} left</p>}
        {changing ? <><p className="font-ui text-fg">Current claim: {receipt?.cells.map(index => `Square ${index + 1}`).join(', ')}</p><p className="font-ui text-fg-2">Choose the replacement square, then save. Your current claim stays in place unless the whole change succeeds.</p><div className="flex flex-wrap gap-2"><CapsuleButton disabled={busy || !selected.length} onClick={() => void swap()}>{busy ? 'Saving…' : 'Save square change'}</CapsuleButton><CapsuleButton variant="quiet" onClick={() => { setChanging(false); setSelected(receipt?.cells || []); }}>Keep current squares</CapsuleButton></div></> : <>
          <div ref={nameFormRef}><CapsuleInput id="guest-claim-name" label="Name on your squares" value={name} maxLength={30} onFocus={() => setContinueDismissed(true)} onChange={event => setName(event.target.value)} /><p className="mt-2 font-ui text-sm text-fg-2">2–30 characters. You can claim up to {maxSquares} {maxSquares === 1 ? 'square' : 'squares'} with this guest pass.</p></div>
          <CapsuleButton disabled={busy || !selected.length || !validGuestName(name)} onClick={() => void confirm()}>{busy ? 'Claiming…' : `Claim ${selected.length || 1} ${(selected.length || 1) === 1 ? 'square' : 'squares'}`}</CapsuleButton>
        </>}
      </Glass>}
    </>}
    {!receipt && <Glass padding="lg" className="flex flex-col gap-3"><h2 className="font-display text-[28px] text-fg">Already claimed?</h2><p className="font-ui text-sm text-fg-2">Enter your private four-word code to open your receipt on this device.</p><CapsuleInput label="Private claim code" value={claimCode} autoComplete="off" onChange={event => setClaimCode(event.target.value)} /><CapsuleButton disabled={busy || !validClaimCode(claimCode)} onClick={() => void recover()}>Open my claim</CapsuleButton></Glass>}
  </Page></Base>;
}
