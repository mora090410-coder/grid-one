
import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

interface Env {
  PUBLIC_SITE_URL?: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

// Payload Types
interface CreatePoolPayload {
  game: {
    title: string;
    description?: string;
    [key: string]: any;
  };
  board: {
    squares: any[];
    [key: string]: any;
  };
  adminPassword?: string;
  adminEmail?: string;
  isPublic?: boolean;
}

// ============= INLINE CRYPTO UTILITIES =============
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// ============= VALIDATION =============
function validateCreatePool(data: any): { valid: true; data: CreatePoolPayload } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid payload' };
  }

  const payload = data as Partial<CreatePoolPayload>;

  if (!payload.game || typeof payload.game !== 'object') {
    return { valid: false, error: 'Missing game data' };
  }

  if (!payload.game.title || typeof payload.game.title !== 'string' || payload.game.title.length < 1) {
    return { valid: false, error: 'League name is required' };
  }

  if (payload.game.title.length > 100) {
    return { valid: false, error: 'League name too long (max 100 characters)' };
  }

  // Email Validation
  if (!payload.adminEmail || typeof payload.adminEmail !== 'string' || !payload.adminEmail.includes('@')) {
    return { valid: false, error: 'Valid email address is required for recovery' };
  }

  if (!payload.adminPassword || typeof payload.adminPassword !== 'string' || payload.adminPassword.trim().length < 4) {
    return { valid: false, error: 'Password must be at least 4 characters' };
  }

  if (!payload.board || !Array.isArray(payload.board.squares) || payload.board.squares.length !== 100) {
    return { valid: false, error: 'Invalid board data' };
  }

  return { valid: true, data: payload as CreatePoolPayload };
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

// ============= RATE LIMITING (Memory fallback) =============
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

// ============= HANDLERS =============
export const onRequestOptions: PagesFunction = async (context) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL),
  });
};

export const onRequestPost: PagesFunction = async (context) => {
  try {
    // Rate limiting
    const clientIP = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.'
      }), {
        status: 429,
        headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json', 'Retry-After': '60' }
      });
    }

    const authHeader = context.request.headers.get('Authorization');
    const authToken = authHeader?.replace('Bearer ', '') || '';

    const rawData = await context.request.json();
    const validation = validateCreatePool(rawData);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        error: 'Validation failed',
        message: validation.error
      }), {
        status: 400,
        headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
      });
    }

    const data = validation.data;
    const supabase = getSupabase(context.env);

    // Generate pool ID
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let poolId = '';
    const randomValues = new Uint32Array(8);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < 8; i++) {
      poolId += chars[randomValues[i] % chars.length];
    }

    // Check collision (optional but good practice)
    const { data: existing } = await supabase.from('contests').select('id').eq('id', poolId).single();
    if (existing) {
      // Simple retry logic or error
      return new Response(JSON.stringify({ error: 'ID Collision', message: 'Please try again.' }), {
        status: 409, // Conflict
        headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
      });
    }

    // Password Hashing
    const adminPassword = (validation.data.adminPassword || '').trim();
    const salt = generateSalt();
    const hashedPassword = await hashPassword(adminPassword, salt);

    // Insert into Supabase
    // Pool creation requires an authenticated Supabase user.
    // The Authorization header must carry a valid Supabase JWT.
    // Guest flows redirect to /login before reaching this endpoint.

    const { data: { user } } = await supabase.auth.getUser(authToken);

    if (!user) {
      // Legacy fallback: Can we insert without owner?
      // Only if I use SERVICE_ROLE_KEY and insert a dummy owner? 
      // No, let's force Auth. The app flow supports it.
      return new Response(JSON.stringify({ error: 'Unauthorized', message: 'You must be logged in to create a pool.' }), {
        status: 401, headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
      });
    }

    const payload = {
      id: poolId,
      owner_id: user.id,
      title: data.game.title,
      settings: data.game,
      board_data: data.board,
      password_hash: hashedPassword,
      password_salt: salt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: insertError } = await supabase.from('contests').insert([payload]);

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ poolId, success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('Pool creation error:', err);
    return new Response(JSON.stringify({ error: 'Failed to create pool', message: err.message }), {
      status: 500,
      headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
    });
  }
};
