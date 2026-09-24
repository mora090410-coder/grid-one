/**
 * Server-only crypto and escaping primitives. Each helper has exactly one
 * implementation so signers and verifiers cannot drift apart.
 */
const encoder = new TextEncoder();

const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Lowercase hex SHA-256 of the UTF-8 bytes of `value`. */
export const sha256Hex = async (value: string) =>
  toHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));

/** Lowercase hex HMAC-SHA-256 of `value` keyed by the UTF-8 bytes of `secret`. */
export const hmacSha256Hex = async (secret: string, value: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
};

/** Compares every byte of both strings, including a length mismatch, without an early exit. */
export const timingSafeEqual = (left: string, right: string) => {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let mismatch = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return mismatch === 0;
};

export const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
