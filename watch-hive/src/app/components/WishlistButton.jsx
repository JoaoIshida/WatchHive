"use client";
import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import ReminderPickerModal from './ReminderPickerModal';

export default function WishlistButton({ itemId, mediaType, onUpdate }) {
    const { user } = useAuth();
    const { wishlist, refreshUserData } = useUserData();
    const [loading, setLoading] = useState(false);
    const [reminderOpen, setReminderOpen] = useState(false);

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
                    if (!data.alreadyExisted) setReminderOpen(true);
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
