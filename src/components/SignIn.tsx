import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import './SignIn.css';

export function SignIn({ onToggleMode }: { onToggleMode: () => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setLoading(false);
    };

    const handleGoogleSignIn = async () => {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
        if (error) setError(error.message);
    };

    return (
        <div className="login-container">
            <div className="bg-blur-1"></div>
            <div className="bg-blur-2"></div>

            <div className="content-wrapper">
                <div className="logo-container">
                    <div className="logo-box">
                        <span className="material-symbols-outlined logo-icon">task_alt</span>
                    </div>
                </div>

                <div className="glass-card">
                    <div className="header-text">
                        <h1 className="header-title">Welcome Back</h1>
                        <p className="header-subtitle">Sign in to manage your tasks</p>
                    </div>

                    <form onSubmit={handleSignIn} className="form-group">
                        {error && <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>}

                        <div className="input-container">
                            <div className="label-row">
                                <label className="input-label">Email Address</label>
                            </div>
                            <div className="input-wrapper">
                                <span className="material-symbols-outlined input-icon">mail</span>
                                <input
                                    type="email"
                                    className="glass-input"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-container">
                            <div className="label-row">
                                <label className="input-label">Password</label>
                                <a href="#" className="forgot-link">Forgot?</a>
                            </div>
                            <div className="input-wrapper">
                                <span className="material-symbols-outlined input-icon">lock</span>
                                <input
                                    type="password"
                                    className="glass-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="primary-btn" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </form>

                    <div className="divider">
                        <div className="line"></div>
                        <span className="divider-text">or continue with</span>
                        <div className="line"></div>
                    </div>

                    <button type="button" onClick={handleGoogleSignIn} className="google-btn">
                        <svg className="google-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px" style={{ marginRight: '8px' }}>
                            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                        </svg>
                        <span>Sign in with Google</span>
                    </button>
                </div>

                <p className="signup-text">
                    Don't have an account? <span onClick={onToggleMode} className="signup-link" style={{ cursor: 'pointer' }}>Sign Up</span>
                </p>
            </div>
        </div>
    );
}
