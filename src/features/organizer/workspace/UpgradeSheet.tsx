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
  onTierChange?: (tier: 'gameday' | 'org') => void;
  allowGameDay?: boolean;
}

/** 402 upgrade path to Stripe checkout. */
export default function UpgradeSheet({ open, tier, error, organizationName, onOrganizationNameChange, onClose, onCheckout, onTierChange, allowGameDay = true }: UpgradeSheetProps) {
  const isOrganization = tier === 'org';
  const organizationNameIsValid = organizationName.trim().length >= 2 && organizationName.trim().length <= 120;

  return (
    <Sheet open={open} onClose={onClose} title="Choose a plan">
      <div className="flex flex-col gap-4">
        {onTierChange && <fieldset className="flex flex-col gap-2">
          <legend className="font-ui text-base text-fg">Season plan</legend>
          {allowGameDay && <label className="flex min-h-11 items-center gap-3 font-ui text-fg"><input type="radio" name="season-plan" checked={tier === 'gameday'} onChange={() => onTierChange('gameday')} />Game Day — $9.99 · 5 total boards</label>}
          <label className="flex min-h-11 items-center gap-3 font-ui text-fg"><input type="radio" name="season-plan" checked={tier === 'org'} onChange={() => onTierChange('org')} />Organization — $79 · 50 total boards</label>
        </fieldset>}
        <p className="font-ui text-sm text-fg-2">An eligible paid Game Day purchase on this account for the same season receives a $9.99 credit toward Organization: $69.01 due. Eligibility and the final amount are verified at checkout. Grants, refunds and disputed payments do not qualify.</p>
        <Eyebrow>{isOrganization ? 'Organization · up to 50 boards' : 'Game Day · up to 5 boards'}</Eyebrow>
        <h3 className="font-ui text-[22px] font-semibold text-fg">
          {isOrganization
            ? "Sounds like you're running this for a whole organization."
            : 'Choose your season plan.'}
        </h3>
        <p className="font-ui text-[15px] text-fg-2">
          {isOrganization
            ? "The Organization plan puts your club's name on every board, keeps all of them on one dashboard, and gives your treasurer one clean receipt. $79 for the season, up to 50 boards."
            : '$9.99 covers up to 5 boards this season, counting your first. It doesn’t reset after a game.'}
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
            {isOrganization ? 'Continue to Organization checkout' : 'Continue to $9.99 checkout'}
          </CapsuleButton>
        </div>
      </div>
    </Sheet>
  );
}
