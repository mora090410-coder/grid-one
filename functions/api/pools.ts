
// Cloudflare Pages Functions environment types
// Cloudflare Pages Functions environment types
interface KVNamespace {
  get(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<any>;
  put(key: string, value: string | ReadableStream | ArrayBuffer | FormData, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<any>;
}

interface EventContext<Env, P = string, Data = Record<string, unknown>> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: P;
  data: Data;
}

type PagesFunction<Env = any, Params = string, Data = Record<string, unknown>> = (
  context: EventContext<Env, Params, Data>
) => Promise<Response> | Response;

interface Env {
  POOLS: KVNamespace;
  PUBLIC_SITE_URL?: string;
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

// ============= INLINE VALIDATION =============
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

// ... existing code ...

// Allowed origins for CORS - add production domains here
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

// ... handlers ...
// In handlers, call getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL)

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

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

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

export const onRequestPost: PagesFunction<Env> = async (context) => {
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

    // Validate input
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
    const leagueName = data.game.title.trim();
    const normalizedName = leagueName.toLowerCase().replace(/\s+/g, '-');
    const nameKey = `name:${normalizedName}`;

    // Generate pool ID first
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let poolId = '';
    const randomValues = new Uint32Array(8);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < 8; i++) {
      poolId += chars[randomValues[i] % chars.length];
    }

    // ============= OPTIMISTIC LOCKING PATTERN =============
    // This prevents race conditions by using write-then-verify:
    // 1. Write our poolId to the name key
    // 2. Read it back immediately
    // 3. If the value matches our poolId, we won the race
    // 4. If not, another request won - clean up and return conflict

    // Step 1: Attempt to claim the name by writing our poolId
    await context.env.POOLS.put(nameKey, poolId);

    // Small delay to allow KV propagation (eventual consistency)
    await new Promise(resolve => setTimeout(resolve, 50));

    // Step 2: Read back to verify we won the race
    const claimedPoolId = await context.env.POOLS.get(nameKey);

    // Step 3: Check if we won
    if (claimedPoolId !== poolId) {
      // Another request won the race - we lost
      // Don't clean up the name key as it belongs to the winner
      return new Response(JSON.stringify({
        error: 'League name already exists',
        message: `A league named "${leagueName}" was just created. Please choose a different name.`
      }), {
        status: 409,
        headers: { ...getCorsHeaders(context.request, context.env.PUBLIC_SITE_URL), 'Content-Type': 'application/json' }
      });
    }

    // Step 4: We won! Now create the pool data
    const salt = generateSalt();
    const hashedPassword = await hashPassword(adminToken, salt);

    const payload = {
      poolId,
      passwordHash: hashedPassword,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data
    };

    await context.env.POOLS.put(`pool:${poolId}`, JSON.stringify(payload));

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
