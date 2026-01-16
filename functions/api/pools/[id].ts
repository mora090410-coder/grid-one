
type KVNamespace = any;
type PagesFunction<T = any> = (context: any) => Promise<Response> | Response;

interface Env {
  POOLS: KVNamespace;
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

// ============= CORS =============
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

/**
 * Public Access Route - Sanitizes sensitive data
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const poolId = context.params.id as string;
  const val = await context.env.POOLS.get(`pool:${poolId}`);

  if (!val) {
    return new Response(JSON.stringify({ error: 'Pool not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const parsed = JSON.parse(val);
  const { passwordHash, passwordSalt, adminToken, ...publicPayload } = parsed;

  return new Response(JSON.stringify(publicPayload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

/**
 * Authentication Verification Route
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const poolId = context.params.id as string;
  const authHeader = context.request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing Token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const val = await context.env.POOLS.get(`pool:${poolId}`);
  if (!val) {
    return new Response(JSON.stringify({ error: 'Pool not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const parsed = JSON.parse(val);

  // Support both old (plaintext) and new (hashed) formats
  let isValid = false;
  if (parsed.passwordHash && parsed.passwordSalt) {
    isValid = await verifyPassword(token, parsed.passwordHash, parsed.passwordSalt);
  } else if (parsed.adminToken) {
    isValid = token === parsed.adminToken;
  }

  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Password' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true, message: 'Authentication Verified' }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

/**
 * Protected Update Route
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const poolId = context.params.id as string;
  const authHeader = context.request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing Token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const existing = await context.env.POOLS.get(`pool:${poolId}`);
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Pool not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const parsed = JSON.parse(existing);

    let isValid = false;
    if (parsed.passwordHash && parsed.passwordSalt) {
      isValid = await verifyPassword(token, parsed.passwordHash, parsed.passwordSalt);
    } else if (parsed.adminToken) {
      isValid = token === parsed.adminToken;
    }

    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await context.request.json();
    const updated = {
      ...parsed,
      updatedAt: new Date().toISOString(),
      data
    };

    await context.env.POOLS.put(`pool:${poolId}`, JSON.stringify(updated));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Pool update error:', err);
    return new Response(JSON.stringify({ error: 'Failed to update pool', message: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
