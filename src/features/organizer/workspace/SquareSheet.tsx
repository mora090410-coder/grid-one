import React, { useRef, useState } from 'react';
import { Sheet } from '../../../design/primitives/Sheet';
import { CapsuleButton, CapsuleInput } from '../../../design/primitives';
import type { EntryMeta, SquareAvailability } from '../../../../types';
import { isBlankOpenSquareSave, OPEN_SQUARE_NAME_REQUIRED } from './workspaceBoardModel';

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

const PAID_OPTIONS: { value: PaidStatus; label: string }[] = [
  { value: 'unknown', label: 'Not asked yet' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
];

const PUBLISHED_HELPER = 'This board is published. Renaming a square is recorded in the board history and updates the shared link right away.';

/** Bottom sheet for editing a display name and payment while retaining responsibility to one square. */
export default function SquareSheet({ open, index, name, allocationLabel, availability, meta, isPublished, hasNextOpen, onSave, onClose }: SquareSheetProps) {
  const [nameValue, setNameValue] = useState(name);
  const [paidStatus, setPaidStatus] = useState<PaidStatus>(meta?.paid_status ?? 'unknown');
  const [formError, setFormError] = useState<string | null>(null);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Reset while rendering, not in an effect. An effect's update is deferred, so
  // the field still shows the previous square when the next name is entered.
  const [shownSquare, setShownSquare] = useState({ open, index });
  if (shownSquare.open !== open || shownSquare.index !== index) {
    setShownSquare({ open, index });
    setNameValue(name);
    setPaidStatus(meta?.paid_status ?? 'unknown');
    setFormError(null);
  }

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
    if (isBlankOpenSquareSave(name, nameValue)) {
      setFormError(OPEN_SQUARE_NAME_REQUIRED);
      return;
    }
    setFormError(null);
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
          onChange={(event) => {
            setNameValue(event.target.value);
            if (formError) setFormError(null);
          }}
          onKeyDown={onNameKeyDown}
          autoFocus
          aria-invalid={formError ? true : undefined}
          aria-describedby={formError ? 'square-name-error' : undefined}
        />
        {formError && <p id="square-name-error" role="alert" className="font-ui text-[15px] text-tone-cardinal">{formError}</p>}
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
                tabIndex={paidStatus === option.value ? 0 : -1}
                onClick={() => setPaidStatus(option.value)}
                onKeyDown={(event) => onPaymentKeyDown(event, position)}
                className="group min-h-11 min-w-11 px-3 rounded-capsule inline-flex items-center gap-2 border border-hairline font-ui text-base text-fg aria-checked:border-fg aria-checked:bg-fg aria-checked:text-ground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
              >
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full border border-current group-aria-checked:bg-current" />
                {option.label}
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
