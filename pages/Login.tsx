
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

    // If already logged in, redirect to dashboard
    React.useEffect(() => {
        if (session) {
            navigate('/dashboard');
        }
    }, [session, navigate]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

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

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            first_name: firstName.trim(),
                            last_name: lastName.trim(),
                            full_name: `${firstName.trim()} ${lastName.trim()}`
                        }
                    }
                });
                if (error) throw error;
                alert('Check your email for the confirmation link!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // Session update in context will trigger redirect
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#1c1c1e]/40 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in duration-300">
                <div className="text-center mb-8">
                    <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-16 h-16 rounded-xl shadow-2xl shadow-[#8F1D2C]/20 mx-auto mb-4 hover:scale-105 transition-transform" />
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </h1>
                    <p className="text-sm text-gray-400 mt-2">
                        {isSignUp ? 'Start organizing your pools' : 'Login to manage your contests'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <div className="grid grid-cols-2 gap-3">
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
                        <div className="space-y-1">
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
                        {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
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
