import { fetchScheduledGames } from '../../_lib/espnNfl';

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

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') || 'upcoming';
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? (scope === 'completed' ? 5 : 50) : Number(rawLimit);
  if ((scope !== 'upcoming' && scope !== 'completed')
    || !Number.isInteger(limit)
    || limit < 1
    || limit > 50) {
    return json({ error: 'Use scope=upcoming|completed and a limit from 1 to 50.' }, 400);
  }

  try {
    const games = await fetchScheduledGames({ scope, limit });
    return json(
      { games },
      200,
      scope === 'completed'
        ? 'public, max-age=3600, stale-while-revalidate=86400'
        : 'public, max-age=300, stale-while-revalidate=900',
    );
  } catch (error) {
    console.error('NFL schedule request failed:', error);
    return json({ error: 'NFL games are temporarily unavailable. Please retry.' }, 502);
  }
};
