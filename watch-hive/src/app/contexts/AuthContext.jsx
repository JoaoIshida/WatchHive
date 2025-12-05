"use client";
import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext({
    user: null,
    loading: true,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    signUp: async () => ({ error: null }),
    checkAuthStatus: async () => {},
});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check authentication status from server
    const checkAuthStatus = async () => {
        try {
            const response = await fetch('/api/auth/me', {
                method: 'GET',
                credentials: 'include', // Include cookies
            });

            if (response.ok) {
                const result = await response.json();
                // Only set user if we have a valid user object with an id
                if (result.user && result.user.id) {
                    setUser(result.user);
                } else {
                    setUser(null);
                }
            } else {
                // User not authenticated - explicitly set to null
                setUser(null);
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuthStatus();
    }, []);

    const signIn = async (email, password) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password
                }),
                credentials: 'include', // Include cookies
            });

            const result = await response.json();

            if (!response.ok) {
                return { error: { message: result.error || 'Login failed' } };
            }

            // Update user state from response
            setUser(result.user);

            return { error: null };
        } catch (error) {
            return { error: { message: 'Login failed: ' + error.message } };
        }
    };

    const signUp = async (email, password, displayName) => {
        try {
            // For now, use Supabase Auth for signup since we need to create the auth user
            // TODO: Create custom signup endpoint that creates both auth user and profile
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    displayName,
                }),
                credentials: 'include',
            });

            const result = await response.json();

            if (!response.ok) {
                return { error: { message: result.error || 'Signup failed' } };
            }

            // Auto-login after signup
            if (result.user) {
                setUser(result.user);
            }

            return { error: null };
        } catch (error) {
            return { error: { message: 'Signup failed: ' + error.message } };
        }
    };

    const signOut = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include', // Include cookies
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear user state regardless of API call success
            setUser(null);
        }
    };

    const value = {
        user,
        loading,
        signIn,
        signOut,
        signUp,
        checkAuthStatus,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};