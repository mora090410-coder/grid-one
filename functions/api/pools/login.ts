
// Fix: Define missing types for Cloudflare Pages environment
type KVNamespace = any;
type PagesFunction<T = any> = (context: any) => Promise<Response> | Response;

interface Env {
    POOLS: KVNamespace;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
};

/**
 * Commissioner Login Endpoint
 * Authenticates admin by league name + password
 * Returns poolId on success for redirect
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { leagueName, password } = await context.request.json();

        if (!leagueName || !password) {
            return new Response(JSON.stringify({
                error: 'Missing credentials',
                message: 'League name and password are required.'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Normalize league name to match stored index
        const normalizedName = leagueName.trim().toLowerCase().replace(/\s+/g, '-');

        // Look up the pool ID by name
        const poolId = await context.env.POOLS.get(`name:${normalizedName}`);

        if (!poolId) {
            return new Response(JSON.stringify({
                error: 'League not found',
                message: 'No league exists with that name.'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Fetch the pool data to verify password
        const poolData = await context.env.POOLS.get(`pool:${poolId}`);

        if (!poolData) {
            return new Response(JSON.stringify({
                error: 'Pool data not found',
                message: 'League data could not be retrieved.'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const parsed = JSON.parse(poolData);

        // Verify password matches stored adminToken
        if (password !== parsed.adminToken) {
            return new Response(JSON.stringify({
                error: 'Invalid password',
                message: 'The password you entered is incorrect.'
            }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Success: return poolId for redirect
        return new Response(JSON.stringify({
            success: true,
            poolId,
            message: 'Authentication successful'
        }), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({
            error: 'Login failed',
            message: err.message || 'An unexpected error occurred.'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
