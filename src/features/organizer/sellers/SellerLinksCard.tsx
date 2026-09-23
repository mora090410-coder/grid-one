import React, { useRef, useState } from 'react';
import { supabase } from '../../../../services/supabase';
import { CapsuleButton, Eyebrow, Glass } from '../../../design/primitives';
import { allLinksMessage, parseSellerLinks, sellerShareText, summarizeSellers, type SellerLink } from './sellerLinksModel';

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
  const pending = useRef(false);
  const sellers = summarizeSellers(labels, squares);
  const totalSquares = sellers.reduce((sum, seller) => sum + seller.total, 0);
  if (!sellers.length) return null;

  const request = async (body: Record<string, string>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const saved = await flush();
      if (saved.status !== 'clean') throw new Error('Save your latest changes first.');
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error('Sign in again to get seller links.');
      const response = await fetch(`/api/pools/${encodeURIComponent(boardId)}/seller-links`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Seller links are temporarily unavailable. Please try again.');
      const next = parseSellerLinks(result);
      if (!next) throw new Error('Seller links are temporarily unavailable. Please try again.');
      setLinks(next);
      if (body.action === 'rotate') setMessage(`${body.label} has a new link. The old one stopped working.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Seller links are temporarily unavailable. Please try again.');
    } finally { pending.current = false; setBusy(false); setConfirming(null); }
  };

  const copy = async (text: string, done: string) => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(text);
      setMessage(done);
    } catch { setMessage('Couldn’t copy. Press and hold the link to copy it.'); }
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
                <span className="break-words font-ui text-[16px] font-semibold text-fg">{link.label}</span>
                {summary && <span className="font-ui text-[14px] text-fg-2">{summary.total} {summary.total === 1 ? 'square' : 'squares'} · {summary.unsold} not sold yet</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <CapsuleButton variant="quiet" disabled={busy} aria-label={`Share ${link.label}’s link`} onClick={() => void share(link)}>Share link</CapsuleButton>
                {confirming === link.label
                  ? <CapsuleButton variant="ghost" disabled={busy} aria-label={`Yes, replace ${link.label}’s link`} onClick={() => void request({ action: 'rotate', label: link.label })}>Yes, replace it</CapsuleButton>
                  : <CapsuleButton variant="ghost" disabled={busy} aria-label={`New link for ${link.label}`} onClick={() => setConfirming(link.label)}>New link</CapsuleButton>}
              </div>
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
