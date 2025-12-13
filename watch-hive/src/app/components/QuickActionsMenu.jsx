"use client";
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { isMovieReleased, isSeriesReleased } from '../utils/releaseDateValidator';
import { formatDate } from '../utils/dateFormatter';
import { getSeriesWatchProgress } from '../utils/watchProgressHelper';
import UnreleasedNotification from './UnreleasedNotification';

export default function QuickActionsMenu({ itemId, mediaType, itemData, onUpdate }) {
    const { user } = useAuth();
    const router = useRouter();
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
    const [missingEpisodes, setMissingEpisodes] = useState(0);
    const [showListModal, setShowListModal] = useState(false);
    const [lists, setLists] = useState([]);
    const [listModalItemLists, setListModalItemLists] = useState([]);
    const [newListName, setNewListName] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [listError, setListError] = useState(null);
    const [listSuccess, setListSuccess] = useState(null);
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
                        let progress = null;
                        if (progressRes.ok) {
                            progress = await progressRes.json();
                            isComplete = progress.completed || false;
                        }
                        
                        // Series is watched if it's in watched_content OR marked as complete in progress
                        setIsWatched(!!watchedItem || isComplete);
                        
                        // Calculate missing episodes
                        if (itemData && progress) {
                            try {
                                // Fetch full series details if needed
                                let seriesData = itemData;
                                if (!seriesData.seasons || seriesData.seasons.length === 0) {
                                    const seriesRes = await fetch(`/api/tv/${itemId}`);
                                    if (seriesRes.ok) {
                                        seriesData = await seriesRes.json();
                                    }
                                }
                                
                                const watchProgress = getSeriesWatchProgress(itemId, seriesData, progress, !!watchedItem);
                                const missing = Math.max(0, watchProgress.totalEpisodes - watchProgress.watchedEpisodes);
                                setMissingEpisodes(missing);
                            } catch (error) {
                                console.error('Error calculating missing episodes:', error);
                            }
                        }
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

    // Load lists when modal opens
    useEffect(() => {
        if (showListModal && user) {
            loadListsForModal();
        }
    }, [showListModal, user, itemId, mediaType]);

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

    const handleAddToList = () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            setIsOpen(false);
            return;
        }

        // Close quick actions menu and open list selection modal
        setIsOpen(false);
        setShowListModal(true);
        loadListsForModal();
    };

    const loadListsForModal = async () => {
        if (!user) return;

        try {
            const response = await fetch('/api/custom-lists');
            if (response.ok) {
                const { lists: allLists } = await response.json();
                setLists(allLists || []);

                // Find which lists contain this item
                const listsWithItem = [];
                const listPromises = (allLists || []).map(async (list) => {
                    try {
                        const listResponse = await fetch(`/api/custom-lists/${list.id}`);
                        if (listResponse.ok) {
                            const { list: listWithItems } = await listResponse.json();
                            const hasItem = (listWithItems.items || []).some(item => 
                                item.content_id === itemId && item.media_type === mediaType
                            );
                            if (hasItem) {
                                return list.id;
                            }
                        }
                    } catch (error) {
                        console.error(`Error checking list ${list.id}:`, error);
                    }
                    return null;
                });

                const results = await Promise.all(listPromises);
                setListModalItemLists(results.filter(id => id !== null));
            }
        } catch (error) {
            console.error('Error loading lists:', error);
        }
    };

    const handleToggleListInModal = async (listId) => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        // Validate itemTitle - provide fallback if missing
        const validTitle = (itemData?.title || itemData?.name || 'Untitled')?.trim() || 'Untitled';
        if (!itemId || !mediaType) {
            setListError('Missing required item information');
            setTimeout(() => setListError(null), 3000);
            return;
        }

        setLoading(true);
        setListError(null);
        setListSuccess(null);
        try {
            const isInList = listModalItemLists.includes(listId);

            if (isInList) {
                // Remove from list via API
                const response = await fetch(`/api/custom-lists/${listId}/items?contentId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setListModalItemLists(prev => prev.filter(id => id !== listId));
                    setItemLists(prev => prev.filter(id => id !== listId));
                    setListSuccess('Removed from list');
                    setTimeout(() => setListSuccess(null), 2000);
                    await loadListsForModal();
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to remove from list');
                }
            } else {
                // Add to list via API
                const response = await fetch(`/api/custom-lists/${listId}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contentId: itemId,
                        mediaType,
                        title: validTitle,
                    }),
                });
                if (response.ok) {
                    setListModalItemLists(prev => [...prev, listId]);
                    setItemLists(prev => [...prev, listId]);
                    setListSuccess('Added to list');
                    setTimeout(() => setListSuccess(null), 2000);
                    await loadListsForModal();
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to add to list');
                }
            }
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error toggling list:', error);
            setListError(error.message || 'An error occurred');
            setTimeout(() => setListError(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateListInModal = async () => {
        if (!newListName.trim()) {
            setListError('List name is required');
            setTimeout(() => setListError(null), 3000);
            return;
        }

        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        // Validate itemTitle - provide fallback if missing
        const validTitle = (itemData?.title || itemData?.name || 'Untitled')?.trim() || 'Untitled';
        if (!itemId || !mediaType) {
            setListError('Missing required item information');
            setTimeout(() => setListError(null), 3000);
            return;
        }

        setLoading(true);
        setListError(null);
        setListSuccess(null);
        try {
            // Create list via API
            const response = await fetch('/api/custom-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newListName.trim(),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to create list');
            }

            const { list } = await response.json();
            
            // Add current item to the new list
            const addResponse = await fetch(`/api/custom-lists/${list.id}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: itemId,
                    mediaType,
                    title: validTitle,
                }),
            });

            if (!addResponse.ok) {
                const errorData = await addResponse.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to add item to list');
            }

            setNewListName('');
            setShowCreateForm(false);
            setListSuccess('List created and item added');
            setTimeout(() => setListSuccess(null), 2000);
            
            // Refresh lists and item lists state
            await loadListsForModal();
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error creating list:', error);
            setListError(error.message || 'Failed to create list');
            setTimeout(() => setListError(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleGoToUnwatchedEpisodes = () => {
        setIsOpen(false);
        router.push(`/series/${itemId}#seasons-episodes`);
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
            className="fixed bg-charcoal-900 border border-amber-500/50 rounded-lg shadow-subtle py-2 min-w-[180px]"
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
                className="w-full text-left px-4 py-2 hover:bg-charcoal-800 text-white text-sm flex items-center gap-2 disabled:opacity-50"
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
                className="w-full text-left px-4 py-2 hover:bg-charcoal-800 text-white text-sm flex items-center gap-2 disabled:opacity-50"
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
                className="w-full text-left px-4 py-2 hover:bg-charcoal-800 text-white text-sm flex items-center gap-2 disabled:opacity-50"
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
            {mediaType === 'tv' && missingEpisodes > 0 && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleGoToUnwatchedEpisodes();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-charcoal-800 text-white text-sm flex items-center gap-2"
                >
                    <span>📺</span>
                    <span>{missingEpisodes} missing episode{missingEpisodes !== 1 ? 's' : ''}</span>
                </button>
            )}
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
                className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center bg-charcoal-950/90 backdrop-blur-sm rounded-full border border-amber-500/50 hover:bg-charcoal-900 hover:border-amber-400 transition-all"
                aria-label="Quick actions"
            >
                <svg 
                    className="w-4 h-4 text-amber-400" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                >
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
            </button>

            {/* Portal the menu to body for proper z-index stacking */}
            {mounted && menuContent && createPortal(menuContent, document.body)}
            
            {/* List Selection Modal */}
            {showListModal && mounted && (
                <>
                    <div 
                        className="fixed inset-0 z-[99999] bg-black/50 flex items-center justify-center p-4"
                        onClick={() => {
                            setShowListModal(false);
                            setShowCreateForm(false);
                            setNewListName('');
                            setListError(null);
                            setListSuccess(null);
                        }}
                    >
                        <div 
                            className="bg-charcoal-900 border border-amber-500/50 rounded-lg shadow-subtle p-4 w-full max-w-sm max-h-[calc(100vh-2rem)] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-amber-400 font-bold">Your Lists</h3>
                                <button
                                    onClick={() => {
                                        setShowListModal(false);
                                        setShowCreateForm(false);
                                        setNewListName('');
                                        setListError(null);
                                        setListSuccess(null);
                                    }}
                                    className="text-white/70 hover:text-white w-8 h-8 flex items-center justify-center"
                                    aria-label="Close"
                                >
                                    ✕
                                </button>
                            </div>
                            
                            {listError && (
                                <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
                                    {listError}
                                </div>
                            )}
                            
                            {listSuccess && (
                                <div className="mb-3 p-2 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-sm">
                                    {listSuccess}
                                </div>
                            )}

                            {lists.length === 0 && !showCreateForm && (
                                <p className="text-white/70 text-sm mb-3">No lists yet. Create one!</p>
                            )}

                            <div className="space-y-2 flex-1 overflow-y-auto mb-3 min-h-0">
                                {lists.map(list => {
                                    const isInList = listModalItemLists.includes(list.id);
                                    return (
                                        <button
                                            key={list.id}
                                            onClick={() => handleToggleListInModal(list.id)}
                                            disabled={loading}
                                            className={`w-full text-left px-3 py-3 rounded transition-all min-h-[44px] flex flex-col justify-center ${
                                                isInList
                                                    ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                                                    : 'bg-charcoal-800/50 hover:bg-charcoal-800 text-white'
                                            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">{list.name}</span>
                                                <span>{isInList ? '✓' : '+'}</span>
                                            </div>
                                            {list.is_public && (
                                                <span className="text-xs text-amber-400/80 mt-1">
                                                    Public
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {showCreateForm ? (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={newListName}
                                        onChange={(e) => setNewListName(e.target.value)}
                                        placeholder="List name"
                                        className="w-full px-3 py-2 bg-charcoal-800 border border-amber-500/50 rounded text-white placeholder-white/50 focus:outline-none focus:border-amber-400"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                handleCreateListInModal();
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCreateListInModal}
                                            disabled={loading}
                                            className="flex-1 futuristic-button-yellow text-sm py-3 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? 'Creating...' : 'Create'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowCreateForm(false);
                                                setNewListName('');
                                                setListError(null);
                                            }}
                                            disabled={loading}
                                            className="flex-1 futuristic-button text-sm py-3 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowCreateForm(true)}
                                    disabled={loading}
                                    className="w-full futuristic-button-yellow text-sm py-3 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    + Create New List
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
            
            <UnreleasedNotification
                isOpen={showNotification}
                onClose={() => setShowNotification(false)}
                skippedItems={skippedItems}
                summary={seriesSummary}
            />
        </div>
    );
}
