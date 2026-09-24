import { fetchScheduledGames } from '../../_lib/espnNfl';
import { scoreTestModeAllowed } from '../../_lib/scoreTestMode';
import { authenticate, bearerToken, userClient, type PagesFunction } from '../../_lib/http';

const PUBLIC_SCHEDULE_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=900';

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

export const onRequestGet: PagesFunction = async (context) => {
  const { request, env } = context;
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
      const bearer = bearerToken(request);
      if (bearer) {
        const auth = await authenticate(userClient(env, bearer), bearer);
        completedAccess = 'user' in auth && scoreTestModeAllowed(env, auth.user.id);
      }
    }
    const scope = completedAccess ? 'completed' : 'upcoming';

    // Pages Functions do not cache on Cache-Control alone (see pools/[id]/score.ts),
    // so the public schedule consults the Cache API explicitly. The key is the
    // RESOLVED scope and limit, so an unauthorized `scope=completed` request
    // shares the upcoming entry and cannot bypass the cache.
    const edgeCache = !completedAccess && typeof (globalThis as any).caches?.default?.match === 'function'
      ? (globalThis as any).caches.default
      : null;
    const cacheKey = `${url.origin}${url.pathname}?scope=upcoming&limit=${limit}`;
    if (edgeCache) {
      const cached = await edgeCache.match(cacheKey).catch(() => null);
      if (cached) return cached;
    }

    const games = await fetchScheduledGames({ scope, limit });
    if (completedAccess) return json({ games, scoreTestMode: true }, 200, 'private, no-store');
    const response = json({ games }, 200, PUBLIC_SCHEDULE_CACHE_CONTROL);
    if (edgeCache && typeof context.waitUntil === 'function') {
      context.waitUntil(edgeCache.put(cacheKey, response.clone()).catch(() => undefined));
    }
    return response;
  } catch (error) {
    console.error('NFL schedule request failed:', error);
    return json({ error: 'NFL games are temporarily unavailable. Please retry.' }, 502);
  }
};
