"use client";
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';

export default function WishlistButton({ itemId, mediaType, onUpdate }) {
    const { user } = useAuth();
    const { wishlist, refreshUserData } = useUserData();
    const [loading, setLoading] = useState(false);

    const isInWishlist = user
        ? wishlist.some(w => w.content_id === itemId && w.media_type === mediaType)
        : false;

    const handleToggle = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        setLoading(true);
        try {
            if (isInWishlist) {
                await fetch(`/api/wishlist?itemId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
            } else {
                await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
            }
            if (onUpdate) onUpdate();
            refreshUserData();
        } catch (error) {
            console.error('Error toggling wishlist status:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={handleToggle}
                disabled={loading}
                className={`futuristic-button flex items-center gap-2 ${
                    isInWishlist 
                        ? 'bg-amber-500 hover:bg-amber-400 text-black' 
                        : ''
                }`}
            >
                {isInWishlist ? (
                    <>
                        <span>★</span>
                        <span>In Wishlist</span>
                    </>
                ) : (
                    <>
                        <span>☆</span>
                        <span>Add to Wishlist</span>
                    </>
                )}
            </button>
        </>
    );
}
