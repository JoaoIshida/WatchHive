"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from './LoginModal';

/**
 * Global Auth Modal Component
 * Provides a centralized way to open the auth modal from anywhere in the app
 * Use the openAuthModal event to trigger it
 */
export default function GlobalAuthModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [initialMode, setInitialMode] = useState('signin'); // 'signin' or 'signup'
    const { user } = useAuth();

    useEffect(() => {
        // Listen for open auth modal events
        const handleOpenAuth = (event) => {
            const mode = event.detail?.mode || 'signin';
            setInitialMode(mode);
            setIsOpen(true);
        };

        window.addEventListener('openAuthModal', handleOpenAuth);

        return () => {
            window.removeEventListener('openAuthModal', handleOpenAuth);
        };
    }, []);

    // Close modal if user becomes authenticated
    useEffect(() => {
        if (user && isOpen) {
            setIsOpen(false);
        }
    }, [user, isOpen]);

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleSuccess = () => {
        setIsOpen(false);
        // Dispatch event to refresh data
        window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
    };

    return (
        <LoginModal
            isOpen={isOpen}
            onClose={handleClose}
            onSuccess={handleSuccess}
            initialMode={initialMode}
        />
    );
}

