export const onRequest: any = async () => {
    return new Response(JSON.stringify({ status: 'ok', version: '1.0' }), {
        headers: { 'Content-Type': 'application/json' }
    });
};
