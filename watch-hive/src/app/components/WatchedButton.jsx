"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import { isMovieReleased, isSeriesReleased } from '../utils/releaseDateValidator';
import { formatDate } from '../utils/dateFormatter';
import UnreleasedNotification from './UnreleasedNotification';

export default function WatchedButton({ itemId, mediaType, onUpdate, seasons = null, itemData = null }) {
    const { user } = useAuth();
    const { watched, seriesProgress, refreshUserData } = useUserData();
    const [loading, setLoading] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [skippedItems, setSkippedItems] = useState([]);
    const [error, setError] = useState(null);
    const [seriesSummary, setSeriesSummary] = useState(null);

    // Derive watched state from context
    const watchedItem = user
        ? watched.find(w => w.content_id === itemId && w.media_type === mediaType)
        : null;
    const isWatched = !!watchedItem;
    const timesWatched = watchedItem?.times_watched || 0;

    const handleToggle = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        setError(null);

        if (isWatched) {
            setLoading(true);
            
            try {
                const response = await fetch(`/api/watched?itemId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
                
                if (!response.ok) {
                    setError('Failed to remove from watched. Please try again.');
                }
                refreshUserData();
            } catch (error) {
                console.error('Error removing watched status:', error);
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
                    return;
                }
            } else if (mediaType === 'tv') {
                if (itemData && !isSeriesReleased(itemData)) {
                    setSkippedItems([{
                        type: 'series',
                        name: itemData.name,
                        releaseDate: formatDate(itemData.first_air_date)
                    }]);
                    setShowNotification(true);
                    return;
                }
            }

            setLoading(true);
            try {
                const response = await fetch('/api/watched', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (mediaType === 'tv' && data.seriesProgress) {
                        const skipped = [];
                        
                        if (data.seriesProgress.skippedSeasons?.length) {
                            data.seriesProgress.skippedSeasons.forEach(season => {
                                skipped.push({
                                    type: 'season',
                                    seriesName: itemData?.name || 'Series',
                                    seasonName: season.seasonName || `Season ${season.seasonNumber}`,
                                    releaseDate: formatDate(season.releaseDate)
                                });
                            });
                        }
                        
                        if (data.seriesProgress.skippedEpisodes?.length) {
                            data.seriesProgress.skippedEpisodes.forEach(ep => {
                                skipped.push({
                                    type: 'episode',
                                    seriesName: itemData?.name || 'Series',
                                    seasonName: ep.seasonName || `Season ${ep.seasonNumber}`,
                                    episodeName: ep.episodeName || `Episode ${ep.episodeNumber}`,
                                    releaseDate: formatDate(ep.releaseDate)
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
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    setError(errorData.error || 'Failed to mark as watched. Please try again.');
                }
                refreshUserData();
            } catch (error) {
                console.error('Error toggling watched status:', error);
                setError('An error occurred. Please try again.');
            } finally {
                setLoading(false);
            }
        }
        
        if (onUpdate) onUpdate();
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
                refreshUserData();
            }
            if (onUpdate) onUpdate();
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
                                <span>Processing...</span>
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
