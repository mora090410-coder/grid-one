import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MONEY_BOUNDARY } from '../src/features/homepage/pricing';

// Public, organizer and transactional disclosures must use the same boundary.
// Context such as private notes, organizer responsibilities and legal terms stays intact.
const surfaces = [
  'App.tsx',
  'index.html',
  'src/features/viewer/details/BoardDetailsDisclosure.tsx',
  'src/features/organizer/workspace/PayoutRulesCard.tsx',
  'src/features/organizer/workspace/FamilyAccessCard.tsx',
  'src/features/organizer/workspace/ParticipationCard.tsx',
  'src/features/organizer/payments/PaymentsPanel.tsx',
  'components/NotificationOptIn.tsx',
  'functions/api/notifications/retry.ts',
  'functions/api/notifications/verify.ts',
  'functions/api/boards/[shareCode]/subscribe.ts',
  'pages/Terms.tsx',
];

describe('consistent square-money boundary', () => {
  it.each(surfaces)('%s uses the approved wording', (file) => {
    expect(readFileSync(resolve(process.cwd(), file), 'utf8')).toContain(MONEY_BOUNDARY);
  });
});
