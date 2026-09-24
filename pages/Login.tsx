
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { CapsuleButton, CapsuleInput, Eyebrow, Glass } from '../src/design/primitives';
import { ghostLink } from '../src/features/homepage/sections/cta';
import { SitePage } from '../src/features/site';
import FullScreenLoading from '../components/loading/FullScreenLoading';

export const safeReturnTo = (value: string | null): string | null => {
    if (!value) return null;
    if (value.startsWith('?')) return `/${value}`;
    if (!value.startsWith('/') || value.startsWith('//')) return null;
    return value;
};

/**
 * The sign-in card on the site shell, so /login carries the same banner and
 * main landmarks as every other public route. The header's own Sign in link is
 * dropped here: this page is that link's destination. The main is short, so it
 * holds its own height (header band plus the shell's vertical padding) and
 * centres the card inside it.
 */
const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <SitePage
        width="prose"
        withFooter={false}
        hideSignIn
        mainProps={{ className: 'flex min-h-[calc(100dvh-172px)] items-center justify-center' }}
    >
        {children}
    </SitePage>
);

const Login: React.FC = () => {
    const { session, loading: authLoading } = useAuth();
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

    const isAdoptDraft = searchParams.get('mode') === 'adopt-draft';
    const createIntent = safeReturnTo(searchParams.get('returnTo'))?.startsWith('/create') === true;

    // If already logged in, redirect to dashboard or return URL
    React.useEffect(() => {
        if (session) {
            const returnTo = safeReturnTo(searchParams.get('returnTo'));
            if (returnTo) {
                navigate(returnTo);
            } else if (isAdoptDraft) {
                navigate('/dashboard?mode=adopt-draft');
            } else {
                navigate('/dashboard');
            }
        }
    }, [session, navigate, isAdoptDraft, searchParams]);

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
                    setError('This email is already registered. Please sign in with your password to save your draft board.');
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

    // A signed-in organizer is redirected once the sign-in check settles;
    // until then, never show them the sign-in form.
    if (authLoading) return <FullScreenLoading />;

    if (successMessage) {
        return (
            <AuthShell>
                <Glass padding="lg" className="w-full max-w-[420px] flex flex-col gap-4">
                    <Eyebrow>Organizer sign in</Eyebrow>
                    <h1 className="font-display text-[32px] leading-[1.05] text-fg">Check your inbox</h1>
                    <p className="font-ui text-[17px] leading-[1.6] text-fg-2">{successMessage}</p>
                    <div>
                        <button
                            type="button"
                            onClick={() => setSuccessMessage(null)}
                            className={ghostLink}
                        >
                            Back to Login
                        </button>
                    </div>
                </Glass>
            </AuthShell>
        );
    }

    return (
        <AuthShell>
            <Glass padding="lg" className="w-full max-w-[420px]">
                <div className="flex flex-col gap-3">
                    <Eyebrow>{isSignUp ? 'New organizer' : 'Organizer sign in'}</Eyebrow>
                    <h1 className="font-display text-[32px] leading-[1.05] text-fg">
                        {isSignUp ? 'Create your organizer account' : (isAdoptDraft ? 'Sign in to save your draft' : 'Welcome back')}
                    </h1>
                    <p className="font-ui text-[16px] leading-[1.5] text-fg-2">
                        {isSignUp && createIntent ? 'Start the board now. Your first published board is free, and viewers will not need an account.' : isSignUp ? 'Build your board, edit it freely, and publish when it is ready.' : 'Sign in to manage your GridOne boards and share links.'}
                    </p>
                </div>

                {error && (
                    <Glass
                        id="auth-error"
                        role="alert"
                        className="mt-6 border-tone-cardinal/60 font-ui text-[15px] leading-[1.5] text-fg"
                    >
                        {error}
                    </Glass>
                )}

                <form onSubmit={handleAuth} className="mt-6 flex flex-col gap-4">
                    {isSignUp && (
                        <div className="grid grid-cols-2 gap-3">
                            <CapsuleInput
                                id="signup-first-name"
                                label="First Name (optional)"
                                type="text"
                                autoComplete="given-name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="John"
                            />
                            <CapsuleInput
                                id="signup-last-name"
                                label="Last Name (optional)"
                                type="text"
                                autoComplete="family-name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Doe"
                            />
                        </div>
                    )}

                    <CapsuleInput
                        id="auth-email"
                        label="Email Address"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        aria-invalid={error ? 'true' : undefined}
                        aria-describedby={error ? 'auth-error' : undefined}
                        required
                    />

                    <CapsuleInput
                        id="auth-password"
                        label="Password"
                        type="password"
                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        aria-invalid={error ? 'true' : undefined}
                        aria-describedby={error ? 'auth-error' : undefined}
                        required
                    />

                    {isSignUp && (
                        <CapsuleInput
                            id="auth-confirm-password"
                            label="Confirm Password"
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            aria-invalid={error ? 'true' : undefined}
                            aria-describedby={error ? 'auth-error' : undefined}
                            required
                        />
                    )}

                    <CapsuleButton type="submit" variant="primary" disabled={loading} className="mt-2 w-full">
                        {loading ? 'Processing...' : (isSignUp && createIntent ? 'Create account and start board' : isSignUp ? 'Create organizer account' : (isAdoptDraft ? 'Sign In & Save Draft' : 'Sign In'))}
                    </CapsuleButton>
                </form>

                <div className="mt-6 flex flex-col items-start gap-1 border-t border-hairline pt-4">
                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                            setConfirmPassword('');
                        }}
                        className={ghostLink}
                    >
                        {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create an organizer account"}
                    </button>
                    <a href="/" className={ghostLink}>Back to GridOne</a>
                </div>
            </Glass>
        </AuthShell>
    );
};

export default Login;
