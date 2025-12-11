"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function WishlistButton({ itemId, mediaType, onUpdate }) {
    const { user } = useAuth();
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Check if item is in wishlist via API
        const checkWishlist = async () => {
            if (!user) {
                setIsInWishlist(false);
                return;
            }

            try {
                const response = await fetch(`/api/wishlist`);
                if (response.ok) {
                    const { wishlist } = await response.json();
                    const item = wishlist.find(w => w.content_id === itemId && w.media_type === mediaType);
                    setIsInWishlist(!!item);
                }
            } catch (error) {
                console.error('Error checking wishlist status:', error);
            }
        };
        checkWishlist();
    }, [itemId, mediaType, user]);

    const handleToggle = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        setLoading(true);
        try {

            if (isInWishlist) {
                // Remove from wishlist via API
                const response = await fetch(`/api/wishlist?itemId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setIsInWishlist(false);
                }
            } else {
                // Add to wishlist via API
                const response = await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
                if (response.ok) {
                    setIsInWishlist(true);
                }
            }
            if (onUpdate) onUpdate();
            // Dispatch custom event to notify profile page
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
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

