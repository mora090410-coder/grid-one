import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const validAxis = (value: unknown): value is number[] =>
  Array.isArray(value)
  && value.length === 10
  && value.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9)
  && new Set(value).size === 10;

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in before importing a board.' }, 401);
  const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData } = await auth.auth.getUser(token);
  if (!authData.user) return json({ error: 'Your session has expired.' }, 401);
  if (!env.GEMINI_API_KEY) return json({ error: 'Paper-board import is not configured.' }, 503);

  const body = await request.json() as { image?: string };
  const match = body.image?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[2].length > 8_000_000) {
    return json({ error: 'Upload a JPG, PNG, or WebP image under 6 MB.' }, 400);
  }

  const prompt = `Read this football squares board as a 10 by 10 grid. Return JSON only:
{"bearsAxis":[10 unique digits 0-9 top to bottom],"oppAxis":[10 unique digits 0-9 left to right],"squaresGrid":[10 rows of 10 strings]}
Use "" for blank cells and "???" when text is genuinely unreadable. Never invent names.`;
  const model = env.OCR_MODEL || 'gemini-2.5-flash';
  let providerResponse: Response;
  let raw: any;
  try {
    providerResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    });
    raw = await providerResponse.json();
  } catch {
    return json({ error: 'The scan provider is unavailable.' }, 502);
  }
  if (!providerResponse.ok) return json({ error: raw?.error?.message || 'The scan provider is unavailable.' }, 502);
  const text = raw?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('');
  if (!text) return json({ error: 'The scan provider returned no board data.' }, 502);

  try {
    const parsed = JSON.parse(text);
    if (!validAxis(parsed.bearsAxis) || !validAxis(parsed.oppAxis)) {
      throw new Error('The axis digits could not be read reliably.');
    }
    if (!Array.isArray(parsed.squaresGrid) || parsed.squaresGrid.length !== 10) {
      throw new Error('The 10 by 10 grid could not be read reliably.');
    }
    const squares: string[][] = [];
    for (const row of parsed.squaresGrid) {
      if (!Array.isArray(row) || row.length !== 10) throw new Error('The 10 by 10 grid could not be read reliably.');
      for (const cell of row) {
        const name = typeof cell === 'string' ? cell.trim().slice(0, 80) : '';
        squares.push(name ? [name] : []);
      }
    }
    return json({
      board: {
        bearsAxis: parsed.bearsAxis,
        oppAxis: parsed.oppAxis,
        squares,
        isDynamic: false,
      },
      warning: 'Review every imported square before publishing.',
    });
  } catch (error: any) {
    return json({ error: error.message || 'The scan returned an invalid board.' }, 422);
  }
};
