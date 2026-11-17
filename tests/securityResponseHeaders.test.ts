import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { jsonResponse } from '../functions/_lib/http';
import { emailLinkConfirmPage } from '../functions/_lib/emailLinkPages';

describe('security response defaults', () => {
  it('prevents content sniffing and framing for static Pages responses', () => {
    const globalRule = readFileSync('public/_headers', 'utf8').match(/^\/\*\r?\n((?: +[^\r\n]+\r?\n)+)/m)?.[1] ?? '';
    expect(globalRule).toContain('X-Content-Type-Options: nosniff');
    expect(globalRule).toContain('X-Frame-Options: DENY');
  });

  it('prevents content sniffing for shared JSON responses and preserves cache controls', () => {
    const response = jsonResponse({ ok: true });
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('prevents framing and sniffing on transactional email landing pages', () => {
    const response = emailLinkConfirmPage({
      title: 'Confirm', heading: 'Confirm', message: 'Confirm the action.', buttonLabel: 'Confirm',
      requestUrl: new URL('https://example.test/api/notifications/verify?token=test'),
    });
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });
});
