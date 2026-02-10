import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

const Paid: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('Verifying payment...');
    const contestId = searchParams.get('contestId');
    const sessionId = searchParams.get('session_id');

    useEffect(() => {
        if (!contestId || !sessionId) {
            setStatus('Invalid payment details.');
            setTimeout(() => navigate('/dashboard'), 3000);
            return;
        }

        const checkActivation = async () => {
            // Poll for activation status
            let attempts = 0;
            const maxAttempts = 10; // 20 seconds total

            const poll = setInterval(async () => {
                attempts++;
                setStatus(`Activating your board... (${attempts})`);

                const { data } = await supabase
                    .from('contests')
                    .select('is_activated')
                    .eq('id', contestId)
                    .single();

                if (data?.is_activated) {
                    clearInterval(poll);
                    setStatus('Activation successful! Redirecting...');
                    setTimeout(() => navigate(`/?poolId=${contestId}`), 1000);
                } else if (attempts >= maxAttempts) {
                    clearInterval(poll);
                    setStatus('Taking longer than expected. Please check your dashboard.');
                    setTimeout(() => navigate('/dashboard'), 3000);
                }
            }, 2000);

            return () => clearInterval(poll);
        };

        checkActivation();
    }, [contestId, sessionId, navigate]);

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-green-500/30 border-t-green-500 animate-spin mb-6"></div>
            <h1 className="text-2xl font-bold mb-2">Processing Activation</h1>
            <p className="text-gray-400">{status}</p>
        </div>
    );
};

export default Paid;
