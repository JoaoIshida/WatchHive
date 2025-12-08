"use client";
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { isMovieReleased, isSeriesReleased } from '../utils/releaseDateValidator';
import { formatDate } from '../utils/dateFormatter';
import UnreleasedNotification from './UnreleasedNotification';

export default function QuickActionsMenu({ itemId, mediaType, itemData, onUpdate }) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isWatched, setIsWatched] = useState(false);
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [itemLists, setItemLists] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null); // 'watched', 'wishlist', 'list'
    const [showNotification, setShowNotification] = useState(false);
    const [skippedItems, setSkippedItems] = useState([]);
    const [seriesSummary, setSeriesSummary] = useState(null);
    const [mounted, setMounted] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const menuRef = useRef(null);

    useEffect(() => {
        setMounted(true);
    }, []);

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
                // For series, also check series progress
                let watchedRes, progressRes, wishlistRes, listsRes;
                
                if (mediaType === 'tv') {
                    [watchedRes, progressRes, wishlistRes, listsRes] = await Promise.all([
                        fetch('/api/watched'),
                        fetch(`/api/series-progress/${itemId}`),
                        fetch('/api/wishlist'),
                        fetch('/api/custom-lists'),
                    ]);

                    if (watchedRes.ok) {
                        const { watched } = await watchedRes.json();
                        const watchedItem = watched.find(w => w.content_id === itemId && w.media_type === mediaType);
                        
                        // Also check if series is marked as complete in progress
                        let isComplete = false;
                        if (progressRes.ok) {
                            const progress = await progressRes.json();
                            isComplete = progress.completed || false;
                        }
                        
                        // Series is watched if it's in watched_content OR marked as complete in progress
                        setIsWatched(!!watchedItem || isComplete);
                    }
                } else {
                    [watchedRes, wishlistRes, listsRes] = await Promise.all([
                        fetch('/api/watched'),
                        fetch('/api/wishlist'),
                        fetch('/api/custom-lists'),
                    ]);

                    if (watchedRes.ok) {
                        const { watched } = await watchedRes.json();
                        const watchedItem = watched.find(w => w.content_id === itemId && w.media_type === mediaType);
                        setIsWatched(!!watchedItem);
                    }
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
        
        // Listen for data updates
        const handleUpdate = () => checkStates();
        window.addEventListener('watchhive-data-updated', handleUpdate);
        
        return () => {
            window.removeEventListener('watchhive-data-updated', handleUpdate);
        };
    }, [itemId, mediaType, user]);

    // Calculate menu position when opening
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + 4,
                left: rect.right - 180, // Menu width is 180px
            });
        }
    }, [isOpen]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                menuRef.current && 
                !menuRef.current.contains(event.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target)
            ) {
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
            if (mediaType === 'movie' && itemData) {
                // Check if movie is released - also treat movies without release_date as unreleased
                const hasReleaseDate = itemData.release_date && itemData.release_date.trim() !== '';
                const isReleased = hasReleaseDate && isMovieReleased(itemData);
                
                if (!isReleased) {
                    setSkippedItems([{
                        type: 'movie',
                        name: itemData.title || 'Movie',
                        releaseDate: itemData.release_date ? formatDate(itemData.release_date) : 'N/A'
                    }]);
                    setSeriesSummary(null);
                    setShowNotification(true);
                    setIsOpen(false);
                    return;
                }
            } else if (mediaType === 'tv' && itemData && !isSeriesReleased(itemData)) {
                setSkippedItems([{
                    type: 'series',
                    name: itemData.name || 'Series',
                    releaseDate: formatDate(itemData.first_air_date)
                }]);
                setSeriesSummary(null);
                setShowNotification(true);
                setIsOpen(false);
                return;
            }
        }

        setLoading(true);
        setLoadingAction('watched');
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
                    const data = await response.json();
                    setIsWatched(true);
                    
                    // For series, check if there were skipped items
                    if (mediaType === 'tv' && data.seriesProgress) {
                        const skipped = [];
                        
                        // Add skipped seasons
                        if (data.seriesProgress.skippedSeasons) {
                            data.seriesProgress.skippedSeasons.forEach(s => {
                                skipped.push({
                                    type: 'season',
                                    seriesName: itemData?.name || 'Series',
                                    seasonName: s.name || `Season ${s.season_number}`,
                                    releaseDate: formatDate(s.air_date)
                                });
                            });
                        }
                        
                        // Add skipped episodes
                        if (data.seriesProgress.skippedEpisodes) {
                            data.seriesProgress.skippedEpisodes.forEach(ep => {
                                // Handle episode name - check multiple possible fields
                                const episodeName = ep.name || ep.episodeName || 
                                    (ep.episode_number ? `Episode ${ep.episode_number}` : 
                                     ep.episodeNumber ? `Episode ${ep.episodeNumber}` : 'Episode');
                                const seasonName = ep.seasonName || 
                                    (ep.season_number ? `Season ${ep.season_number}` : 
                                     ep.seasonNumber ? `Season ${ep.seasonNumber}` : 'Season');
                                const releaseDate = ep.air_date || ep.releaseDate || 'N/A';
                                
                                skipped.push({
                                    type: 'episode',
                                    seriesName: itemData?.name || 'Series',
                                    seasonName: seasonName,
                                    episodeName: episodeName,
                                    releaseDate: releaseDate !== 'N/A' ? formatDate(releaseDate) : 'N/A'
                                });
                            });
                        }
                        
                        if (skipped.length > 0) {
                            setSkippedItems(skipped);
                            setSeriesSummary({
                                markedSeasons: data.seriesProgress.markedSeasons || 0,
                                markedEpisodes: data.seriesProgress.markedEpisodes || 0
                            });
                            setShowNotification(true);
                        }
                    }
                }
            }
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error toggling watched:', error);
        } finally {
            setLoading(false);
            setLoadingAction(null);
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
        setLoadingAction('wishlist');
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
            setLoadingAction(null);
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
        setLoadingAction('list');
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
            setLoadingAction(null);
            setIsOpen(false);
        }
    };

    const LoadingSpinner = () => (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );

    const menuContent = isOpen && mounted && (
        <div 
            ref={menuRef}
            className="fixed bg-futuristic-blue-900 border border-futuristic-yellow-500/50 rounded-lg shadow-glow-yellow py-2 min-w-[180px]"
            style={{ 
                zIndex: 99998,
                top: menuPosition.top,
                left: Math.max(8, menuPosition.left), // Ensure menu doesn't go off-screen
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleToggleWatched();
                }}
                disabled={loading}
                className="w-full text-left px-4 py-2 hover:bg-futuristic-blue-800 text-white text-sm flex items-center gap-2 disabled:opacity-50"
            >
                {loadingAction === 'watched' ? (
                    <>
                        <LoadingSpinner />
                        <span>Processing...</span>
                    </>
                ) : isWatched ? (
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
                disabled={loading}
                className="w-full text-left px-4 py-2 hover:bg-futuristic-blue-800 text-white text-sm flex items-center gap-2 disabled:opacity-50"
            >
                {loadingAction === 'wishlist' ? (
                    <>
                        <LoadingSpinner />
                        <span>Processing...</span>
                    </>
                ) : isInWishlist ? (
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
                disabled={loading}
                className="w-full text-left px-4 py-2 hover:bg-futuristic-blue-800 text-white text-sm flex items-center gap-2 disabled:opacity-50"
            >
                {loadingAction === 'list' ? (
                    <>
                        <LoadingSpinner />
                        <span>Processing...</span>
                    </>
                ) : (
                    <>
                        <span>📋</span>
                        <span>Add to List</span>
                    </>
                )}
            </button>
        </div>
    );

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center bg-futuristic-blue-950/90 backdrop-blur-sm rounded-full border border-futuristic-yellow-500/50 hover:bg-futuristic-blue-900 hover:border-futuristic-yellow-400 transition-all"
                aria-label="Quick actions"
            >
                <svg 
                    className="w-4 h-4 text-futuristic-yellow-400" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                >
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
            </button>

            {/* Portal the menu to body for proper z-index stacking */}
            {mounted && menuContent && createPortal(menuContent, document.body)}
            
            <UnreleasedNotification
                isOpen={showNotification}
                onClose={() => setShowNotification(false)}
                skippedItems={skippedItems}
                summary={seriesSummary}
            />
        </div>
    );
}
