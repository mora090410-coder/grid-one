import { adminClient, jsonResponse, readJsonObject, type SupabaseEnv } from '../_lib/http';
import { validateInstrumentationEvent } from '../../src/features/instrumentation/eventSchema';

/**
 * Best-effort, privacy-minimal client events. The body must pass the same
 * closed schema the browser uses (enums and buckets only; prohibited and
 * unknown fields are refused). Only the event name and the validated fields
 * are stored: no IP, user, user agent, board or URL.
 */
export const EVENT_BODY_LIMIT_BYTES = 2048;

type Context = { request: Request; env: SupabaseEnv };

const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
const unavailable = () => jsonResponse({ error: 'Events are temporarily unavailable.' }, 503);

export const onRequestPost = async ({ request, env }: Context) => {
  const body = await readJsonObject(request, EVENT_BODY_LIMIT_BYTES);
  if (body instanceof Response) return body;

  const validation = validateInstrumentationEvent(body);
  if (!validation.ok) return jsonResponse({ error: 'Invalid event.' }, 400);

  if (!env.SUPABASE_SERVICE_ROLE_KEY) return unavailable();

  const { name, ...payload } = validation.event;
  try {
    const { error } = await adminClient(env).from('client_events').insert({ name, payload });
    if (error) throw error;
  } catch (error) {
    console.error('Client event insert failed:', error);
    return unavailable();
  }
  return noContent();
};
