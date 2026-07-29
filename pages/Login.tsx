
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';

export const safeReturnTo = (value: string | null): string | null => {
    if (!value) return null;
    if (value.startsWith('?')) return `/${value}`;
    if (!value.startsWith('/') || value.startsWith('//')) return null;
    return value;
};

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
            const returnTo = safeReturnTo(searchParams.get('returnTo'));
            if (returnTo) {
                navigate(returnTo);
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
                const trimmedFirstName = firstName.trim();
                const trimmedLastName = lastName.trim();
                const fullName = [trimmedFirstName, trimmedLastName].filter(Boolean).join(' ').trim();

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            first_name: trimmedFirstName || null,
                            last_name: trimmedLastName || null,
                            full_name: fullName || email,
                            campaign: 'gridone_paid_unlock'
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
            } else if (msg === 'Load failed' || msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
                msg = 'Unable to connect. Please check your connection and try again.';
            }
            setError(msg);
        } finally {
            if (!successMessage) setLoading(false);
        }
    };

    if (successMessage) {
        return (
            <div className="oa-root min-h-screen bg-broadcast-white flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-broadcast-white border border-newsprint rounded-surface p-8 duration-300 text-center">
                    <div className="w-16 h-16 rounded-surface bg-gold flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-ink mb-2">Check your inbox</h2>
                    <p className="text-ink/60 mb-6">{successMessage}</p>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        className="text-sm text-ink/50 hover:text-ink transition-colors underline"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="oa-root min-h-screen bg-broadcast-white flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-broadcast-white border border-newsprint rounded-surface p-8 duration-300 transition-all">
                <div className="text-center mb-8">
                    <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-16 h-16 rounded-surface mx-auto mb-4 transition-transform ring-1 ring-gold/50" />
                    <h1 className="text-2xl font-bold text-ink tracking-tight">
                        {isSignUp ? 'Create your organizer account' : (isClaim ? 'Sign in to continue' : 'Welcome back')}
                    </h1>
                    <p className="text-sm text-ink/60 mt-2">
                        {isSignUp ? 'Build your board, edit it freely, and unlock sharing when it is ready.' : 'Sign in to manage your GridOne boards and share links.'}
                    </p>
                </div>

                {error && (
                    <div id="auth-error" className="oa-field-error mb-6 p-3 rounded-surface bg-cardinal-subtle border border-cardinal text-xs font-medium" role="alert">
                        <svg className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.3 3.8 2.6 17.1A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.9L13.7 3.8a2 2 0 0 0-3.4 0Z" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <div className="grid grid-cols-2 gap-3 duration-500">
                            <div className="space-y-1">
                                <label htmlFor="signup-first-name" className="text-xs font-bold text-ink/60 uppercase tracking-wide">First Name <span className="text-ink/60 normal-case">(optional)</span></label>
                                <input
                                    id="signup-first-name"
                                    type="text"
                                    autoComplete="given-name"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="oa-input w-full text-sm"
                                    placeholder="John"
                                />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="signup-last-name" className="text-xs font-bold text-ink/60 uppercase tracking-wide">Last Name <span className="text-ink/60 normal-case">(optional)</span></label>
                                <input
                                    id="signup-last-name"
                                    type="text"
                                    autoComplete="family-name"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="oa-input w-full text-sm"
                                    placeholder="Doe"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label htmlFor="auth-email" className="text-xs font-bold text-ink/60 uppercase tracking-wide">Email Address</label>
                        <input
                            id="auth-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="oa-input w-full text-sm"
                            placeholder="you@example.com"
                            aria-invalid={error ? 'true' : undefined}
                            aria-describedby={error ? 'auth-error' : undefined}
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="auth-password" className="text-xs font-bold text-ink/60 uppercase tracking-wide">Password</label>
                        <input
                            id="auth-password"
                            type="password"
                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="oa-input w-full text-sm"
                            placeholder="••••••••"
                            aria-invalid={error ? 'true' : undefined}
                            aria-describedby={error ? 'auth-error' : undefined}
                            required
                        />
                    </div>

                    {isSignUp && (
                        <div className="space-y-1 duration-500 delay-100">
                            <label htmlFor="auth-confirm-password" className="text-xs font-bold text-ink/60 uppercase tracking-wide">Confirm Password</label>
                            <input
                                id="auth-confirm-password"
                                type="password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="oa-input w-full text-sm"
                                placeholder="••••••••"
                                aria-invalid={error ? 'true' : undefined}
                                aria-describedby={error ? 'auth-error' : undefined}
                                required
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="oa-btn oa-btn-cardinal w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="text-xs text-ink/60 hover:text-ink transition-colors"
                    >
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                </div>

                <div className="mt-8 border-t border-newsprint pt-6 text-center">
                    <a href="/" className="text-xs text-ink/50 hover:text-ink/60 transition-colors">
                        &larr; Back to Guest View
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Login;
