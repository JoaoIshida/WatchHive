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
    }, [itemId, mediaType, user]);

    const handleToggle = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        setLoading(true);
        try {

            if (isWatched) {
                // Remove from watched via API
                const response = await fetch(`/api/watched?itemId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setIsWatched(false);
                    setTimesWatched(0);
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
                        setLoading(false);
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
                        setLoading(false);
                        return;
                    }
                }

                // Mark as watched via API (backend will handle series progress syncing)
                const response = await fetch('/api/watched', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
                if (response.ok) {
                    const { watched } = await response.json();
                    setIsWatched(true);
                    setTimesWatched(watched?.times_watched || 1);
                }
            }
            if (onUpdate) onUpdate();
            // Dispatch custom event to notify profile page
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
        } catch (error) {
            console.error('Error toggling watched status:', error);
        } finally {
            setLoading(false);
        }
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
            <div className="flex items-center gap-2">
                <button
                    onClick={handleToggle}
                    disabled={loading}
                    className={`futuristic-button flex items-center gap-2 ${
                        isWatched 
                            ? 'bg-futuristic-yellow-500 hover:bg-futuristic-yellow-400 text-black' 
                            : ''
                    }`}
                >
                    {isWatched ? (
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
                {isWatched && (
                    <div className="flex items-center gap-2">
                        <span className="text-futuristic-yellow-400 font-semibold">
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
            <UnreleasedNotification
                isOpen={showNotification}
                onClose={() => setShowNotification(false)}
                skippedItems={skippedItems}
            />
        </>
    );
}

