import { createClient, type User } from '@supabase/supabase-js';

/**
 * Shared request/response plumbing for Pages Functions. Generalized from the
 * family, seller and guest modules: bounded JSON bodies, stable error shapes,
 * masked server failures, and no-store responses.
 */

// Pages Functions receive { request, env, params, waitUntil, ... }. Handlers
// keep `any` here so existing tests can pass partial contexts.
export type PagesFunction = (context: any) => Promise<Response> | Response;

export interface SupabaseEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const SERVER_CLIENT_AUTH = { persistSession: false, autoRefreshToken: false } as const;

/** Service-role client. Never cached: every request builds its own. */
export const adminClient = (env: { VITE_SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY?: string }) =>
  createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: SERVER_CLIENT_AUTH });

/** Anonymous-key client, used to verify access tokens. */
export const anonClient = (env: { VITE_SUPABASE_URL: string; VITE_SUPABASE_ANON_KEY: string }) =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: SERVER_CLIENT_AUTH });

/** Anonymous-key client that acts as the signed-in user, so row-level security applies. */
export const userClient = (env: { VITE_SUPABASE_URL: string; VITE_SUPABASE_ANON_KEY: string }, token: string) =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: SERVER_CLIENT_AUTH,
  });

export const jsonResponse = (body: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SHARE_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_PATTERN.test(value);
export const isShareCode = (value: unknown): value is string => typeof value === 'string' && SHARE_CODE_PATTERN.test(value);

/** One season source of truth for every handler. */
export const DEFAULT_SEASON = 2026;
export const currentSeason = (env: { GRIDONE_SEASON?: string | number } | undefined) => {
  const season = Number(env?.GRIDONE_SEASON);
  return Number.isInteger(season) && season >= 2000 && season <= 2100 ? season : DEFAULT_SEASON;
};

export const bearerToken = (request: Request) =>
  request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null;

export const AUTH_UNAVAILABLE_MESSAGE = 'Sign-in is temporarily unavailable. Try again.';

type AuthErrorLike = { status?: unknown; name?: unknown } | null | undefined;

/**
 * True only when the auth service answered and rejected the token. Outages,
 * rate limits and network failures are not proof that a session expired.
 */
export const authRejectedToken = (error: AuthErrorLike) => {
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError') return false;
  const status = Number(error.status);
  return Number.isInteger(status) && status >= 400 && status < 500 && status !== 429;
};

export interface UserMessages {
  /** 401 wording when the token is absent or rejected. */
  expired: string;
  /** 503 wording when the auth service cannot answer. */
  unavailable?: string;
}

type AuthClientLike = {
  auth: { getUser: (token: string) => Promise<{ data: { user: User | null } | null; error?: unknown }> };
};

export type AuthResult = { user: User } | { failure: 'rejected' | 'unavailable' };

/** Classifies a token check: a user, a rejected token, or an auth service that could not answer. */
export const authenticate = async (client: AuthClientLike, token: string): Promise<AuthResult> => {
  let result: { data: { user: User | null } | null; error?: unknown };
  try {
    result = await client.auth.getUser(token);
  } catch (error) {
    console.error('Auth service request failed:', error);
    return { failure: 'unavailable' };
  }
  const error = result?.error as AuthErrorLike;
  if (error && !authRejectedToken(error)) {
    console.error('Auth service could not verify a session:', error);
    return { failure: 'unavailable' };
  }
  const user = error ? null : result?.data?.user;
  return user ? { user } : { failure: 'rejected' };
};

export const authUnavailableBody = (message = AUTH_UNAVAILABLE_MESSAGE) => ({ error: message, code: 'AUTH_UNAVAILABLE' });

/**
 * Verifies an access token. Returns the user, or a Response: 401 when the
 * auth service rejects the token, 503 when it cannot answer.
 */
export const verifyUser = async (client: AuthClientLike, token: string, messages: UserMessages): Promise<User | Response> => {
  const result = await authenticate(client, token);
  if ('user' in result) return result.user;
  return result.failure === 'unavailable'
    ? jsonResponse(authUnavailableBody(messages.unavailable), 503)
    : jsonResponse({ error: messages.expired }, 401);
};

/**
 * Bearer token → verified user through a fresh anonymous-key client.
 * No client is created when the token is missing.
 */
export const requireUser = async (
  request: Request,
  env: { VITE_SUPABASE_URL: string; VITE_SUPABASE_ANON_KEY: string },
  messages: UserMessages & { missing: string },
): Promise<User | Response> => {
  const token = bearerToken(request);
  if (!token) return jsonResponse({ error: messages.missing }, 401);
  return verifyUser(anonClient(env), token, messages);
};

export const INVALID_BODY_MESSAGE = 'Invalid request body.';
export const BODY_TOO_LARGE_MESSAGE = 'The request is too large.';

/**
 * Bounded JSON object reader, including requests without Content-Length.
 * Returns the object, or a 400 (invalid JSON / not an object) or 413 Response.
 */
export const readJsonObject = async (
  request: Request,
  maxBytes: number,
  messages: { invalid?: string; tooLarge?: string } = {},
): Promise<Record<string, unknown> | Response> => {
  const invalid = () => jsonResponse({ error: messages.invalid || INVALID_BODY_MESSAGE }, 400);
  const tooLarge = () => jsonResponse({ error: messages.tooLarge || BODY_TOO_LARGE_MESSAGE }, 413);
  if (Number(request.headers.get('Content-Length')) > maxBytes) return tooLarge();
  const reader = request.body?.getReader();
  if (!reader) return invalid();
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return tooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return invalid();
  }
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid();
  } catch {
    return invalid();
  }
};

/** Logs the raw failure server-side and returns a generic message the browser can show. */
export const maskedError = (
  context: string,
  error: unknown,
  message = 'Something went wrong. Please try again.',
  status = 500,
  headers?: Record<string, string>,
) => {
  console.error(`${context}:`, error);
  return jsonResponse({ error: message }, status, headers);
};

/** Bounded-concurrency map: at most `concurrency` operations in flight. */
export const runBounded = async <T>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<void>,
) => {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (cursor < values.length) {
        const value = values[cursor];
        cursor += 1;
        await operation(value);
      }
    },
  );
  await Promise.all(workers);
};
