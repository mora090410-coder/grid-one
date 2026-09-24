import { BOARD_SCAN_PROMPT, parseScannedBoard } from '../../_lib/scanBoard';
import { readJsonObject, requireUser, type PagesFunction } from '../../_lib/http';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const IMAGE_LIMIT_MESSAGE = 'Upload a JPG, PNG, or WebP image under 6 MB.';
const MAX_BASE64_IMAGE_CHARS = 8_000_000;
// The image field plus its JSON envelope; anything larger cannot hold a valid image.
const MAX_SCAN_BODY_BYTES = MAX_BASE64_IMAGE_CHARS + 64 * 1024;
// Generous on purpose: reading a large handwritten board photo can take well over
// 30 seconds. The limit only exists so a hung provider call cannot wait forever.
const PROVIDER_TIMEOUT_MS = 90_000;
const PROVIDER_UNAVAILABLE = 'The scan provider is unavailable.';

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const user = await requireUser(request, env, { missing: 'Sign in before importing a board.', expired: 'Your session has expired.' });
  if (user instanceof Response) return user;
  if (!env.GEMINI_API_KEY) return json({ error: 'Paper-board import is not configured.' }, 503);

  const body = await readJsonObject(request, MAX_SCAN_BODY_BYTES, { tooLarge: IMAGE_LIMIT_MESSAGE });
  if (body instanceof Response) return body;
  const match = typeof body.image === 'string'
    ? body.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
    : null;
  if (!match || match[2].length > MAX_BASE64_IMAGE_CHARS) {
    return json({ error: IMAGE_LIMIT_MESSAGE }, 400);
  }

  const prompt = BOARD_SCAN_PROMPT;
  const model = env.OCR_MODEL || 'gemini-2.5-flash';
  let providerResponse: Response;
  let raw: any;
  try {
    // The key travels in a header, never in a URL that proxies or logs may keep.
    providerResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inline_data: { mime_type: match[1], data: match[2] } },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    raw = await providerResponse.json();
  } catch (error) {
    console.error('Scan provider request failed:', error);
    return json({ error: PROVIDER_UNAVAILABLE }, 502);
  }
  if (!providerResponse.ok) {
    // Provider error text can name keys, quotas or projects; keep it in logs only.
    console.error('Scan provider rejected the request:', providerResponse.status, raw?.error?.message);
    return json({ error: PROVIDER_UNAVAILABLE }, 502);
  }
  const text = raw?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('');
  if (!text) return json({ error: 'The scan provider returned no board data.' }, 502);

  try {
    const board = parseScannedBoard(JSON.parse(text));
    return json({
      board,
      warning: 'Review every imported square before publishing.',
    });
  } catch (error: any) {
    return json({ error: error.message || 'The scan returned an invalid board.' }, 422);
  }
};
