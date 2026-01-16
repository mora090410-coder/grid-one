
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
    return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { leagueName } = await context.request.json();

        if (!leagueName || typeof leagueName !== 'string') {
            return new Response(JSON.stringify({
                error: 'Missing league name',
                available: false
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const normalizedName = leagueName.trim().toLowerCase().replace(/\s+/g, '-');
        const existingPool = await context.env.POOLS.get(`name:${normalizedName}`);

        return new Response(JSON.stringify({
            available: !existingPool,
            leagueName: leagueName.trim()
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });

    } catch (err: any) {
        console.error('Check name error:', err);
        return new Response(JSON.stringify({
            error: 'Check failed',
            message: err.message,
            available: false
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
