import { createClient } from '@supabase/supabase-js';
import { fetchScheduledGames } from '../../_lib/espnNfl';
import { scoreTestModeAllowed } from '../../_lib/scoreTestMode';

type PagesFunction = (context: any) => Promise<Response> | Response;

const json = (body: unknown, status = 200, cacheControl = 'no-store') => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
    },
  },
);

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const requestedScope = url.searchParams.get('scope') || 'upcoming';
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? (requestedScope === 'completed' ? 5 : 50) : Number(rawLimit);
  if ((requestedScope !== 'upcoming' && requestedScope !== 'completed')
    || !Number.isInteger(limit)
    || limit < 1
    || limit > 50) {
    return json({ error: 'Use a supported schedule scope and a limit from 1 to 50.' }, 400);
  }

  try {
    let completedAccess = false;
    if (requestedScope === 'completed' && env.SCORE_TEST_MODE_ENABLED === 'true') {
      const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
      if (bearer) {
        const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${bearer}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data } = await client.auth.getUser(bearer);
        completedAccess = Boolean(
          data.user?.id && scoreTestModeAllowed(env, data.user.id),
        );
      }
    }
    const scope = completedAccess ? 'completed' : 'upcoming';
    const games = await fetchScheduledGames({ scope, limit });
    return json(
      completedAccess ? { games, scoreTestMode: true } : { games },
      200,
      requestedScope === 'completed'
        ? 'private, no-store'
        : 'public, max-age=300, stale-while-revalidate=900',
    );
  } catch (error) {
    console.error('NFL schedule request failed:', error);
    return json({ error: 'NFL games are temporarily unavailable. Please retry.' }, 502);
  }
};
