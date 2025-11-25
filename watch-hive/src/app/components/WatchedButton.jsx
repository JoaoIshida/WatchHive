"use client";
import { useState, useEffect } from 'react';
import { watchedStorage, seriesProgressStorage } from '../lib/localStorage';

export default function WatchedButton({ itemId, mediaType, onUpdate, seasons = null }) {
    const [isWatched, setIsWatched] = useState(false);
    const [timesWatched, setTimesWatched] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Check if item is watched
        const watched = watchedStorage.isWatched(String(itemId), mediaType);
        setIsWatched(watched);
        if (watched) {
            setTimesWatched(watchedStorage.getTimesWatched(String(itemId), mediaType));
        }
    }, [itemId, mediaType]);

    const handleToggle = async () => {
        setLoading(true);
        try {
            if (isWatched) {
                // Remove from watched
                watchedStorage.remove(String(itemId), mediaType);
                setIsWatched(false);
                setTimesWatched(0);
                
                // If it's a series, also unmark series completion (but keep episode progress)
                if (mediaType === 'tv') {
                    seriesProgressStorage.markSeriesCompleted(String(itemId), false);
                }
            } else {
                // Add to watched
                watchedStorage.add(String(itemId), mediaType);
                setIsWatched(true);
                setTimesWatched(1);
                
                // If it's a series, automatically mark all episodes as watched
                if (mediaType === 'tv' && seasons && seasons.length > 0) {
                    // Fetch all seasons data and mark all episodes as watched
                    const allSeasonsData = {};
                    
                    const seasonPromises = seasons.map(async (season) => {
                        try {
                            // Try to fetch season details to get episodes
                            const response = await fetch(`/api/tv/${itemId}/season/${season.season_number}`);
                            if (response.ok) {
                                const data = await response.json();
                                return {
                                    seasonNumber: season.season_number,
                                    data: data
                                };
                            }
                        } catch (error) {
                            console.error(`Error fetching season ${season.season_number}:`, error);
                        }
                        return null;
                    });
                    
                    const seasonResults = await Promise.all(seasonPromises);
                    seasonResults.forEach(result => {
                        if (result && result.data) {
                            allSeasonsData[result.seasonNumber] = result.data;
                        }
                    });
                    
                    // Mark series as completed with all episodes
                    if (Object.keys(allSeasonsData).length > 0) {
                        seriesProgressStorage.markSeriesCompleted(String(itemId), true, allSeasonsData);
                    } else {
                        // Fallback: just mark as completed even if we couldn't fetch episodes
                        seriesProgressStorage.markSeriesCompleted(String(itemId), true);
                    }
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

    const handleIncrement = () => {
        setLoading(true);
        try {
            watchedStorage.add(String(itemId), mediaType);
            setTimesWatched(prev => prev + 1);
            setIsWatched(true);
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
    );
}

