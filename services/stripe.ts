export const createCheckoutSession = async (contestId: string): Promise<void> => {
    try {
        const response = await fetch('/api/stripe/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ contestId }),
        });

        let data;
        const text = await response.text();
        try {
            data = JSON.parse(text);
        } catch (e) {
            // If not JSON, it's likely a Cloudflare infrastructure error (500/502 HTML)
            console.error('Non-JSON response:', text);
            throw new Error(`Server Error: ${response.status} - Please check logs`);
        }

        if (!response.ok) {
            throw new Error(data.error || `Server Error: ${response.status}`);
        }

        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL returned');
        }
    } catch (error: any) {
        console.error('Checkout Error:', error);
        alert(error.message || 'Failed to connect to payment provider.');
    }
};
