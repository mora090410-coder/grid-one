
type KVNamespace = any;
type PagesFunction<T = any> = (context: any) => Promise<Response> | Response;

interface Env {
    POOLS: KVNamespace;
}

// ============= INLINE CRYPTO =============
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

// ============= CORS & RATE LIMITING =============
const ALLOWED_ORIGINS = [
    'http://localhost:8788',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://sbxpro.pages.dev',
];

function getCorsHeaders(request: Request): Record<string, string> {
    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed)) || origin === '';

    return {
        'Access-Control-Allow-Origin': isAllowed ? origin || '*' : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}

const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const LOGIN_RATE_LIMIT_WINDOW = 60000;
const LOGIN_RATE_LIMIT_MAX = 5;

function checkLoginRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = loginAttempts.get(ip);
    if (!record || now > record.resetTime) {
        loginAttempts.set(ip, { count: 1, resetTime: now + LOGIN_RATE_LIMIT_WINDOW });
        return true;
    }
    if (record.count >= LOGIN_RATE_LIMIT_MAX) return false;
    record.count++;
    return true;
}

export const onRequestOptions: PagesFunction = async (context) => {
    return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const clientIP = context.request.headers.get('CF-Connecting-IP') || 'unknown';
        if (!checkLoginRateLimit(clientIP)) {
            return new Response(JSON.stringify({
                error: 'Too many login attempts',
                message: 'Please wait before trying again.'
            }), {
                status: 429,
                headers: { ...getCorsHeaders(context.request), 'Content-Type': 'application/json', 'Retry-After': '60' }
            });
        }

        const { leagueName, password } = await context.request.json();

        if (!leagueName || !password) {
            return new Response(JSON.stringify({
                error: 'Validation failed',
                message: 'League name and password are required.'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(context.request), 'Content-Type': 'application/json' }
            });
        }

        const normalizedName = leagueName.trim().toLowerCase().replace(/\s+/g, '-');

        const poolId = await context.env.POOLS.get(`name:${normalizedName}`);
        if (!poolId) {
            return new Response(JSON.stringify({
                error: 'Invalid credentials',
                message: 'League name or password is incorrect.'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(context.request), 'Content-Type': 'application/json' }
            });
        }

        const poolData = await context.env.POOLS.get(`pool:${poolId}`);
        if (!poolData) {
            return new Response(JSON.stringify({
                error: 'Invalid credentials',
                message: 'League name or password is incorrect.'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(context.request), 'Content-Type': 'application/json' }
            });
        }

        const parsed = JSON.parse(poolData);

        let isValid = false;
        if (parsed.passwordHash && parsed.passwordSalt) {
            isValid = await verifyPassword(password, parsed.passwordHash, parsed.passwordSalt);
        } else if (parsed.adminToken) {
            isValid = password === parsed.adminToken;
        }

        if (!isValid) {
            return new Response(JSON.stringify({
                error: 'Invalid credentials',
                message: 'League name or password is incorrect.'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(context.request), 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ success: true, poolId, message: 'Login successful' }), {
            status: 200,
            headers: { ...getCorsHeaders(context.request), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });

    } catch (err: any) {
        console.error('Login error:', err);
        return new Response(JSON.stringify({ error: 'Login failed', message: 'An error occurred.' }), {
            status: 500,
            headers: { ...getCorsHeaders(context.request), 'Content-Type': 'application/json' }
        });
    }
};
