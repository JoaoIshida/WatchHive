"use client";
import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import ReminderPickerModal from './ReminderPickerModal';
import { isMovieReleased, isSeriesReleased } from '../utils/releaseDateValidator';

export default function WishlistButton({ itemId, mediaType, onUpdate, itemData = null }) {
    const { user } = useAuth();
    const { wishlist, refreshUserData } = useUserData();
    const [loading, setLoading] = useState(false);
    const [reminderOpen, setReminderOpen] = useState(false);

    const shouldShowWishlistReminder = () => {
        if (typeof window === 'undefined') return false;
        const suppressed = window.localStorage.getItem('watchhive_suppress_wishlist_reminder_picker') === '1';
        if (suppressed) return false;
        if (!itemData) return false;

        if (mediaType === 'movie') {
            // Only show for unreleased movies
            return !isMovieReleased(itemData);
        }
        if (mediaType === 'tv') {
            // Only show for series that may still have future episodes
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const status = (itemData.status || '').toLowerCase();
            if (['returning series', 'in production', 'planned', 'pilot'].includes(status)) {
                return true;
            }
            const nextAir = itemData.next_episode_to_air?.air_date;
            if (nextAir) {
                const nextDate = new Date(nextAir);
                nextDate.setHours(0, 0, 0, 0);
                if (nextDate >= now) return true;
            }
            if (itemData.last_air_date) {
                const lastDate = new Date(itemData.last_air_date);
                lastDate.setHours(0, 0, 0, 0);
                if (lastDate >= now) return true;
            }
            return !isSeriesReleased(itemData);
        }

        return false;
    };

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
                const res = await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
                if (res.ok) {
                    const data = await res.json().catch(() => ({}));
                    if (!data.alreadyExisted && shouldShowWishlistReminder()) {
                        setReminderOpen(true);
                    }
                }
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
            <ReminderPickerModal
                open={reminderOpen}
                onClose={() => setReminderOpen(false)}
                contentId={itemId}
                mediaType={mediaType}
                variant="wishlist"
                title="Wishlist release reminder"
                flowKey="wishlist"
            />
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
                        <BookmarkCheck className="w-4 h-4" />
                        <span>In Wishlist</span>
                    </>
                ) : (
                    <>
                        <Bookmark className="w-4 h-4" />
                        <span>Add to Wishlist</span>
                    </>
                )}
            </button>
        </>
    );
}
