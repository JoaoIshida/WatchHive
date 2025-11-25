"use client";
import { useState, useEffect } from 'react';
import { wishlistStorage } from '../lib/localStorage';

export default function WishlistButton({ itemId, mediaType, onUpdate }) {
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Check if item is in wishlist
        const inWishlist = wishlistStorage.isInWishlist(String(itemId), mediaType);
        setIsInWishlist(inWishlist);
    }, [itemId, mediaType]);

    const handleToggle = () => {
        setLoading(true);
        try {
            if (isInWishlist) {
                // Remove from wishlist
                wishlistStorage.remove(String(itemId), mediaType);
                setIsInWishlist(false);
            } else {
                // Add to wishlist
                wishlistStorage.add(String(itemId), mediaType);
                setIsInWishlist(true);
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
        <button
            onClick={handleToggle}
            disabled={loading}
            className={`futuristic-button flex items-center gap-2 ${
                isInWishlist 
                    ? 'bg-futuristic-yellow-500 hover:bg-futuristic-yellow-400 text-black' 
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
    );
}

