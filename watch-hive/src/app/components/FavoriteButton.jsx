"use client";
import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';

export default function FavoriteButton({ itemId, mediaType, onUpdate }) {
    const { user } = useAuth();
    const { favorites, refreshUserData } = useUserData();
    const [loading, setLoading] = useState(false);

    const isFavorite = user
        ? favorites.some((f) => f.content_id === itemId && f.media_type === mediaType)
        : false;

    const handleToggle = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        setLoading(true);
        try {
            if (isFavorite) {
                await fetch(`/api/favorites?itemId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
            } else {
                await fetch('/api/favorites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
            }
            if (onUpdate) onUpdate();
            refreshUserData();
        } catch (error) {
            console.error('Error toggling favorite:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleToggle}
            disabled={loading}
            className={`futuristic-button flex items-center gap-2 ${
                isFavorite ? 'bg-rose-600/90 hover:bg-rose-500 text-white' : ''
            }`}
            type="button"
        >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
        </button>
    );
}
