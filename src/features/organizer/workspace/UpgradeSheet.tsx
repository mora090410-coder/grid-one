import React from 'react';
import { Sheet, CapsuleButton, CapsuleInput, Eyebrow } from '../../../design/primitives';

export interface UpgradeSheetProps {
  open: boolean;
  tier: 'gameday' | 'org';
  error: string | null;
  organizationName: string;
  onOrganizationNameChange: (value: string) => void;
  onClose: () => void;
  onCheckout: () => void;
}

/** 402 upgrade path to Stripe checkout. */
export default function UpgradeSheet({ open, tier, error, organizationName, onOrganizationNameChange, onClose, onCheckout }: UpgradeSheetProps) {
  const isOrganization = tier === 'org';
  const organizationNameIsValid = organizationName.trim().length >= 2 && organizationName.trim().length <= 120;

  return (
    <Sheet open={open} onClose={onClose} title="Choose a plan">
      <div className="flex flex-col gap-4">
        <Eyebrow>{isOrganization ? 'Organization · up to 50 boards' : 'Game Day · up to 5 boards'}</Eyebrow>
        <h3 className="font-ui text-[22px] font-semibold text-fg">
          {isOrganization
            ? "Sounds like you're running this for a whole organization."
            : "Your free plan includes 1 board per season"}
        </h3>
        <p className="font-ui text-[15px] text-fg-2">
          {isOrganization
            ? "The Organization plan puts your club's name on every board, keeps all of them on one dashboard, and gives your treasurer one clean receipt. $79 for the season, up to 50 boards."
            : 'To publish another board, choose the Game Day plan: $9.99 once for up to 5 total published boards in the 2026 season, including your first board. Your allowance does not reset when a game ends.'}
        </p>

        {isOrganization && (
          <div>
            <CapsuleInput
              label="Organization name"
              value={organizationName}
              maxLength={120}
              onChange={(e) => onOrganizationNameChange(e.target.value)}
              placeholder="Riverside Ravens Booster Club"
              autoComplete="organization"
            />
            <p className="mt-2 font-ui text-[13px] text-fg-3">This appears on published boards and the payment description.</p>
          </div>
        )}

        {error && (
          <p role="alert" className="font-ui text-[14px] text-tone-cardinal">{error}</p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CapsuleButton type="button" variant="quiet" onClick={onClose}>Not now</CapsuleButton>
          <CapsuleButton
            type="button"
            onClick={onCheckout}
            disabled={isOrganization && !organizationNameIsValid}
          >
            Continue to {isOrganization ? '$79' : '$9.99'} checkout
          </CapsuleButton>
        </div>
      </div>
    </Sheet>
  );
}
