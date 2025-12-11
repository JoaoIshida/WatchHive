"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isMovieReleased, isSeriesReleased, isSeasonReleased, isEpisodeReleased } from '../utils/releaseDateValidator';
import { formatDate } from '../utils/dateFormatter';
import UnreleasedNotification from './UnreleasedNotification';

export default function WatchedButton({ itemId, mediaType, onUpdate, seasons = null, itemData = null }) {
    const { user } = useAuth();
    const [isWatched, setIsWatched] = useState(false);
    const [timesWatched, setTimesWatched] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [skippedItems, setSkippedItems] = useState([]);
    const [error, setError] = useState(null);
    const [seriesSummary, setSeriesSummary] = useState(null);

    useEffect(() => {
        // Check if item is watched via API
        const checkWatched = async () => {
            if (!user) {
                setIsWatched(false);
                setTimesWatched(0);
                return;
            }

            try {
                // For series, also check series progress
                if (mediaType === 'tv') {
                    const [watchedResponse, progressResponse] = await Promise.all([
                        fetch(`/api/watched`),
                        fetch(`/api/series-progress/${itemId}`)
                    ]);

                    if (watchedResponse.ok) {
                        const { watched } = await watchedResponse.json();
                        const item = watched.find(w => w.content_id === itemId && w.media_type === mediaType);
                        
                        // Also check if series is marked as complete in progress
                        let isComplete = false;
                        if (progressResponse.ok) {
                            const progress = await progressResponse.json();
                            isComplete = progress.completed || false;
                        }

                        // Series is watched if it's in watched_content OR marked as complete in progress
                        if (item || isComplete) {
                            setIsWatched(true);
                            setTimesWatched(item?.times_watched || 1);
                        } else {
                            setIsWatched(false);
                            setTimesWatched(0);
                        }
                    }
                } else {
                    // For movies, just check watched_content
                    const response = await fetch(`/api/watched`);
                    if (response.ok) {
                        const { watched } = await response.json();
                        const item = watched.find(w => w.content_id === itemId && w.media_type === mediaType);
                        if (item) {
                            setIsWatched(true);
                            setTimesWatched(item.times_watched || 1);
                        } else {
                            setIsWatched(false);
                            setTimesWatched(0);
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking watched status:', error);
            }
        };
        checkWatched();
        
        // Listen for data updates
        const handleUpdate = () => checkWatched();
        window.addEventListener('watchhive-data-updated', handleUpdate);
        
        return () => {
            window.removeEventListener('watchhive-data-updated', handleUpdate);
        };
    }, [itemId, mediaType, user]);

    const handleToggle = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        // Store previous state for rollback
        const previousState = { isWatched, timesWatched };
        let canOptimisticallyUpdate = false;
        setError(null);

        if (isWatched) {
            // OPTIMISTIC UPDATE: Unwatching is always safe to update optimistically
            setIsWatched(false);
            setTimesWatched(0);
            canOptimisticallyUpdate = true;
            setLoading(true);
            
            try {
                const response = await fetch(`/api/watched?itemId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
                
                if (!response.ok) {
                    // Rollback on error
                    setIsWatched(previousState.isWatched);
                    setTimesWatched(previousState.timesWatched);
                    setError('Failed to remove from watched. Please try again.');
                } else {
                    // Successfully unwatched - refresh the watched status to ensure UI is in sync
                    // This is especially important for series to ensure series progress is cleared
                    if (mediaType === 'tv') {
                        // Check both watched_content and series_progress to ensure everything is cleared
                        try {
                            const [watchedResponse, progressResponse] = await Promise.all([
                                fetch(`/api/watched`),
                                fetch(`/api/series-progress/${itemId}`)
                            ]);

                            if (watchedResponse.ok) {
                                const { watched } = await watchedResponse.json();
                                const item = watched.find(w => w.content_id === itemId && w.media_type === mediaType);
                                
                                // Also check if series is marked as complete in progress
                                let isComplete = false;
                                if (progressResponse.ok) {
                                    const progress = await progressResponse.json();
                                    isComplete = progress.completed || false;
                                }

                                // Update state based on actual server state
                                if (item || isComplete) {
                                    setIsWatched(true);
                                    setTimesWatched(item?.times_watched || 1);
                                } else {
                                    setIsWatched(false);
                                    setTimesWatched(0);
                                }
                            }
                        } catch (refreshError) {
                            console.error('Error refreshing watched status after unwatch:', refreshError);
                            // State is already set to unwatched, so this is just a refresh failure
                        }
                    } else {
                        // For movies, just verify the watched status
                        try {
                            const watchedResponse = await fetch(`/api/watched`);
                            if (watchedResponse.ok) {
                                const { watched } = await watchedResponse.json();
                                const item = watched.find(w => w.content_id === itemId && w.media_type === mediaType);
                                if (item) {
                                    setIsWatched(true);
                                    setTimesWatched(item.times_watched || 1);
                                } else {
                                    setIsWatched(false);
                                    setTimesWatched(0);
                                }
                            }
                        } catch (refreshError) {
                            console.error('Error refreshing watched status after unwatch:', refreshError);
                        }
                    }
                }
            } catch (error) {
                console.error('Error removing watched status:', error);
                // Rollback on error
                setIsWatched(previousState.isWatched);
                setTimesWatched(previousState.timesWatched);
                setError('Failed to remove from watched. Please try again.');
            } finally {
                setLoading(false);
            }
        } else {
            // Check if item is released before marking as watched
            if (mediaType === 'movie') {
                if (itemData && !isMovieReleased(itemData)) {
                    setSkippedItems([{
                        type: 'movie',
                        name: itemData.title,
                        releaseDate: formatDate(itemData.release_date)
                    }]);
                    setShowNotification(true);
                    return; // Don't proceed if unreleased
                }
                // Movie is released, safe to update optimistically
                setIsWatched(true);
                setTimesWatched(1);
                canOptimisticallyUpdate = true;
            } else if (mediaType === 'tv') {
                if (itemData && !isSeriesReleased(itemData)) {
                    setSkippedItems([{
                        type: 'series',
                        name: itemData.name,
                        releaseDate: formatDate(itemData.first_air_date)
                    }]);
                    setShowNotification(true);
                    return; // Don't proceed if unreleased
                }
                // Series is released (backend will filter unreleased episodes)
                // Safe to update optimistically - backend handles episode filtering
                setIsWatched(true);
                setTimesWatched(1);
                canOptimisticallyUpdate = true;
            }

            setLoading(true);
            try {
                // Mark as watched via API (backend will handle series progress syncing)
                const response = await fetch('/api/watched', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const { watched, seriesProgress } = data;
                    
                    // Update with actual server response
                    setTimesWatched(watched?.times_watched || 1);
                    
                    // Handle skipped content feedback for series
                    if (mediaType === 'tv') {
                        // Always check for seriesProgress, even if it's empty
                        const skipped = [];
                        
                        // Debug logging
                        console.log('Full API response:', data);
                        console.log('Series progress data:', seriesProgress);
                        
                        if (seriesProgress) {
                            // Add skipped seasons to notification
                            if (seriesProgress.skippedSeasons && Array.isArray(seriesProgress.skippedSeasons) && seriesProgress.skippedSeasons.length > 0) {
                                console.log('Found skipped seasons:', seriesProgress.skippedSeasons.length);
                                seriesProgress.skippedSeasons.forEach(season => {
                                    skipped.push({
                                        type: 'season',
                                        seriesName: itemData?.name || 'Series',
                                        seasonName: season.seasonName || `Season ${season.seasonNumber}`,
                                        releaseDate: formatDate(season.releaseDate)
                                    });
                                });
                            }
                            
                            // Add skipped episodes to notification
                            if (seriesProgress.skippedEpisodes && Array.isArray(seriesProgress.skippedEpisodes) && seriesProgress.skippedEpisodes.length > 0) {
                                console.log('Found skipped episodes:', seriesProgress.skippedEpisodes.length);
                                seriesProgress.skippedEpisodes.forEach(ep => {
                                    skipped.push({
                                        type: 'episode',
                                        seriesName: itemData?.name || 'Series',
                                        seasonName: ep.seasonName || `Season ${ep.seasonNumber}`,
                                        episodeName: ep.episodeName || `Episode ${ep.episodeNumber}`,
                                        releaseDate: formatDate(ep.releaseDate)
                                    });
                                });
                            }
                            
                            // Show notification if there are skipped items
                            const hasSkippedSeasons = seriesProgress.skippedSeasons && Array.isArray(seriesProgress.skippedSeasons) && seriesProgress.skippedSeasons.length > 0;
                            const hasSkippedEpisodes = seriesProgress.skippedEpisodes && Array.isArray(seriesProgress.skippedEpisodes) && seriesProgress.skippedEpisodes.length > 0;
                            
                            if (skipped.length > 0 || hasSkippedSeasons || hasSkippedEpisodes) {
                                console.log('Showing notification with skipped items:', {
                                    skippedArray: skipped,
                                    skippedSeasons: seriesProgress.skippedSeasons,
                                    skippedEpisodes: seriesProgress.skippedEpisodes,
                                    markedSeasons: seriesProgress.markedSeasons,
                                    markedEpisodes: seriesProgress.markedEpisodes
                                });
                                
                                // Ensure we have all skipped items
                                if (skipped.length === 0) {
                                    // Rebuild skipped array if it's empty but we have data
                                    if (hasSkippedSeasons) {
                                        seriesProgress.skippedSeasons.forEach(season => {
                                            skipped.push({
                                                type: 'season',
                                                seriesName: itemData?.name || 'Series',
                                                seasonName: season.seasonName || `Season ${season.seasonNumber}`,
                                                releaseDate: formatDate(season.releaseDate)
                                            });
                                        });
                                    }
                                    if (hasSkippedEpisodes) {
                                        seriesProgress.skippedEpisodes.forEach(ep => {
                                            skipped.push({
                                                type: 'episode',
                                                seriesName: itemData?.name || 'Series',
                                                seasonName: ep.seasonName || `Season ${ep.seasonNumber}`,
                                                episodeName: ep.episodeName || `Episode ${ep.episodeNumber}`,
                                                releaseDate: formatDate(ep.releaseDate)
                                            });
                                        });
                                    }
                                }
                                
                                if (skipped.length > 0) {
                                    setSkippedItems(skipped);
                                    setSeriesSummary({
                                        markedSeasons: seriesProgress.markedSeasons || 0,
                                        markedEpisodes: seriesProgress.markedEpisodes || 0
                                    });
                                    setShowNotification(true);
                                }
                            } else {
                                console.log('No skipped items. Successfully marked:', {
                                    seasons: seriesProgress.markedSeasons,
                                    episodes: seriesProgress.markedEpisodes
                                });
                            }
                        } else {
                            console.log('No seriesProgress in response');
                        }
                    }
                } else {
                    // Rollback on error
                    if (canOptimisticallyUpdate) {
                        setIsWatched(false);
                        setTimesWatched(0);
                    }
                    const errorData = await response.json().catch(() => ({}));
                    setError(errorData.error || 'Failed to mark as watched. Please try again.');
                }
            } catch (error) {
                console.error('Error toggling watched status:', error);
                // Rollback on error
                if (canOptimisticallyUpdate) {
                    setIsWatched(previousState.isWatched);
                    setTimesWatched(previousState.timesWatched);
                }
                setError('An error occurred. Please try again.');
            } finally {
                setLoading(false);
            }
        }
        
        if (onUpdate) onUpdate();
        // Dispatch custom event to notify profile page
        window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
    };

    const handleIncrement = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/watched', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, mediaType }),
            });
            if (response.ok) {
                const { watched } = await response.json();
                setTimesWatched(watched.times_watched);
                setIsWatched(true);
            }
            if (onUpdate) onUpdate();
            // Dispatch custom event to notify profile page
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
        } catch (error) {
            console.error('Error incrementing watched count:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleToggle}
                        disabled={loading}
                        className={`futuristic-button flex items-center gap-2 ${
                            isWatched 
                                ? 'bg-amber-500 hover:bg-amber-400 text-black' 
                                : ''
                        } ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>{mediaType === 'tv' ? 'Processing...' : 'Processing...'}</span>
                            </>
                        ) : isWatched ? (
                            <>
                                <span>✓</span>
                                <span>Watched</span>
                            </>
                        ) : (
                            <>
                                <span>+</span>
                                <span>Mark as Watched</span>
                            </>
                        )}
                    </button>
                    {isWatched && !loading && (
                        <div className="flex items-center gap-2">
                            <span className="text-amber-400 font-semibold">
                                {timesWatched}x
                            </span>
                            <button
                                onClick={handleIncrement}
                                disabled={loading}
                                className="futuristic-button-yellow text-sm px-3 py-1"
                                title="Increment watch count"
                            >
                                +1
                            </button>
                        </div>
                    )}
                </div>
                {error && (
                    <div className="text-red-400 text-sm flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="ml-auto text-white/70 hover:text-white"
                        >
                            ×
                        </button>
                    </div>
                )}
            </div>
            <UnreleasedNotification
                isOpen={showNotification}
                onClose={() => {
                    setShowNotification(false);
                    setSeriesSummary(null);
                }}
                skippedItems={skippedItems}
                summary={seriesSummary}
            />
        </>
    );
}

