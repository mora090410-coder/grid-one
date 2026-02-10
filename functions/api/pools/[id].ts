
import { createClient } from '@supabase/supabase-js';

type KVNamespace = any;
type PagesFunction = (context: any) => Promise<Response> | Response;

interface Env {
  POOLS: KVNamespace; // Kept to avoid build errors if bindings exist
  PUBLIC_SITE_URL?: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

// ============= INLINE CRYPTO UTILITIES =============
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  if (computedHash.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

// ============= SUPABASE CLIENT =============
function getSupabase(env: Env) {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
}

// ============= CORS =============
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8788',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://sbxpro.pages.dev',
  'https://getgridone.com',
  'https://www.getgridone.com',
];

function getCorsHeaders(request: Request, extraOrigin?: string): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = [...DEFAULT_ALLOWED_ORIGINS];
  if (extraOrigin) allowed.push(extraOrigin);

  const isAllowed = allowed.some(a => origin.startsWith(a)) || origin === '';

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin || '*' : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export const onRequestOptions: PagesFunction = async (context) => {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL) });
};

/**
 * Public Access Route - Read from Supabase
 */
export const onRequestGet: PagesFunction = async (context) => {
  const poolId = context.params.id as string;
  const supabase = getSupabase(context.env);

  // Fetch merged data
  const { data, error } = await supabase
    .from('contests')
    .select('settings, board_data, is_activated, activated_at')
    .eq('id', poolId)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Pool not found', details: error }), {
      status: 404, headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
    });
  }

  // Construct response matching legacy KV structure
  const responseData = {
    ...(data.settings || {}),
    board: data.board_data || {},
    is_activated: data.is_activated,
    activated_at: data.activated_at
  };

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

/**
 * Authentication Verification Route
 * Verifies password against Supabase `password_hash` column
 */
export const onRequestPost: PagesFunction = async (context) => {
  const poolId = context.params.id as string;
  const authHeader = context.request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing Token' }), {
      status: 401, headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
    });
  }

  const supabase = getSupabase(context.env);

  // Also check if adminToken matches? 
  // For legacy support, we check `password_hash` column.
  const { data, error } = await supabase
    .from('contests')
    .select('password_hash, password_salt')
    .eq('id', poolId)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Pool not found' }), {
      status: 404, headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
    });
  }

  // Verify
  let isValid = false;
  if (data.password_hash && data.password_salt) {
    isValid = await verifyPassword(token, data.password_hash, data.password_salt);
  }

  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Password' }), {
      status: 401, headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true, message: 'Authentication Verified' }), {
    status: 200, headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' },
  });
};

/**
 * Protected Update Route - Writes to Supabase
 */
export const onRequestPut: PagesFunction = async (context) => {
  const poolId = context.params.id as string;
  const authHeader = context.request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing Token' }), {
      status: 401, headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
    });
  }

  const supabase = getSupabase(context.env);

  // 1. Verify Auth First
  const { data: existing, error: fetchError } = await supabase
    .from('contests')
    .select('password_hash, password_salt')
    .eq('id', poolId)
    .single();

  if (fetchError || !existing) {
    return new Response(JSON.stringify({ error: 'Pool not found' }), {
      status: 404, headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
    });
  }

  let isValid = false;
  if (existing.password_hash && existing.password_salt) {
    isValid = await verifyPassword(token, existing.password_hash, existing.password_salt);
  }

  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Token' }), {
      status: 401, headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
    });
  }

  // 2. Perform Update
  try {
    const rawBody = await context.request.json() as any;

    // Check structure. If it's the full nested object or flat?
    // Standardize: { game: ..., board: ... }

    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (rawBody.game) updatePayload.settings = rawBody.game;
    if (rawBody.board) updatePayload.board_data = rawBody.board;

    // Safe Update
    const { error: updateError } = await supabase
      .from('contests')
      .update(updatePayload)
      .eq('id', poolId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Pool update error:', err);
    return new Response(JSON.stringify({ error: 'Failed to update pool', message: err.message }), {
      status: 500, headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
    });
  }
};
