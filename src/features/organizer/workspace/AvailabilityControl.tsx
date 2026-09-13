import React from 'react';
import { CapsuleButton, Glass } from '../../../design/primitives';
import type { SquareAvailability } from '../../../../types';

export interface AvailabilityControlProps {
  selectedCount: number;
  disabled: boolean;
  onChange: (status: SquareAvailability) => void;
  onClose: () => void;
}

/** Explicit public labels, separate from name entry and private payment tracking. */
export default function AvailabilityControl({ selectedCount, disabled, onChange, onClose }: AvailabilityControlProps) {
  const selection = `${selectedCount} selected ${selectedCount === 1 ? 'square' : 'squares'}`;
  return (
    <Glass
      role="group"
      aria-label="Offer squares as available"
      className="flex flex-col gap-3"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || disabled) return;
        event.preventDefault();
        onClose();
      }}
    >
      <h2 className="font-ui text-lg font-medium">Offer squares as available</h2>
      <p className="font-ui text-[1.0625rem] text-fg-2">
        Select squares on the board to show as available on your shared link. Names and private payment notes stay unchanged. This does not share or publish the board.
      </p>
      <p aria-live="polite" className="font-ui text-[1.0625rem] text-fg-2">
        {selectedCount > 0 ? `${selection}.` : 'Tap squares to select them, or drag across a block.'}
      </p>
      {selectedCount > 0 && (
        <div className="flex flex-wrap gap-2">
          <CapsuleButton disabled={disabled} onClick={() => onChange('available')}>Offer {selection} as available</CapsuleButton>
          <CapsuleButton variant="quiet" disabled={disabled} onClick={() => onChange('unavailable')}>Mark {selection} unavailable</CapsuleButton>
          <CapsuleButton variant="quiet" disabled={disabled} onClick={() => onChange('unspecified')}>Remove availability label</CapsuleButton>
        </div>
      )}
      <div>
        <CapsuleButton variant="quiet" disabled={disabled} onClick={onClose}>Done selecting</CapsuleButton>
      </div>
    </Glass>
  );
}
