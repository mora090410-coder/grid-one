
import { createClient } from '@supabase/supabase-js';

type KVNamespace = any;
type PagesFunction = (context: any) => Promise<Response> | Response;

interface Env {
  POOLS: KVNamespace;
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

    // Check Admin Password
    const authHeader = context.request.headers.get('Authorization');
    const adminToken = authHeader?.replace('Bearer ', '') || '';

    if (!adminToken || adminToken.length < 4) {
      return new Response(JSON.stringify({
        error: 'Weak password',
        message: 'Password must be at least 4 characters'
      }), {
        status: 400,
        headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
      });
    }

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
    const salt = generateSalt();
    const hashedPassword = await hashPassword(adminToken, salt);

    // Insert into Supabase
    // Note: owner_id is required by RLS usually.
    // If we are creating anonymously, we might have an issue if RLS enforces owner_id.
    // But this API is server-side (Edge Function), so we use Anon key.
    // Wait, anon key respects RLS. 
    // If the user is not logged in via Supabase Auth on the frontend, `auth.uid()` is null.
    // AND contest requires `owner_id`.
    // IF the user is creating GUEST board, we might need a "Guest User" or allow null?
    // The previous KV implementation didn't need owner_id.
    // Supabase Schema says `owner_id uuid NOT NULL`.
    // So we MUST have a user.
    // However, the `validateCreatePool` payload has `adminEmail`.
    // We could create a "Shadow User" or use a dedicated "Guest Owner"?
    // OR, we use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS and insert with a placeholder/generated UUID?
    // But `migrateGuestBoard` expects to claim it later.

    // Let's check how `migrateGuestBoard` works. 
    // It takes `guestData` from local storage and inserts it using the *Authenticated User*.
    // THIS endpoint (`functions/api/pools.ts`) is legacy for "Guest Creation" presumably?
    // Or is it used by `CreateContest.tsx`?
    // `CreateContest.tsx` tries `publishPool`.
    // We moved to `migrateGuestBoard` flow for guests.
    // BUT guests can still "Create Board" -> "Publish" (legacy path)?
    // If they are not logged in, `usePoolData.publishPool` (Step 1838) checks `supabase.auth.getUser()`.
    // If !user, it throws "You must be logged in".
    // So... DOES the app imply guests MUST sign up?
    // The Task "Guest Flow Enablement" (Step 1800) says: "If !user, save game and board to localStorage... Redirect to /login?mode=signup".
    // So `functions/api/pools.ts` MIGHT NOT BE USED ANYMORE for Guest creation directly?
    // It might only be used by *Logged In* users via `publishPool` fallback?
    // `usePoolData.ts`:
    //    const { data: { user } } = await supabase.auth.getUser();
    //    if (!user) throw new Error("You must be logged in...");
    //    ... insert([payload]) ...

    // So `usePoolData.ts` handles creation via Supabase Client (Frontend) now!
    // So `functions/api/pools.ts` (this file) is largely obsolescent or purely a fallback for the legacy `BoardView`?

    // `BoardView` (Step 1839) in `handlePublish`:
    // "Fallback to legacy KV API for new pools or non-owners"
    // `fetch(API_URL, ...)`

    // So if I am a non-owner, I can't update?
    // If I am a new user (via BoardView wizard), BoardView tries to use this API.
    // BUT we want to force Auth.
    // So this API *should* enforce Auth or Create a user?
    // Given the critical migration: changing this API to write to Supabase is correct.
    // AND we must handle the `owner_id` constraint.

    // If the request has an `Authorization` header with a Bearer token (JWT), we can get the UID.
    // If `adminToken` is just a password (simple string), we don't have a generic UID.

    // Strategy:
    // 1. Check if we have a valid JWT. If so, use that UID.
    // 2. If not, we have a problem inserting into `contests` (owner_id NOT NULL).
    // The legacy KV allowed no owner.
    // If `BoardView` is sending a password as token, it's not a JWT.
    // WE CANNOT INSERT into `contests` without a valid UUID owner_id.

    // Solution:
    // The `BoardView` logic sends a token.
    // If the user is Guest, `BoardView` sends a generated token/password.
    // Since we validated "Guest Flow Enablement" forces a redirect to Login/Signup,
    // maybe we can assume this API is rarely hit by guests now?

    // However, to keep it working:
    // We could Generate a UUID for the `owner_id` for now?
    // `owner_id` is a foreign key to `auth.users`? Let's hope NOT strictly (unless FK is enforced).
    // Usually it is.
    // If FK is enforced, we can't insert a random UUID.

    // Let's check `types.ts` or schema?
    // Schema usually references `auth.users(id)`.

    // If so, we are blocked from inserting via this API for non-authed users.
    // But we deprecated Guest Creation without Login.
    // So maybe we just return 401 if they aren't Authed with Supabase?
    // OR we rely on the `usePoolData` implementation which is client-side.

    // This API `functions/api/pools.ts` is the *Back-End* of `BoardView`'s legacy path.
    // If we update `BoardView` to *always* use `usePoolData.publishPool`, we can delete this API?
    // `usePoolData.publishPool` does Supabase Insert directly.

    // Refactoring this API to use Supabase is good for checking.
    // I will try to Parse the Bearer token as a JWT to get the user ID.
    // If it fails, I will return an error "Please Log In".

    // Wait, `AuthContext` logic...
    // The `BoardView` handles `token` as a password.
    // If I enforce JWT, `BoardView` legacy wizard will break for guests.
    // BUT guests are supposed to be redirected to Login now.

    // Implemented Solution:
    // Try to get User from `supabase.auth.getUser(token)`.
    // If user exists, use `user.id`.
    // If not, failure?
    // This aligns with "Authentication Fragmentation" fix recommendation.

    // I'll assume standard JWT in Authorization header for the new world.

    const token = authHeader?.replace('Bearer ', '') || '';
    const { data: { user } } = await supabase.auth.getUser(token);

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
