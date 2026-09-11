import React from 'react';
import { Eyebrow, CapsuleButton, CapsuleInput, Glass } from '../../../design/primitives';
import type { PayoutDescriptions } from '../../../../types';

export type PayoutRulesStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface PayoutRulesCardProps {
  descriptions: PayoutDescriptions;
  status: PayoutRulesStatus;
  disabled?: boolean;
  onChange: (field: keyof PayoutDescriptions, value: string) => void;
  onSavePayoutDescriptions: () => void;
}

const FIELDS: Array<{ key: keyof PayoutDescriptions; label: string }> = [
  { key: 'Q1', label: 'Q1' },
  { key: 'HALF', label: 'Halftime' },
  { key: 'Q3', label: 'Q3' },
  { key: 'FINAL', label: 'Final' },
];

function StatusLine({ status }: { status: PayoutRulesStatus }) {
  switch (status) {
    case 'dirty':
      return <p role="status" className="font-mono text-[12px] text-fg-3">Unsaved payout rules</p>;
    case 'saved':
      return <p className="font-mono text-[12px] text-fg-3">Saved</p>;
    case 'error':
      return <p className="font-mono text-[12px] text-tone-cardinal">Save failed. Try again.</p>;
    default:
      return null;
  }
}

export default function PayoutRulesCard({ descriptions, status, disabled = false, onChange, onSavePayoutDescriptions }: PayoutRulesCardProps) {
  const saving = status === 'saving';
  return (
    <Glass padding="lg" className="flex flex-col gap-4">
      <Eyebrow>Payout rules</Eyebrow>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        {FIELDS.map(({ key, label }) => (
          <CapsuleInput
            key={key}
            label={label}
            maxLength={120}
            placeholder="Winner gets bragging rights"
            value={descriptions[key] ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(key, e.target.value)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="payout-rules-notes" className="font-ui text-[14px] text-fg-2">Board rules</label>
        <textarea
          id="payout-rules-notes"
          maxLength={280}
          className="rounded-control bg-panel border border-hairline px-4 py-3 font-ui text-[16px]"
          value={descriptions.notes ?? ''}
          disabled={disabled}
          onChange={(e) => onChange('notes', e.target.value)}
        />
      </div>
      <p className="font-ui text-[13px] text-fg-3">GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners. Describe prizes in words.</p>
      <div className="flex items-center gap-3">
        <CapsuleButton
          variant="primary"
          size="md"
          aria-busy={saving}
          disabled={disabled || saving}
          onClick={onSavePayoutDescriptions}
        >
          {saving ? 'Saving…' : 'Save payout rules'}
        </CapsuleButton>
        <StatusLine status={status} />
      </div>
    </Glass>
  );
}
