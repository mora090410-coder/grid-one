import React, { useEffect, useRef } from 'react';
import type { GuestReceipt } from './guestInviteTypes';
import { safePaymentUrl } from './guestInviteService';
import { CapsuleButton, Glass } from '../../design/primitives';

type Props = { receipt: GuestReceipt; busy?: boolean; onChange?: () => void; onRelease?: () => void };

export default function ClaimReceipt({ receipt, busy = false, onChange, onRelease }: Props) {
  const paymentUrl = safePaymentUrl(receipt.payment?.url);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [receipt.cells.length]);
  return <Glass padding="lg" className="flex flex-col gap-4" aria-label="Claim receipt">
    <div><h2 ref={heading} tabIndex={-1} className="font-display text-[32px] text-fg focus:outline-none">{receipt.cells.length ? 'Your squares are claimed' : receipt.canManage ? 'Your claim is open' : 'No squares currently claimed'}</h2><p className="font-ui text-fg-2">{receipt.displayName} · {receipt.cells.length ? receipt.cells.map(index => `Square ${index + 1}`).join(', ') : 'No squares currently claimed'}</p></div>
    {receipt.claimCode && <div className="rounded-control border border-hairline bg-ground p-4"><p className="font-ui text-sm text-fg-2">Save this private claim code to open your receipt on another device.</p><p className="mt-2 select-all break-words font-mono text-lg text-fg">{receipt.claimCode}</p></div>}
    {receipt.payment && <div className="flex flex-col gap-2"><h3 className="font-ui text-lg font-medium text-fg">{receipt.payment.label}</h3><p className="whitespace-pre-wrap break-words font-ui text-fg-2">{receipt.payment.detail}</p><p className="font-ui text-sm text-fg-2">Payments happen outside GridOne. Opening instructions does not mark a payment as complete.</p>{paymentUrl && <a href={paymentUrl} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" className="inline-flex min-h-11 items-center self-start rounded-capsule border border-hairline px-5 font-ui text-action focus-visible:ring-2 focus-visible:ring-action">{receipt.payment.label}</a>}</div>}
    {receipt.canManage && <div className="flex flex-wrap gap-2">{onChange && <CapsuleButton disabled={busy} onClick={onChange}>{receipt.cells.length ? 'Change squares' : 'Choose squares'}</CapsuleButton>}{onRelease && receipt.cells.length > 0 && <CapsuleButton variant="quiet" disabled={busy} onClick={onRelease}>Release my claim</CapsuleButton>}</div>}
  </Glass>;
}
