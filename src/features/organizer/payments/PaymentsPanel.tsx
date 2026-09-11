import React, { useEffect, useId, useRef, useState } from 'react';
import { Sheet } from '../../../design/primitives/Sheet';
import { CapsuleButton, CapsuleInput } from '../../../design/primitives/Capsule';
import { buildPaymentModel, filterPaymentGroups, type PaymentFilter, type PaymentStatus } from './paymentModel';

export interface PaymentsPanelProps {
  open: boolean;
  onClose: () => void;
  model: ReturnType<typeof buildPaymentModel>;
  initialQuery?: string;
  initialFilter?: PaymentFilter;
  busy?: boolean;
  disabled?: boolean;
  onSave: (indices: number[], status: PaymentStatus) => Promise<void>;
  onViewSquare: (index: number) => void;
}
const labels: Record<PaymentStatus, string> = { paid: 'Paid', unpaid: 'Unpaid', unknown: 'Not asked yet' };
const statuses: PaymentStatus[] = ['paid', 'unpaid', 'unknown'];

export function PaymentsPanel({ open, onClose, model, initialQuery = '', initialFilter = 'all', busy = false, disabled = false, onSave, onViewSquare }: PaymentsPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<PaymentFilter>(initialFilter);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const failedIndices = useRef<number[]>([]);
  const [failedStatus, setFailedStatus] = useState<PaymentStatus | null>(null);
  const [notice, setNotice] = useState('');
  const prefix = useId();
  useEffect(() => {
    if (open) {
      setQuery(initialQuery); setFilter(initialFilter); setSelection([]);
      setExpanded(new Set()); setFailedStatus(null); setNotice('');
    }
  }, [open, initialQuery, initialFilter]);
  const groups = filterPaymentGroups(model, query, filter);
  const visibleIndices = new Set(groups.filter(group => expanded.has(group.id)).flatMap(group => group.squares.map(square => square.index)));
  const selected = selection.filter(index => visibleIndices.has(index));
  const retryScopeMatches = failedIndices.current.length === selected.length && failedIndices.current.every(index => selected.includes(index));
  const locked = saving || busy || disabled;
  function clearSelection() { setSelection([]); setFailedStatus(null); setNotice(''); }
  async function save(status: PaymentStatus) {
    if (locked || savingRef.current || !selected.length) return;
    savingRef.current = true;
    const indices = [...selected];
    setSaving(true); setFailedStatus(null); setNotice('Saving payment notes…');
    try {
      await onSave(indices, status);
      setSelection([]); setNotice(`Saved ${indices.length} square${indices.length === 1 ? '' : 's'} as ${labels[status].toLowerCase()}.`);
    } catch {
      failedIndices.current = indices; setFailedStatus(status); setNotice('');
    } finally { savingRef.current = false; setSaving(false); }
  }
  return <Sheet open={open} onClose={onClose} title="Payments" height="full" solidSurface>
    <div className="space-y-6 font-ui text-fg">
      <div className="space-y-2">
        <p className="text-2xl font-medium">{model.totals.paid} of {model.totals.assigned} assigned squares paid</p>
        <p className="text-base text-fg-2">Private to you. These notes track payment status. GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.</p>
      </div>
      <CapsuleInput label="Search people, names or square number" type="search" value={query} disabled={saving} onChange={event => { setQuery(event.target.value); clearSelection(); }} />
      <div role="group" aria-label="Filter payment status" className="flex flex-wrap gap-2">
        {(['all', ...statuses] as PaymentFilter[]).map(status => <CapsuleButton key={status} variant={filter === status ? 'primary' : 'quiet'} aria-pressed={filter === status} disabled={saving} onClick={() => { setFilter(status); clearSelection(); }}>
          {status === 'all' ? 'All' : labels[status]} · {status === 'all' ? model.totals.assigned : model.totals[status]} squares
        </CapsuleButton>)}
      </div>
      {!selected.length && <p className="text-base text-fg">Select squares below to update payment status.</p>}
      {!groups.length && <p className="py-6 text-lg">{model.totals.assigned ? 'No matching squares.' : 'No assigned squares yet. Assign a person or family on the board to start tracking.'}</p>}
      <div className="space-y-4">
        {groups.map((group, groupIndex) => {
          const isExpanded = expanded.has(group.id);
          const groupSelected = group.squares.every(square => selected.includes(square.index));
          const contentId = `${prefix}-group-${groupIndex}`;
          return <section key={group.id} className="border-b border-hairline pb-4">
            <button type="button" disabled={saving} className="w-full min-h-11 rounded-control py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action" aria-expanded={isExpanded} aria-controls={contentId} aria-label={`${isExpanded ? 'Hide' : 'Show'} squares for ${group.label}`} onClick={() => {
              setExpanded(current => { const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; });
              setSelection(current => current.filter(index => !group.squares.some(square => square.index === index)));
              setFailedStatus(null);
            }}>
              <span className="block break-words text-xl font-medium">{group.label}</span>
              <span className="mt-2 block text-base text-fg-2">{group.squares.length} shown of {group.paid + group.unpaid + group.unknown} squares · {group.paid} paid · {group.unpaid} unpaid · {group.unknown} not asked yet</span>
              <span className="mt-2 block text-sm underline underline-offset-4">{isExpanded ? 'Hide squares' : 'Show squares'}</span>
            </button>
            <CapsuleButton variant="quiet" disabled={locked} className="mb-3" aria-label={`${groupSelected ? 'Clear' : 'Select'} ${group.squares.length} shown squares for ${group.label}`} onClick={() => {
              setExpanded(current => new Set(current).add(group.id));
              const indices = group.squares.map(square => square.index);
              setSelection(current => groupSelected ? current.filter(index => !indices.includes(index)) : [...new Set([...current, ...indices])]);
              setFailedStatus(null); setNotice('');
            }}>{groupSelected ? 'Clear' : 'Select'} {group.squares.length} shown {group.squares.length === 1 ? 'square' : 'squares'}</CapsuleButton>
            {isExpanded && <ul id={contentId} className="divide-y divide-hairline">
              {group.squares.map(square => <li key={square.index} className="scroll-mb-64 py-4">
                <label className="flex min-h-11 items-start gap-3 rounded-control py-2">
                  <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 scroll-mb-64 accent-action" aria-label={`Select square ${square.index + 1}`} checked={selected.includes(square.index)} disabled={locked} onChange={event => { setSelection(current => event.target.checked ? [...current, square.index] : current.filter(index => index !== square.index)); setFailedStatus(null); setNotice(''); }} />
                  <span className="min-w-0 text-base"><span className="font-mono">Square {square.index + 1}</span><span className="block break-words">{square.names.join(' & ') || 'No displayed name'}</span><span className="block text-fg-2">{labels[square.status]}</span></span>
                </label>
                <CapsuleButton variant="ghost" className="scroll-mb-64" disabled={saving} aria-label={`View square ${square.index + 1} on board`} onClick={() => onViewSquare(square.index)}>View on board</CapsuleButton>
              </li>)}
            </ul>}
          </section>;
        })}
      </div>
      <div className="sticky bottom-0 z-10 space-y-3 border-t border-hairline bg-ground py-4" role="group" aria-label="Update selected payment notes" aria-busy={saving}>
        {selected.length > 0 && <p className="text-base font-medium">{selected.length} {selected.length === 1 ? 'square' : 'squares'} selected</p>}
        {selected.length > 0 && <div className="flex flex-wrap gap-2">
          {statuses.map(status => <CapsuleButton key={status} variant="quiet" className="h-auto min-h-11 py-3 text-left" disabled={locked || !selected.length || (!!failedStatus && !retryScopeMatches)} onClick={() => void save(status)}>Mark {selected.length} selected {labels[status].toLowerCase()}</CapsuleButton>)}
          {selected.length > 0 && <CapsuleButton variant="ghost" disabled={saving} onClick={clearSelection}>Clear selection</CapsuleButton>}
        </div>}
        <p role="status" aria-live="polite" className="text-base text-fg-2">{notice}</p>
        {failedStatus && <div role="alert" className="space-y-2 text-base">
          <p>{retryScopeMatches ? 'Payment notes did not save. Your selection is preserved.' : 'The shown squares changed. Review and select squares again before saving.'}</p>
          {retryScopeMatches && <CapsuleButton disabled={locked || !selected.length} onClick={() => void save(failedStatus)}>Retry marking {selected.length} selected {labels[failedStatus].toLowerCase()}</CapsuleButton>}
        </div>}
        {disabled && <p className="text-base text-fg-2">Payment changes are temporarily unavailable.</p>}
      </div>
    </div>
  </Sheet>;
}
export default PaymentsPanel;
