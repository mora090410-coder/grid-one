
// Cloudflare Pages Functions environment types
type KVNamespace = any;
type PagesFunction<T = any> = (context: any) => Promise<Response> | Response;

interface Env {
  POOLS: KVNamespace;
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
function validateCreatePool(data: any): { valid: true; data: any } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid payload' };
  }

  if (!data.game || typeof data.game !== 'object') {
    return { valid: false, error: 'Missing game data' };
  }

  if (!data.game.title || typeof data.game.title !== 'string' || data.game.title.length < 1) {
    return { valid: false, error: 'League name is required' };
  }

  if (data.game.title.length > 100) {
    return { valid: false, error: 'League name too long (max 100 characters)' };
  }

  if (!data.board || !Array.isArray(data.board.squares) || data.board.squares.length !== 100) {
    return { valid: false, error: 'Invalid board data' };
  }

  return { valid: true, data };
}

// ============= CORS & RATE LIMITING =============
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

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
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = validation.data;
    const leagueName = data.game.title.trim();
    const normalizedName = leagueName.toLowerCase().replace(/\s+/g, '-');

    // Check for duplicate names
    const existingPool = await context.env.POOLS.get(`name:${normalizedName}`);
    if (existingPool) {
      return new Response(JSON.stringify({
        error: 'League name already exists',
        message: `A league named "${leagueName}" already exists. Please choose a different name.`
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate pool ID
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let poolId = '';
    const randomValues = new Uint32Array(8);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < 8; i++) {
      poolId += chars[randomValues[i] % chars.length];
    }

    // Hash password
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
    await context.env.POOLS.put(`name:${normalizedName}`, poolId);

    return new Response(JSON.stringify({ poolId, success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('Pool creation error:', err);
    return new Response(JSON.stringify({ error: 'Failed to create pool', message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
