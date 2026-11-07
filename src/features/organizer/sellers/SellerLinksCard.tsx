import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../../services/supabase';
import { CapsuleButton, Eyebrow, Glass } from '../../../design/primitives';
import { track } from '../../instrumentation/track';
import { allLinksMessage, parseSellerLinks, sellerShareText, sellerHandoffText, summarizeSellers, type SellerLink } from './sellerLinksModel';

type Props = {
  boardId: string;
  boardTitle: string;
  shared: boolean;
  labels: (string | null)[];
  squares: string[][];
  clean: boolean;
  flush: () => Promise<{ status: string; revision: number }>;
};

/**
 * Every seller gets one public link. Buyers open it, pick that seller's
 * unsold squares, and type their name. Sellers collect the money.
 */
export default function SellerLinksCard({ boardId, boardTitle, shared, labels, squares, clean, flush }: Props) {
  const [links, setLinks] = useState<SellerLink[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    setLinks(null); setBusy(false); setError(''); setMessage(''); setConfirming(null); setPreviewing(null);
    return () => { pending.current?.abort(); pending.current = null; };
  }, [boardId, shared]);
  const sellers = summarizeSellers(labels, squares);
  const totalSquares = sellers.reduce((sum, seller) => sum + seller.total, 0);
  if (!sellers.length) return null;

  const request = async (body: Record<string, string>) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller; setBusy(true); setError(''); setMessage('');
    const timeoutMessage = 'Seller links are taking too long. Try again.';
    const deadline = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error(timeoutMessage)), { once: true });
    });
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const operation = async () => {
        const saved = await flush();
        controller.signal.throwIfAborted();
        if (saved.status !== 'clean') throw new Error('Save your latest changes first.');
        const { data } = await supabase.auth.getSession();
        controller.signal.throwIfAborted();
        if (!data.session?.access_token) throw new Error('Sign in again to get seller links.');
        const response = await fetch(`/api/pools/${encodeURIComponent(boardId)}/seller-links`, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body),
        });
        controller.signal.throwIfAborted();
        const result = await response.json().catch(() => null);
        controller.signal.throwIfAborted();
        if (!response.ok) throw new Error(result?.error || 'Seller links are temporarily unavailable. Please try again.');
        const next = parseSellerLinks(result);
        if (!next) throw new Error('Seller links are temporarily unavailable. Please try again.');
        return next;
      };
      const next = await Promise.race([operation(), deadline]);
      if (pending.current !== controller) return;
      setLinks(next);
      if (body.action === 'rotate') setMessage(`${body.label} has a new link. The old one stopped working.`);
    } catch (failure) {
      if (pending.current !== controller) return;
      // Rotation may already have committed even if its response was lost.
      // Never offer a potentially revoked link or automatically rotate again.
      if (body.action === 'rotate') {
        setLinks(null);
        setError('Link replacement could not be confirmed. Get seller links to check the current links before trying again.');
        return;
      }
      setError(failure instanceof Error ? failure.message : 'Seller links are temporarily unavailable. Please try again.');
    } finally {
      window.clearTimeout(timer);
      if (pending.current === controller) { pending.current = null; setBusy(false); setConfirming(null); }
    }
  };

  const copy = async (text: string, done: string) => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(text);
      setMessage(done);
    } catch {
      track({ name: 'recoverable_ui_failure_code', code: 'clipboard_denied', surface: 'organizer' });
      setMessage('Couldn’t copy. Press and hold the link to copy it.');
    }
  };

  const share = async (link: SellerLink) => {
    const text = sellerShareText(boardTitle);
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: boardTitle, text, url: link.url }); return; } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
      }
    }
    await copy(`${text} ${link.url}`, `${link.label}’s link copied.`);
  };

  return <Glass as="section" padding="lg" className="mt-4 flex flex-col gap-4" aria-labelledby="seller-links-heading">
    <div className="flex flex-col gap-1">
      <Eyebrow>Sell squares</Eyebrow>
      <h2 id="seller-links-heading" className="font-display text-[28px] leading-tight text-fg">Send seller links</h2>
      <p className="font-ui text-[15px] text-fg-2">{sellers.length} {sellers.length === 1 ? 'seller' : 'sellers'} · {totalSquares} squares</p>
    </div>
    {!shared ? <p className="font-ui text-[15px] text-fg-2">Share your board first. Then every seller gets their own link.</p> : <>
      <p className="font-ui text-[15px] text-fg-2">Each seller posts their link. Buyers pick from that seller’s squares and add their name. The seller collects the money.</p>
      {!links && <CapsuleButton disabled={busy || !clean} onClick={() => void request({ action: 'sync' })}>{busy ? 'Getting links…' : 'Get seller links'}</CapsuleButton>}
      {!clean && !links && <p className="font-ui text-[14px] text-fg-2">Links are ready once your latest changes save.</p>}
      {links && <>
        <ul aria-label="Seller links" className="flex flex-col gap-2">
          {links.map((link) => {
            const summary = sellers.find((seller) => seller.label === link.label);
            return <li key={link.code} aria-label={link.label} className="flex flex-col gap-2 rounded-control border border-hairline bg-panel p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="break-words font-ui text-[16px] font-semibold text-fg"><span aria-hidden="true" className="g1-seller-dot" style={{display:'inline-block',marginRight:8,background:`color-mix(in srgb, var(--g1-seller-${sellers.findIndex(seller=>seller.label===link.label) % 6 + 1}) 55%, transparent)`}}/>{link.label}</span>
                {summary && <span className="font-ui text-[14px] text-fg-2">{summary.total} {summary.total === 1 ? 'square' : 'squares'} · {summary.unsold} not sold yet</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <CapsuleButton variant="quiet" disabled={busy || !clean} aria-label={`Preview ${link.label}’s handoff`} aria-expanded={previewing === link.code} aria-controls={`seller-handoff-${link.code}`} onClick={() => setPreviewing(value => value === link.code ? null : link.code)}>Preview seller handoff</CapsuleButton>
                <CapsuleButton variant="quiet" disabled={busy} aria-label={`Share ${link.label}’s link`} onClick={() => void share(link)}>Share link</CapsuleButton>
                {confirming === link.label
                  ? <CapsuleButton variant="ghost" disabled={busy} aria-label={`Yes, replace ${link.label}’s link`} onClick={() => void request({ action: 'rotate', label: link.label })}>Yes, replace it</CapsuleButton>
                  : <CapsuleButton variant="ghost" disabled={busy} aria-label={`New link for ${link.label}`} onClick={() => setConfirming(link.label)}>New link</CapsuleButton>}
              </div>
              {previewing === link.code && <div id={`seller-handoff-${link.code}`} role="region" aria-label={`${link.label}’s handoff`} className="g-handoff flex flex-col gap-3 border-t border-hairline pt-4">
                <h3 className="font-ui text-lg font-semibold text-fg">Organizer → {link.label}</h3>
                <p className="font-ui text-base text-fg-2">Preview only. Nothing has been emailed.</p>
                <textarea aria-label={`Handoff message for ${link.label}`} readOnly rows={9} value={sellerHandoffText(boardTitle, link, labels, squares)} className="w-full resize-y rounded-control border border-hairline bg-ground p-3 font-ui text-base leading-relaxed text-fg" />
                <CapsuleButton aria-label={`Copy ${link.label}’s handoff`} disabled={!clean || busy} onClick={() => void copy(sellerHandoffText(boardTitle, link, labels, squares), 'Handoff copied. Nothing was emailed.')}>Copy handoff message</CapsuleButton>
              </div>}
              {confirming === link.label && <p className="font-ui text-[14px] text-fg-2">The old link stops working. Squares already claimed stay claimed.</p>}
            </li>;
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <CapsuleButton disabled={busy} onClick={() => void copy(allLinksMessage(boardTitle, links), 'All links copied. Paste them in your team chat.')}>Copy all links</CapsuleButton>
          <CapsuleButton variant="quiet" disabled={busy || !clean} onClick={() => void request({ action: 'sync' })}>Update for new sellers</CapsuleButton>
        </div>
      </>}
    </>}
    {message && <p role="status" className="font-ui text-[14px] text-fg-2">{message}</p>}
    {error && <p role="alert" className="font-ui text-[14px] text-tone-cardinal">{error}</p>}
  </Glass>;
}
