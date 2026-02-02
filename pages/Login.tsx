
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';

const Login: React.FC = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [searchParams] = useSearchParams();
    const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const isClaim = searchParams.get('mode') === 'claim';

    // If already logged in, redirect to dashboard or return URL
    React.useEffect(() => {
        if (session) {
            const returnTo = searchParams.get('returnTo');
            // Preserve 'mode=claim' if it exists to trigger downstream logic
            if (returnTo) {
                const decoded = decodeURIComponent(returnTo);
                // If returnTo is just query params (e.g. ?poolId=...), prepend /
                const target = decoded.startsWith('?') ? `/${decoded}` : decoded;
                navigate(target);
            } else if (isClaim) {
                navigate('/dashboard?mode=claim');
            } else {
                navigate('/dashboard');
            }
        }
    }, [session, navigate, isClaim, searchParams]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (isSignUp) {
                // Validate password confirmation
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }
                if (password.length < 6) {
                    throw new Error('Password must be at least 6 characters');
                }
                if (!firstName.trim() || !lastName.trim()) {
                    throw new Error('First and last name are required');
                }

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            first_name: firstName.trim(),
                            last_name: lastName.trim(),
                            full_name: `${firstName.trim()} ${lastName.trim()}`,
                            campaign: 'superbowl_2026_free' // Tag for marketing
                        }
                    }
                });

                if (error) throw error;

                // SMART PIVOT: Check if user identity is empty (Indicates email exists but user tried to sign up)
                if (data.user && data.user.identities && data.user.identities.length === 0) {
                    setIsSignUp(false); // Pivot to Sign In
                    setError('This email is already registered. Please sign in with your password to claim your board.');
                    setLoading(false);
                    return; // Stop here, let them type password and click Sign In
                }

                setSuccessMessage('Check your email for the confirmation link!');
                setLoading(false);
                return;
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) {
                    throw error;
                }
                // Session update in context will trigger redirect
            }
        } catch (err: any) {
            let msg = err.message;
            // Fallback for unexpected error formats
            if (msg.includes('already registered') || msg.includes('User already exists')) {
                setIsSignUp(false);
                msg = 'Account already exists. Please sign in.';
            } else if (msg.includes('Invalid login credentials')) {
                msg = 'No account found or incorrect password. Create one?';
            }
            setError(msg);
        } finally {
            if (!successMessage) setLoading(false);
        }
    };

    if (successMessage) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-[#1c1c1e]/40 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in duration-300 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
                    <p className="text-gray-400 mb-6">{successMessage}</p>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        className="text-sm text-white/50 hover:text-white transition-colors underline"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#1c1c1e]/40 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in duration-300 transition-all">
                <div className="text-center mb-8">
                    <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-16 h-16 rounded-xl shadow-2xl shadow-[#8F1D2C]/20 mx-auto mb-4 hover:scale-105 transition-transform ring-1 ring-[#FFC72C]/50" />
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        {isSignUp ? 'Create Free Account' : (isClaim ? 'Sign In to Claim' : 'Welcome Back')}
                    </h1>
                    <p className="text-sm text-gray-400 mt-2">
                        {isSignUp ? 'Join the 2026 Pool - It’s Free' : 'Login to manage your contests'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium animate-in slide-in-from-top-2">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">First Name</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-white/30 focus:bg-black/40 outline-none transition-all placeholder:text-gray-600"
                                    placeholder="John"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Last Name</label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-white/30 focus:bg-black/40 outline-none transition-all placeholder:text-gray-600"
                                    placeholder="Doe"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-white/30 focus:bg-black/40 outline-none transition-all placeholder:text-gray-600"
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-white/30 focus:bg-black/40 outline-none transition-all placeholder:text-gray-600"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {isSignUp && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-4 duration-500 delay-100">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-white/30 focus:bg-black/40 outline-none transition-all placeholder:text-gray-600"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl bg-white text-black font-bold text-sm uppercase tracking-wide hover:bg-gray-200 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {loading ? 'Processing...' : (isSignUp ? 'Create Account' : (isClaim ? 'Sign In & Claim Board' : 'Sign In'))}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                            setConfirmPassword('');
                        }}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                </div>

                <div className="mt-8 border-t border-white/5 pt-6 text-center">
                    <a href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                        &larr; Back to Guest View
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Login;
