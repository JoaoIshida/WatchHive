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

                // If it's a series, check all seasons first before marking as watched
                if (mediaType === 'tv' && seasons && seasons.length > 0) {
                    // Fetch all seasons data and check for unreleased content
                    const allSeasonsData = {};
                    const skipped = [];
                    
                    const seasonPromises = seasons.map(async (season) => {
                        try {
                            // Check if season is released
                            if (isSeasonReleased(season)) {
                                // Try to fetch season details to get episodes
                                const response = await fetch(`/api/tv/${itemId}/season/${season.season_number}`);
                                if (response.ok) {
                                    const data = await response.json();
                                    return {
                                        seasonNumber: season.season_number,
                                        data: data,
                                        season: season
                                    };
                                }
                            } else {
                                skipped.push({
                                    type: 'season',
                                    seriesName: itemData?.name || 'Series',
                                    seasonName: season.name || `Season ${season.season_number}`,
                                    releaseDate: formatDate(season.air_date)
                                });
                            }
                        } catch (error) {
                            console.error(`Error fetching season ${season.season_number}:`, error);
                        }
                        return null;
                    });
                    
                    const seasonResults = await Promise.all(seasonPromises);
                    seasonResults.forEach(result => {
                        if (result && result.data) {
                            // Filter out unreleased episodes
                            const releasedEpisodes = result.data.episodes?.filter(ep => isEpisodeReleased(ep)) || [];
                            const unreleasedEpisodes = result.data.episodes?.filter(ep => !isEpisodeReleased(ep)) || [];
                            
                            // Add unreleased episodes to skipped list
                            unreleasedEpisodes.forEach(ep => {
                                skipped.push({
                                    type: 'episode',
                                    seriesName: itemData?.name || 'Series',
                                    seasonName: result.season.name || `Season ${result.seasonNumber}`,
                                    episodeName: ep.name || `Episode ${ep.episode_number}`,
                                    releaseDate: formatDate(ep.air_date)
                                });
                            });
                            
                            // Only include released episodes in the data
                            if (releasedEpisodes.length > 0) {
                                allSeasonsData[result.seasonNumber] = {
                                    ...result.data,
                                    episodes: releasedEpisodes
                                };
                            }
                        }
                    });
                    
                    // Check if there are any released seasons/episodes to mark
                    const hasReleasedContent = Object.keys(allSeasonsData).length > 0;
                    
                    // Show notification if any items were skipped
                    if (skipped.length > 0) {
                        setSkippedItems(skipped);
                        setShowNotification(true);
                    }
                    
                    // Mark the series as watched via API
                    const watchedResponse = await fetch('/api/watched', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ itemId, mediaType }),
                    });
                    if (watchedResponse.ok) {
                        setIsWatched(true);
                        setTimesWatched(1);
                    }
                    
                    // Mark series progress (episodes/seasons) if there's released content
                    if (hasReleasedContent) {
                        await fetch(`/api/series-progress/${itemId}/complete`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                completed: true,
                                seasonsData: allSeasonsData,
                            }),
                        });
                    }
                } else {
                    // For movies or series without seasons, just mark as watched via API
                    const response = await fetch('/api/watched', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ itemId, mediaType }),
                    });
                    if (response.ok) {
                        setIsWatched(true);
                        setTimesWatched(1);
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

