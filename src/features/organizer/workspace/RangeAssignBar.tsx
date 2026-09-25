import React, { useRef, useState } from 'react';
import { Glass, Eyebrow, CapsuleButton, CapsuleInput, CapsuleTag } from '../../../design/primitives';
import type { EntryMeta } from '../../../../types';

type Paid = EntryMeta['paid_status'];

export interface RangeAssignInput {
  name: string;
  seller: string;
  paid: Paid;
}

export interface RangeAssignBarProps {
  count: number;
  /** How many of the selected squares already carry a name. */
  namedCount?: number;
  isPublished: boolean;
  busy: boolean;
  onApply: (input: RangeAssignInput) => void;
  onClear: () => void;
  /** Escape inside the bar leaves select mode, same as Escape on a square. */
  onExitSelectMode?: () => void;
}

const PAID_OPTIONS: { value: Paid; label: string; tone: 'neutral' | 'cardinal' | 'turf' }[] = [
  { value: 'unknown', label: 'Not asked yet', tone: 'neutral' },
  { value: 'unpaid', label: 'Unpaid', tone: 'cardinal' },
  { value: 'paid', label: 'Paid', tone: 'turf' },
];

const DRAFT_HELP = 'Tap squares to select them, or drag across a block.';
const PUBLISHED_HELP = 'Only OPEN squares can be selected. Sold squares and axis digits do not change.';

/** Inline bar for labelling every selected square at once. */
export default function RangeAssignBar({
  count,
  namedCount = 0,
  isPublished,
  busy,
  onApply,
  onClear,
  onExitSelectMode,
}: RangeAssignBarProps) {
  const [name, setName] = useState('');
  const [paid, setPaid] = useState<Paid>('unknown');
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const canApply = name.trim().length > 0 && name.trim().length <= 80 && !busy;

  const onPaymentKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, position: number) => {
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    if (!back && !forward) return;
    event.preventDefault();
    const step = back ? -1 : 1;
    const next = (position + step + PAID_OPTIONS.length) % PAID_OPTIONS.length;
    setPaid(PAID_OPTIONS[next].value);
    radioRefs.current[next]?.focus();
  };

  return (
    <Glass
      id="allocation-editor"
      role="group"
      aria-label="Assign selected squares"
      className="flex flex-col gap-4"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !onExitSelectMode) return;
        event.preventDefault();
        onExitSelectMode();
      }}
    >
      <div aria-live="polite">
        <h2 className="font-ui text-lg font-medium">Allocate squares</h2>
        <Eyebrow>{count} selected</Eyebrow>
      </div>
      <CapsuleInput
        label="Name for these squares"
        maxLength={80}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      {!isPublished && (
        <div className="flex flex-col gap-2">
          <span className="font-ui text-[14px] text-fg-2">Payment</span>
          <div role="radiogroup" aria-label="Payment" className="flex flex-wrap gap-2">
            {PAID_OPTIONS.map((option, position) => (
              <button
                key={option.value}
                ref={(node) => { radioRefs.current[position] = node; }}
                type="button"
                role="radio"
                aria-checked={paid === option.value}
                onClick={() => setPaid(option.value)}
                onKeyDown={(event) => onPaymentKeyDown(event, position)}
                className="min-h-11 min-w-11 px-3 rounded-capsule inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
              >
                <CapsuleTag tone={paid === option.value ? option.tone : 'neutral'}>{option.label}</CapsuleTag>
              </button>
            ))}
          </div>
        </div>
      )}
      {!isPublished && namedCount > 0 && (
        <p className="font-ui text-[14px] text-tone-cardinal">
          {namedCount} of these already have a name. Apply replaces them.
        </p>
      )}
      <p className="font-ui text-[14px] text-fg-2">{isPublished ? PUBLISHED_HELP : `${DRAFT_HELP} The first assigned person stays responsible when you change a displayed name.`}</p>
      <div className="flex flex-wrap gap-2">
        <CapsuleButton
          variant="primary"
          disabled={!canApply}
          onClick={() => onApply({ name: name.trim(), seller: '', paid })}
        >
          {busy ? 'Assigning…' : `Apply to ${count}`}
        </CapsuleButton>
        <CapsuleButton variant="quiet" onClick={onClear}>Clear selection</CapsuleButton>
      </div>
    </Glass>
  );
}
