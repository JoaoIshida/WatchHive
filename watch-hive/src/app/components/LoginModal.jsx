"use client";
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';

export default function LoginModal({ isOpen, onClose, onSuccess, initialMode = 'signin' }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
    const [displayName, setDisplayName] = useState('');
    const [mounted, setMounted] = useState(false);
    const router = useRouter();
    const { signIn, signUp, checkAuthStatus } = useAuth();

    // Update mode when initialMode prop changes
    useEffect(() => {
        if (isOpen) {
            setIsSignUp(initialMode === 'signup');
        }
    }, [initialMode, isOpen]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen && mounted) {
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = 'unset';
            };
        }
    }, [isOpen, mounted]);

    if (!isOpen || !mounted) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isSignUp) {
                // Validate display name (required, 2+ characters)
                if (!displayName || displayName.trim().length < 2) {
                    setError('Display name must be at least 2 characters long');
                    setLoading(false);
                    return;
                }

                // Validate password strength
                if (password.length < 6) {
                    setError('Password must be at least 6 characters long');
                    setLoading(false);
                    return;
                }

                const result = await signUp(email, password, displayName.trim());

                if (result.error) {
                    setError(result.error.message || 'Failed to sign up. Please try again.');
                    setLoading(false);
                    return;
                }

                // Refresh auth status and close modal
                await checkAuthStatus();
                onSuccess?.();
                onClose();
                router.refresh();
            } else {
                const result = await signIn(email, password);

                if (result.error) {
                    setError(result.error.message || 'Failed to sign in. Please try again.');
                    setLoading(false);
                    return;
                }

                // Refresh auth status and close modal
                await checkAuthStatus();
                onSuccess?.();
                onClose();
                router.refresh();
            }
        } catch (error) {
            console.error('Auth error:', error);
            setError(error.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'}. Please try again.`);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setDisplayName('');
        setError('');
        setShowPassword(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const toggleMode = () => {
        resetForm();
        setIsSignUp(!isSignUp);
    };

    const modalContent = (
        <div 
            className="fixed inset-0"
            style={{ 
                zIndex: 99999,
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                isolation: 'isolate'
            }}
        >
            {/* Backdrop - covers everything including 3-dot menus and navigation buttons */}
            <div 
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
                style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1
                }}
            />
            
            {/* Modal Container */}
            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none" style={{ zIndex: 2 }}>
                {/* Modal */}
                <div 
                    className="futuristic-card p-8 max-w-md w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-bold text-amber-500 futuristic-text-glow-orange">
                        {isSignUp ? 'Sign Up' : 'Sign In'}
                    </h2>
                    <button
                        onClick={handleClose}
                        className="text-white/70 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="modal-email" className="block text-white mb-2">
                            Email
                        </label>
                        <input
                            id="modal-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-2 bg-charcoal-800 border border-amber-500/50 rounded text-white placeholder-white/50 focus:outline-none focus:border-amber-500"
                            placeholder="your@email.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="modal-password" className="block text-white mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="modal-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={isSignUp ? 6 : undefined}
                                className="w-full px-4 py-2 pr-12 bg-charcoal-800 border border-amber-500/50 rounded text-white placeholder-white/50 focus:outline-none focus:border-amber-500"
                                placeholder={isSignUp ? "At least 6 characters" : "Enter your password"}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {isSignUp && (
                        <div>
                            <label htmlFor="modal-display-name" className="block text-white mb-2">
                                Display Name
                            </label>
                            <input
                                id="modal-display-name"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full px-4 py-2 bg-charcoal-800 border border-amber-500/50 rounded text-white placeholder-white/50 focus:outline-none focus:border-amber-500"
                                placeholder="Your display name"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full futuristic-button-yellow py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={toggleMode}
                        className="text-white/70 hover:text-white transition-colors text-sm"
                    >
                        {isSignUp ? (
                            <>Already have an account? <span className="text-amber-500">Sign in</span></>
                        ) : (
                            <>Don't have an account? <span className="text-amber-500">Sign up</span></>
                        )}
                    </button>
                </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

