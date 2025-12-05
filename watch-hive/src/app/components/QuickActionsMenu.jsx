"use client";
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isMovieReleased, isSeriesReleased } from '../utils/releaseDateValidator';
import { formatDate } from '../utils/dateFormatter';

export default function QuickActionsMenu({ itemId, mediaType, itemData, onUpdate }) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isWatched, setIsWatched] = useState(false);
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [itemLists, setItemLists] = useState([]);
    const [loading, setLoading] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        // Check initial states from API
        const checkStates = async () => {
            if (!user) {
                setIsWatched(false);
                setIsInWishlist(false);
                setItemLists([]);
                return;
            }

            try {
                const [watchedRes, wishlistRes, listsRes] = await Promise.all([
                    fetch('/api/watched'),
                    fetch('/api/wishlist'),
                    fetch('/api/custom-lists'),
                ]);

                if (watchedRes.ok) {
                    const { watched } = await watchedRes.json();
                    const watchedItem = watched.find(w => w.content_id === itemId && w.media_type === mediaType);
                    setIsWatched(!!watchedItem);
                }

                if (wishlistRes.ok) {
                    const { wishlist } = await wishlistRes.json();
                    const wishlistItem = wishlist.find(w => w.content_id === itemId && w.media_type === mediaType);
                    setIsInWishlist(!!wishlistItem);
                }

                if (listsRes.ok) {
                    const { lists } = await listsRes.json();
                    const listIds = [];
                    for (const list of lists || []) {
                        const listRes = await fetch(`/api/custom-lists/${list.id}`);
                        if (listRes.ok) {
                            const { list: listWithItems } = await listRes.json();
                            const hasItem = (listWithItems.items || []).some(item => 
                                item.content_id === itemId && item.media_type === mediaType
                            );
                            if (hasItem) {
                                listIds.push(list.id);
                            }
                        }
                    }
                    setItemLists(listIds);
                }
            } catch (error) {
                console.error('Error checking states:', error);
            }
        };
        checkStates();
    }, [itemId, mediaType, user]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggleWatched = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            setIsOpen(false);
            return;
        }

        // Check if item is released before marking as watched
        if (!isWatched) {
            if (mediaType === 'movie' && itemData && !isMovieReleased(itemData)) {
                alert(`This movie is not yet released. Release date: ${formatDate(itemData.release_date)}`);
                setIsOpen(false);
                return;
            } else if (mediaType === 'tv' && itemData && !isSeriesReleased(itemData)) {
                alert(`This series is not yet released. Release date: ${formatDate(itemData.first_air_date)}`);
                setIsOpen(false);
                return;
            }
        }

        setLoading(true);
        try {
            if (isWatched) {
                const response = await fetch(`/api/watched?itemId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setIsWatched(false);
                }
            } else {
                const response = await fetch('/api/watched', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
                if (response.ok) {
                    setIsWatched(true);
                }
            }
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error toggling watched:', error);
        } finally {
            setLoading(false);
            setIsOpen(false);
        }
    };

    const handleToggleWishlist = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            setIsOpen(false);
            return;
        }

        setLoading(true);
        try {
            if (isInWishlist) {
                const response = await fetch(`/api/wishlist?itemId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setIsInWishlist(false);
                }
            } else {
                const response = await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
                if (response.ok) {
                    setIsInWishlist(true);
                }
            }
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error toggling wishlist:', error);
        } finally {
            setLoading(false);
            setIsOpen(false);
        }
    };

    const handleAddToList = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            setIsOpen(false);
            return;
        }

        setLoading(true);
        try {
            // Get or create "My List"
            const listsRes = await fetch('/api/custom-lists');
            if (!listsRes.ok) throw new Error('Failed to fetch lists');
            
            const { lists } = await listsRes.json();
            let defaultList = lists.find(l => l.name === 'My List');
            
            if (!defaultList) {
                // Create default list
                const createRes = await fetch('/api/custom-lists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'My List' }),
                });
                if (!createRes.ok) throw new Error('Failed to create list');
                const { list } = await createRes.json();
                defaultList = list;
            }

            // Add item to list
            const addRes = await fetch(`/api/custom-lists/${defaultList.id}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: itemId,
                    mediaType,
                    title: itemData?.title || itemData?.name || 'Untitled',
                }),
            });

            if (addRes.ok) {
                setItemLists(prev => [...prev, defaultList.id]);
                window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
                if (onUpdate) onUpdate();
            }
        } catch (error) {
            console.error('Error adding to list:', error);
        } finally {
            setLoading(false);
            setIsOpen(false);
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center bg-futuristic-blue-950/90 backdrop-blur-sm rounded-full border border-futuristic-yellow-500/50 hover:bg-futuristic-blue-900 hover:border-futuristic-yellow-400 transition-all"
                aria-label="Quick actions"
                style={{ zIndex: 20 }}
            >
                <svg 
                    className="w-4 h-4 text-futuristic-yellow-400" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                >
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-10 right-0 z-30 bg-futuristic-blue-900 border border-futuristic-yellow-500/50 rounded-lg shadow-glow-yellow py-2 min-w-[180px]" style={{ zIndex: 30 }}>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleWatched();
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-futuristic-blue-800 text-white text-sm flex items-center gap-2"
                    >
                        {isWatched ? (
                            <>
                                <span>✓</span>
                                <span>Remove from Watched</span>
                            </>
                        ) : (
                            <>
                                <span>+</span>
                                <span>Mark as Watched</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleWishlist();
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-futuristic-blue-800 text-white text-sm flex items-center gap-2"
                    >
                        {isInWishlist ? (
                            <>
                                <span>★</span>
                                <span>Remove from Wishlist</span>
                            </>
                        ) : (
                            <>
                                <span>☆</span>
                                <span>Add to Wishlist</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddToList();
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-futuristic-blue-800 text-white text-sm flex items-center gap-2"
                    >
                        <span>📋</span>
                        <span>Add to List</span>
                    </button>
                </div>
            )}
        </div>
    );
}

