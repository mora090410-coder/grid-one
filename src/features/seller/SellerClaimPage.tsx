import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Base, CapsuleButton, CapsuleInput, Eyebrow, Glass } from '../../design/primitives';
import { PageMetadata } from '../../../components/seo/PageMetadata';
import { MAX_CLAIM, amountOwed, claimedSquaresText, cleanName, gameLine, parseSellerView, rememberBuyer, toggleSquare, type SellerView } from './sellerClaimModel';

const DEAD_LINK = 'This seller link isn’t active. Ask the seller for a new one.';

/** Public page behind a seller's link: pick open squares, type a name, claim. No account. */
export default function SellerClaimPage() {
  const { code = '' } = useParams();
  const validCode = /^[a-f0-9]{16}$/.test(code);
  const [view, setView] = useState<SellerView | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(validCode ? '' : DEAD_LINK);
  const [claimed, setClaimed] = useState<{ cells: number[]; name: string } | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);

  async function load() {
    if (!validCode) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/sellers/${code}`, { cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(response.status === 404 ? 'dead' : 'failed');
      const next = parseSellerView(await response.json());
      if (!next) throw new Error('failed');
      if (!mounted.current) return;
      setView(next);
      // Drop anything someone else claimed meanwhile.
      setSelected((current) => current.filter((index) => next.cells.some((cell) => cell.index === index && cell.available)));
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error && cause.message === 'dead' ? DEAD_LINK : 'Couldn’t load these squares. Check your connection and try again.');
    } finally { if (mounted.current) setBusy(false); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [code]);

  const buyer = cleanName(name);
  const canClaim = Boolean(view?.open && selected.length > 0 && buyer.length >= 1 && buyer.length <= 80 && !busy);

  async function claim(event: React.FormEvent) {
    event.preventDefault();
    if (!view || !canClaim || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/sellers/${code}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', referrerPolicy: 'no-referrer',
        body: JSON.stringify({ cells: selected, name: buyer }),
      });
      const result = await response.json().catch(() => null) as { code?: string; error?: string; cells?: number[]; name?: string } | null;
      if (!response.ok) {
        if (!mounted.current) return;
        if (result?.code === 'SQUARE_TAKEN') { setError('Someone just grabbed one of those squares. Pick another.'); submitting.current = false; setBusy(false); void load(); return; }
        if (result?.code === 'BOARD_LOCKED') { setView({ ...view, open: false }); setError(''); return; }
        setError(response.status === 404 ? DEAD_LINK : 'That didn’t go through. Nothing was claimed. Try again.');
        return;
      }
      const cells = Array.isArray(result?.cells) ? result!.cells.filter((index) => Number.isInteger(index)) : selected;
      const savedName = typeof result?.name === 'string' ? result.name : buyer;
      rememberBuyer(view.shareCode, savedName);
      if (mounted.current) setClaimed({ cells, name: savedName });
    } catch {
      if (mounted.current) setError('That didn’t go through. Check your connection and try again.');
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }

  const open = view?.cells.filter((cell) => cell.available) ?? [];
  const boardLink = view ? `/b/${view.shareCode}` : null;
  const matchup = view ? gameLine(view) : null;

  return <Base kind="dark"><PageMetadata title={view ? `${view.label}’s squares | ${view.title}` : 'Pick your squares | GridOne'} description="Pick football squares from a seller and add your name." path={`/s/${code}`} noIndex />
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 md:py-12">
      {error && <p role="alert" className="rounded-control border border-hairline bg-panel p-4 font-ui text-base text-fg">{error}</p>}
      {!view && busy && <p role="status" className="font-ui text-base text-fg-2">Opening the squares…</p>}
      {!view && validCode && !busy && error !== DEAD_LINK && <CapsuleButton onClick={() => { setError(''); void load(); }}>Try again</CapsuleButton>}

      {view && claimed && <section className="flex flex-col gap-4" aria-labelledby="claimed-heading">
        <Eyebrow>{view.title}</Eyebrow>
        <h1 id="claimed-heading" className="font-display text-[40px] leading-none text-fg">You’re in!</h1>
        <p className="font-ui text-[19px] text-fg">{claimedSquaresText(claimed.cells)} {claimed.cells.length === 1 ? 'is' : 'are'} yours.</p>
        <Glass padding="lg" className="flex flex-col gap-2">
          <p className="font-ui text-base text-fg">Pay {view.label} however you usually do. GridOne doesn’t handle money.</p>
          {view.squarePrice && <p className="font-ui text-base text-fg-2">{view.squarePrice} a square</p>}
          {amountOwed(view.squarePrice, claimed.cells.length) && <p className="font-ui text-base font-semibold text-fg">Total: {amountOwed(view.squarePrice, claimed.cells.length)}</p>}
          {view.instructions && <p className="whitespace-pre-wrap break-words font-ui text-base text-fg-2">{view.instructions}</p>}
        </Glass>
        <p className="font-ui text-sm text-fg-2">On game day, open the board on this phone and it goes straight to your squares.</p>
        {boardLink && <Link to={boardLink} className="inline-flex h-12 items-center justify-center rounded-capsule bg-action px-7 font-ui text-[17px] font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground">See the whole board</Link>}
      </section>}

      {view && !claimed && <>
        <header className="flex flex-col gap-3">
          <Eyebrow>{view.title}</Eyebrow>
          <h1 className="break-words font-display text-[40px] leading-none text-fg">Pick your squares from {view.label}</h1>
          {matchup && <p className="font-ui text-base text-fg-2">{matchup}</p>}
          {view.squarePrice && <p className="font-ui text-base text-fg">{view.squarePrice} a square</p>}
        </header>

        {!view.open ? <Glass padding="lg" className="flex flex-col gap-3">
          <p className="font-ui text-base text-fg">The numbers are locked, so claiming is closed.</p>
          {boardLink && <Link to={boardLink} className="font-ui text-base text-fg underline underline-offset-4">See the whole board</Link>}
        </Glass> : <form onSubmit={claim} className="flex flex-col gap-6">
          <div role="group" aria-label={`${view.label}’s squares`} className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {view.cells.map((cell) => {
              const isSelected = selected.includes(cell.index);
              return <button key={cell.index} type="button" disabled={!cell.available || busy}
                aria-pressed={cell.available ? isSelected : undefined}
                aria-label={`Square ${cell.index + 1}, ${cell.available ? 'open' : 'taken'}`}
                onClick={() => setSelected((current) => toggleSquare(current, cell.index))}
                className={`flex min-h-14 flex-col items-center justify-center rounded-control border font-mono tabular-nums transition-[background-color,border-color] duration-[var(--g-dur-state)] ease-[var(--g-ease-state)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action ${isSelected ? 'border-action bg-action text-action-text' : cell.available ? 'border-cell-edge bg-panel text-fg hover:bg-panel-hover' : 'border-cell-edge bg-transparent text-fg-3'}`}>
                <span aria-hidden="true" className="text-[18px]">{cell.index + 1}</span>
                <span aria-hidden="true" className="font-ui text-[12px]">{cell.available ? (isSelected ? 'Picked' : 'Open') : 'Taken'}</span>
              </button>;
            })}
          </div>
          {open.length === 0 && <p className="font-ui text-base text-fg-2">All of {view.label}’s squares are taken.</p>}
          {open.length > 0 && <p className="font-ui text-sm text-fg-2" aria-live="polite">{selected.length ? `${selected.length} picked.` : 'Tap the squares you want.'} Up to {MAX_CLAIM} at a time.</p>}
          <CapsuleInput label="Your name, as it shows on the board" value={name} maxLength={80} autoComplete="name" disabled={busy} onChange={(event) => setName(event.target.value)} />
          <CapsuleButton type="submit" size="lg" disabled={!canClaim}>
            {busy && selected.length ? 'Claiming…' : `Claim ${selected.length || ''} ${selected.length === 1 ? 'square' : 'squares'}`.replace('  ', ' ')}
          </CapsuleButton>
          <p className="font-ui text-sm text-fg-2">You pay {view.label} directly. GridOne doesn’t handle money.</p>
        </form>}
      </>}
    </main>
  </Base>;
}
