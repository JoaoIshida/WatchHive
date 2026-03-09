"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import { isMovieReleased, isSeriesReleased } from '../utils/releaseDateValidator';
import { formatDate } from '../utils/dateFormatter';
import { getSeriesWatchProgress } from '../utils/watchProgressHelper';
import UnreleasedNotification from './UnreleasedNotification';

export default function QuickActionsMenu({ itemId, mediaType, itemData, onUpdate }) {
    const { user } = useAuth();
    const { watched, wishlist, seriesProgress, customLists, refreshUserData } = useUserData();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);
    const [showNotification, setShowNotification] = useState(false);
    const [skippedItems, setSkippedItems] = useState([]);
    const [seriesSummary, setSeriesSummary] = useState(null);
    const [mounted, setMounted] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [missingEpisodes, setMissingEpisodes] = useState(0);
    const [showListModal, setShowListModal] = useState(false);
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

    // Derive watched/wishlist/list state from context
    const isWatched = (() => {
        if (!user) return false;
        const watchedItem = watched.find(w => w.content_id === itemId && w.media_type === mediaType);
        if (watchedItem) return true;
        if (mediaType === 'tv') {
            const progress = seriesProgress[itemId];
            return progress?.completed || false;
        }
        return false;
    })();

    const isInWishlist = (() => {
        if (!user) return false;
        return wishlist.some(w => w.content_id === itemId && w.media_type === mediaType);
    })();

    const itemLists = (() => {
        // Placeholder derived from context where possible; exact membership loaded on demand
        return [];
    })();

    // Calculate missing episodes from context
    useEffect(() => {
        if (!user || mediaType !== 'tv' || !itemData) {
            setMissingEpisodes(0);
            return;
        }
        const progress = seriesProgress[itemId];
        if (progress && itemData) {
            try {
                const watchProgress = getSeriesWatchProgress(itemId, itemData, progress, isWatched);
                setMissingEpisodes(Math.max(0, watchProgress.totalEpisodes - watchProgress.watchedEpisodes));
            } catch {
                setMissingEpisodes(0);
            }
        } else {
            setMissingEpisodes(0);
        }
    }, [user, mediaType, itemId, itemData, seriesProgress, isWatched]);

    // Calculate menu position when opening
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + 4,
                left: rect.right - 180,
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

    // Close menu on scroll so it doesn't stay fixed over wrong content
    useEffect(() => {
        if (!isOpen) return;
        const handleScroll = () => setIsOpen(false);
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [isOpen]);

    // Load membership when list modal opens
    const loadMembershipForModal = useCallback(async () => {
        if (!user || !itemId || !mediaType) return;
        try {
            const res = await fetch(`/api/custom-lists/membership?contentId=${itemId}&mediaType=${mediaType}`);
            if (res.ok) {
                const { listIds } = await res.json();
                setListModalItemLists(listIds || []);
            }
        } catch (e) {
            console.error('Error loading list membership:', e);
        }
    }, [user, itemId, mediaType]);

    useEffect(() => {
        if (showListModal && user) {
            loadMembershipForModal();
        }
    }, [showListModal, user, loadMembershipForModal]);

    const handleToggleWatched = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            setIsOpen(false);
            return;
        }

        if (!isWatched) {
            if (mediaType === 'movie' && itemData) {
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
                if (!response.ok) {
                    console.error('Failed to remove from watched');
                }
            } else {
                const response = await fetch('/api/watched', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
                if (response.ok) {
                    const data = await response.json();
                    
                    if (mediaType === 'tv' && data.seriesProgress) {
                        const skipped = [];
                        
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
                        
                        if (data.seriesProgress.skippedEpisodes) {
                            data.seriesProgress.skippedEpisodes.forEach(ep => {
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
                                    seasonName,
                                    episodeName,
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
            refreshUserData();
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
                await fetch(`/api/wishlist?itemId=${itemId}&mediaType=${mediaType}`, { method: 'DELETE' });
            } else {
                await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
            }
            refreshUserData();
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

        setIsOpen(false);
        setShowListModal(true);
    };

    const handleToggleListInModal = async (listId) => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

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
                const response = await fetch(`/api/custom-lists/${listId}/items?contentId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setListModalItemLists(prev => prev.filter(id => id !== listId));
                    setListSuccess('Removed from list');
                    setTimeout(() => setListSuccess(null), 2000);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to remove from list');
                }
            } else {
                const response = await fetch(`/api/custom-lists/${listId}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contentId: itemId, mediaType, title: validTitle }),
                });
                if (response.ok) {
                    setListModalItemLists(prev => [...prev, listId]);
                    setListSuccess('Added to list');
                    setTimeout(() => setListSuccess(null), 2000);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to add to list');
                }
            }
            refreshUserData();
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
            const response = await fetch('/api/custom-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newListName.trim() }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to create list');
            }

            const { list } = await response.json();

            const addResponse = await fetch(`/api/custom-lists/${list.id}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentId: itemId, mediaType, title: validTitle }),
            });

            if (!addResponse.ok) {
                const errorData = await addResponse.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to add item to list');
            }

            setNewListName('');
            setShowCreateForm(false);
            setListSuccess('List created and item added');
            setTimeout(() => setListSuccess(null), 2000);

            refreshUserData();
            await loadMembershipForModal();
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
                left: Math.max(8, menuPosition.left),
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

            {mounted && menuContent && createPortal(menuContent, document.body)}
            
            {showListModal && mounted && createPortal(
                <div 
                    className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
                    style={{ zIndex: 100002 }}
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

                            {customLists.length === 0 && !showCreateForm && (
                                <p className="text-white/70 text-sm mb-3">No lists yet. Create one!</p>
                            )}

                            <div className="space-y-2 flex-1 overflow-y-auto mb-3 min-h-0">
                                {customLists.map(list => {
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
                    </div>,
                document.body
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
