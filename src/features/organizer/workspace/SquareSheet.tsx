import React, { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../../design/primitives/Sheet';
import { CapsuleButton, CapsuleInput, CapsuleTag } from '../../../design/primitives';
import type { EntryMeta, SquareAvailability } from '../../../../types';

export interface SquareSheetProps {
  open: boolean;
  index: number | null;
  name: string;
  allocationLabel?: string | null;
  meta?: EntryMeta;
  availability?: SquareAvailability;
  isPublished: boolean;
  hasNextOpen: boolean;
  onSave: (index: number, name: string, meta: EntryMeta, advance: boolean, allocationLabel?: string | null, availability?: SquareAvailability) => void;
  onClose: () => void;
}

type PaidStatus = EntryMeta['paid_status'];

const PAID_OPTIONS: { value: PaidStatus; label: string; tone: 'neutral' | 'turf' }[] = [
  { value: 'unknown', label: 'Not asked yet', tone: 'neutral' },
  { value: 'unpaid', label: 'Unpaid', tone: 'neutral' },
  { value: 'paid', label: 'Paid', tone: 'turf' },
];

const PUBLISHED_HELPER = 'This board is published. Renaming a square is recorded in the board history and updates the shared link right away.';

/** Bottom sheet for editing a display name and payment while retaining responsibility to one square. */
export default function SquareSheet({ open, index, name, allocationLabel, availability, meta, isPublished, hasNextOpen, onSave, onClose }: SquareSheetProps) {
  const [nameValue, setNameValue] = useState(name);
  const [paidStatus, setPaidStatus] = useState<PaidStatus>(meta?.paid_status ?? 'unknown');
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    setNameValue(name);
    setPaidStatus(meta?.paid_status ?? 'unknown');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  if (!open) return null;

  const buildMeta = (): EntryMeta => ({
    cell_index: index ?? 0,
    paid_status: paidStatus,
    notify_opt_in: meta?.notify_opt_in ?? false,
    contact_type: meta?.contact_type ?? null,
    contact_value: meta?.contact_value ?? null,
    seller_label: meta?.seller_label ?? null,
  });

  const showSaveAndNext = hasNextOpen && !isPublished;

  const save = (advance: boolean) => {
    if (index === null || nameValue.trim().length > 80) return;
    if (availability !== undefined) {
      onSave(index, nameValue, buildMeta(), advance, allocationLabel || (isPublished ? null : nameValue.trim() || null), availability);
      return;
    }
    if (allocationLabel !== undefined) onSave(index, nameValue, buildMeta(), advance, allocationLabel || (isPublished ? null : nameValue.trim() || null));
    else onSave(index, nameValue, buildMeta(), advance);
  };

  const onNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    save(showSaveAndNext);
  };

  const onPaymentKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, position: number) => {
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    if (!back && !forward) return;
    event.preventDefault();
    const next = (position + (back ? -1 : 1) + PAID_OPTIONS.length) % PAID_OPTIONS.length;
    setPaidStatus(PAID_OPTIONS[next].value);
    radioRefs.current[next]?.focus();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Square ${(index ?? 0) + 1}`}>
      <div className="flex flex-col gap-5">
        {isPublished && <p className="font-ui text-[14px] text-fg-2">{PUBLISHED_HELPER}</p>}
        <CapsuleInput
          label="Name on the board"
          maxLength={80}
          value={nameValue}
          onChange={(event) => setNameValue(event.target.value)}
          onKeyDown={onNameKeyDown}
          autoFocus
        />
        {allocationLabel && (
          <div className="font-ui text-[14px] text-fg-2">
            <p>Responsible person or family: <span className="text-fg">{allocationLabel}</span></p>
            <p>Changing the name on the board keeps this responsibility unchanged.</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <span className="font-ui text-[14px] text-fg-2">Payment</span>
          <div role="radiogroup" aria-label="Payment" className="flex flex-wrap gap-2">
            {PAID_OPTIONS.map((option, position) => (
              <button
                key={option.value}
                ref={(node) => { radioRefs.current[position] = node; }}
                type="button"
                role="radio"
                aria-checked={paidStatus === option.value}
                onClick={() => setPaidStatus(option.value)}
                onKeyDown={(event) => onPaymentKeyDown(event, position)}
                className="min-h-11 min-w-11 px-3 rounded-capsule inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
              >
                <CapsuleTag tone={paidStatus === option.value ? option.tone : 'neutral'}>{option.label}</CapsuleTag>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <CapsuleButton variant="quiet" disabled={nameValue.trim().length > 80} onClick={() => save(false)}>Save</CapsuleButton>
          {showSaveAndNext && <CapsuleButton disabled={nameValue.trim().length > 80} onClick={() => save(true)}>Save and next</CapsuleButton>}
        </div>
      </div>
    </Sheet>
  );
}
