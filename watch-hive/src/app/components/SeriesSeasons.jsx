"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isSeasonReleased, isEpisodeReleased } from '../utils/releaseDateValidator';
import { formatDate } from '../utils/dateFormatter';
import ImageWithFallback from './ImageWithFallback';
import UnreleasedNotification from './UnreleasedNotification';

const SeriesSeasons = ({ seriesId, seasons, seriesName = 'Series' }) => {
    const { user } = useAuth();
    const [expandedSeasons, setExpandedSeasons] = useState({});
    const [seasonDetails, setSeasonDetails] = useState({});
    const [progress, setProgress] = useState({ seasons: {}, completed: false, last_watched: null });
    const [showNotification, setShowNotification] = useState(false);
    const [skippedItems, setSkippedItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load progress from API
        const loadProgress = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {

                const response = await fetch(`/api/series-progress/${seriesId}`);
                if (response.ok) {
                    const data = await response.json();
                    setProgress(data);
                }
            } catch (error) {
                console.error('Error loading series progress:', error);
            } finally {
                setLoading(false);
            }
        };
        loadProgress();
    }, [seriesId, user]);

    const toggleSeason = async (seasonNumber) => {
        if (expandedSeasons[seasonNumber]) {
            setExpandedSeasons(prev => ({ ...prev, [seasonNumber]: false }));
        } else {
            setExpandedSeasons(prev => ({ ...prev, [seasonNumber]: true }));
            
            // Fetch season details if not already loaded
            if (!seasonDetails[seasonNumber]) {
                try {
                    const response = await fetch(`/api/tv/${seriesId}/season/${seasonNumber}`);
                    if (response.ok) {
                        const data = await response.json();
                        setSeasonDetails(prev => ({ ...prev, [seasonNumber]: data }));
                    }
                } catch (error) {
                    console.error('Error fetching season details:', error);
                    // Fallback: use season data from series details if available
                    const seasonFromSeries = seasons.find(s => s.season_number === seasonNumber);
                    if (seasonFromSeries) {
                        setSeasonDetails(prev => ({ ...prev, [seasonNumber]: seasonFromSeries }));
                    }
                }
            }
        }
    };

    const toggleEpisodeWatched = async (seasonNumber, episodeNumber) => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        const isSeasonCompleted = progress.seasons[seasonNumber]?.completed || false;
        const isEpisodeInList = progress.seasons[seasonNumber]?.episodes?.includes(episodeNumber) || false;
        const isWatched = isSeasonCompleted || isEpisodeInList;
        
        // Check if episode is released (only when marking as watched)
        if (!isWatched) {
            const seasonData = seasonDetails[seasonNumber] || seasons.find(s => s.season_number === seasonNumber);
            const episode = seasonData?.episodes?.find(ep => ep.episode_number === episodeNumber);
            
            if (episode && !isEpisodeReleased(episode)) {
                setSkippedItems([{
                    type: 'episode',
                    seriesName: seriesName,
                    seasonName: seasonData?.name || `Season ${seasonNumber}`,
                    episodeName: episode.name || `Episode ${episodeNumber}`,
                    releaseDate: formatDate(episode.air_date)
                }]);
                setShowNotification(true);
                return;
            }
        }

        // If season is completed and we're unmarking an episode, unmark season first
        if (isWatched && isSeasonCompleted) {
            await fetch(`/api/series-progress/${seriesId}/seasons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seasonNumber, completed: false }),
            });
        }

        // Update episode via API
        const response = await fetch(`/api/series-progress/${seriesId}/episodes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seasonNumber,
                episodeNumber,
                watched: !isWatched,
            }),
        });

        if (response.ok) {
            // Reload progress
            const progressResponse = await fetch(`/api/series-progress/${seriesId}`);
            if (progressResponse.ok) {
                const data = await progressResponse.json();
                setProgress(data);
            }
            // Dispatch custom event to notify profile page
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
        }
    };

    const toggleSeasonCompleted = async (seasonNumber) => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        const isCompleted = progress.seasons[seasonNumber]?.completed || false;
        
        // Check if season is released
        const season = seasons.find(s => s.season_number === seasonNumber);
        if (!isCompleted && season && !isSeasonReleased(season)) {
            setSkippedItems([{
                type: 'season',
                seriesName: 'Series',
                seasonName: season.name || `Season ${seasonNumber}`,
                releaseDate: formatDate(season.air_date)
            }]);
            setShowNotification(true);
            return;
        }
        
        // If marking as completed, fetch all episodes to mark them as watched
        let allEpisodes = [];
        const skipped = [];
        if (!isCompleted) {
            // Fetch season details to get all episodes
            try {
                const seasonData = seasonDetails[seasonNumber] || seasons.find(s => s.season_number === seasonNumber);
                if (seasonData && seasonData.episodes) {
                    allEpisodes = seasonData.episodes;
                } else {
                    // Try to fetch from API
                    const response = await fetch(`/api/tv/${seriesId}/season/${seasonNumber}`);
                    if (response.ok) {
                        const data = await response.json();
                        allEpisodes = data.episodes || [];
                        setSeasonDetails(prev => ({ ...prev, [seasonNumber]: data }));
                    }
                }
                
                // Filter out unreleased episodes
                const releasedEpisodes = allEpisodes.filter(ep => isEpisodeReleased(ep));
                const unreleasedEpisodes = allEpisodes.filter(ep => !isEpisodeReleased(ep));
                
                unreleasedEpisodes.forEach(ep => {
                    skipped.push({
                        type: 'episode',
                        seriesName: seriesName,
                        seasonName: seasonData?.name || `Season ${seasonNumber}`,
                        episodeName: ep.name || `Episode ${ep.episode_number}`,
                        releaseDate: formatDate(ep.air_date)
                    });
                });
                
                allEpisodes = releasedEpisodes;
                
                // If all episodes are unreleased, don't mark season as complete
                if (releasedEpisodes.length === 0 && unreleasedEpisodes.length > 0) {
                    setSkippedItems(skipped);
                    setShowNotification(true);
                    return; // Don't mark as complete
                }
            } catch (error) {
                console.error('Error fetching season episodes:', error);
            }
        }
        
        // If there are ANY unreleased episodes, don't mark season as complete
        if (skipped.length > 0) {
            setSkippedItems(skipped);
            setShowNotification(true);
            // Don't mark season as complete if there are unreleased episodes
            // Only mark released episodes individually
            if (allEpisodes.length > 0) {
                // Mark only released episodes individually via API
                for (const ep of allEpisodes) {
                    await fetch(`/api/series-progress/${seriesId}/episodes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            seasonNumber,
                            episodeNumber: ep.episode_number,
                            watched: true,
                        }),
                    });
                }
            }
            // Reload progress
            const progressResponse = await fetch(`/api/series-progress/${seriesId}`);
            if (progressResponse.ok) {
                const data = await progressResponse.json();
                setProgress(data);
            }
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
            return;
        }
        
        // Only mark as complete if ALL episodes are released (no skipped items)
        const episodeNumbers = allEpisodes.map(ep => ep.episode_number || ep);
        const response = await fetch(`/api/series-progress/${seriesId}/seasons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seasonNumber,
                completed: !isCompleted,
                episodes: episodeNumbers,
            }),
        });

        if (response.ok) {
            // Reload progress
            const progressResponse = await fetch(`/api/series-progress/${seriesId}`);
            if (progressResponse.ok) {
                const data = await progressResponse.json();
                setProgress(data);
            }
            // Dispatch custom event to notify profile page
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
        }
    };

    const toggleSeriesCompleted = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        const isCompleted = progress.completed || false;
        
        // If marking as completed, fetch all seasons and episodes to mark them as watched
        let allSeasonsData = {};
        const skipped = [];
        if (!isCompleted) {
            // Fetch all seasons data
            const seasonPromises = seasons.map(async (season) => {
                try {
                    // Check if season is released
                    if (!isSeasonReleased(season)) {
                        skipped.push({
                            type: 'season',
                            seriesName: seriesName,
                            seasonName: season.name || `Season ${season.season_number}`,
                            releaseDate: formatDate(season.air_date)
                        });
                        return null;
                    }
                    
                    // Try to get from already loaded season details
                    if (seasonDetails[season.season_number] && seasonDetails[season.season_number].episodes) {
                        const seasonData = seasonDetails[season.season_number];
                        // Filter unreleased episodes
                        const releasedEpisodes = seasonData.episodes.filter(ep => isEpisodeReleased(ep));
                        const unreleasedEpisodes = seasonData.episodes.filter(ep => !isEpisodeReleased(ep));
                        
                        unreleasedEpisodes.forEach(ep => {
                            skipped.push({
                                type: 'episode',
                                seriesName: seriesName,
                                seasonName: season.name || `Season ${season.season_number}`,
                                episodeName: ep.name || `Episode ${ep.episode_number}`,
                                releaseDate: formatDate(ep.air_date)
                            });
                        });
                        
                        return {
                            seasonNumber: season.season_number,
                            data: { ...seasonData, episodes: releasedEpisodes }
                        };
                    }
                    
                    // Fetch from API
                    const response = await fetch(`/api/tv/${seriesId}/season/${season.season_number}`);
                    if (response.ok) {
                        const data = await response.json();
                        setSeasonDetails(prev => ({ ...prev, [season.season_number]: data }));
                        
                        // Filter unreleased episodes
                        const releasedEpisodes = (data.episodes || []).filter(ep => isEpisodeReleased(ep));
                        const unreleasedEpisodes = (data.episodes || []).filter(ep => !isEpisodeReleased(ep));
                        
                        unreleasedEpisodes.forEach(ep => {
                            skipped.push({
                                type: 'episode',
                                seriesName: seriesName,
                                seasonName: season.name || `Season ${season.season_number}`,
                                episodeName: ep.name || `Episode ${ep.episode_number}`,
                                releaseDate: formatDate(ep.air_date)
                            });
                        });
                        
                        return {
                            seasonNumber: season.season_number,
                            data: { ...data, episodes: releasedEpisodes }
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
        }
        
        // Check if there are any released seasons/episodes to mark
        const hasReleasedContent = Object.keys(allSeasonsData).length > 0;
        
        // If there are ANY unreleased items, don't mark the series as complete
        if (skipped.length > 0) {
            setSkippedItems(skipped);
            setShowNotification(true);
            // Don't mark series as complete if there's unreleased content
            // Only mark individual released seasons/episodes
            if (hasReleasedContent) {
                // Mark only released episodes individually via API
                for (const [seasonNum, seasonData] of Object.entries(allSeasonsData)) {
                    if (seasonData.episodes && seasonData.episodes.length > 0) {
                        for (const ep of seasonData.episodes) {
                            await fetch(`/api/series-progress/${seriesId}/episodes`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    seasonNumber: parseInt(seasonNum),
                                    episodeNumber: ep.episode_number,
                                    watched: true,
                                }),
                            });
                        }
                    }
                }
            }
            // Reload progress
            const progressResponse = await fetch(`/api/series-progress/${seriesId}`);
            if (progressResponse.ok) {
                const data = await progressResponse.json();
                setProgress(data);
            }
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
            return;
        }
        
        // Only mark as complete if ALL content is released (no skipped items) or if unmarking
        const response = await fetch(`/api/series-progress/${seriesId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                completed: !isCompleted,
                seasonsData: allSeasonsData,
            }),
        });

        if (response.ok) {
            // Reload progress
            const progressResponse = await fetch(`/api/series-progress/${seriesId}`);
            if (progressResponse.ok) {
                const data = await progressResponse.json();
                setProgress(data);
            }
            // Dispatch custom event to notify profile page
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
        }
    };

    const getSeasonProgress = (seasonNumber) => {
        const season = seasonDetails[seasonNumber] || seasons.find(s => s.season_number === seasonNumber);
        
        // If season is marked as completed, all episodes are considered watched
        const isSeasonCompleted = progress.seasons[seasonNumber]?.completed || false;
        const watchedEpisodes = progress.seasons[seasonNumber]?.episodes || [];
        
        if (!season) {
            // For upcoming seasons, use episode_count if available
            const seasonFromList = seasons.find(s => s.season_number === seasonNumber);
            if (seasonFromList && seasonFromList.episode_count) {
                return { 
                    watched: isSeasonCompleted ? seasonFromList.episode_count : watchedEpisodes.length, 
                    total: seasonFromList.episode_count 
                };
            }
            return { watched: watchedEpisodes.length, total: 0 };
        }
        
        // If season has episodes data
        if (season.episodes && season.episodes.length > 0) {
            const total = season.episodes.length;
            // If season is completed, all episodes are watched
            const watched = isSeasonCompleted ? total : watchedEpisodes.length;
            return { watched, total };
        }
        
        // Fallback: use episode_count if available
        if (season.episode_count) {
            return { 
                watched: isSeasonCompleted ? season.episode_count : watchedEpisodes.length, 
                total: season.episode_count 
            };
        }
        
        return { watched: watchedEpisodes.length, total: 0 };
    };

    const getOverallProgress = () => {
        let totalEpisodes = 0;
        let watchedEpisodes = 0;
        
        // Check if series is completed - if so, all episodes are watched
        const isSeriesCompleted = progress.completed || false;
        
        seasons.forEach(season => {
            const seasonProgress = getSeasonProgress(season.season_number);
            totalEpisodes += seasonProgress.total;
            watchedEpisodes += seasonProgress.watched;
        });
        
        // If series is completed, all episodes are watched
        if (isSeriesCompleted && totalEpisodes > 0) {
            watchedEpisodes = totalEpisodes;
        }
        
        return { watched: watchedEpisodes, total: totalEpisodes };
    };

    const overallProgress = getOverallProgress();
    const isSeriesCompleted = progress.completed || false;

    return (
        <div className="futuristic-card p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-futuristic-yellow-400 futuristic-text-glow-yellow">
                    Seasons & Episodes
                </h2>
                <div className="flex items-center gap-4">
                    <div className="text-white">
                        <span className="font-semibold">{overallProgress.watched}</span> / {overallProgress.total} episodes watched
                    </div>
                    <button
                        onClick={toggleSeriesCompleted}
                        className={`futuristic-button ${isSeriesCompleted ? 'bg-futuristic-yellow-500 text-black' : ''}`}
                    >
                        {isSeriesCompleted ? '✓ Series Completed' : 'Mark Series Complete'}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {seasons.map((season) => {
                    const seasonProgress = getSeasonProgress(season.season_number);
                    const isExpanded = expandedSeasons[season.season_number];
                    const isSeasonCompleted = progress.seasons[season.season_number]?.completed || false;
                    const seasonData = seasonDetails[season.season_number] || season;
                    
                    return (
                        <div key={season.id} className="futuristic-card p-4">
                            <div 
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => toggleSeason(season.season_number)}
                            >
                                <div className="flex items-center gap-4">
                                    <ImageWithFallback
                                        src={seasonData.poster_path ? `https://image.tmdb.org/t/p/w200${seasonData.poster_path}` : null}
                                        alt={`Season ${season.season_number}`}
                                        className="w-20 h-28 object-cover rounded"
                                    />
                                    <div>
                                        <h3 className="text-lg font-bold text-white">
                                            {season.name || `Season ${season.season_number}`}
                                        </h3>
                                        {seasonData.air_date && (
                                            <p className="text-sm text-futuristic-yellow-400/80">
                                                {formatDate(seasonData.air_date)}
                                            </p>
                                        )}
                                        {seasonData.episode_count && (
                                            <p className="text-sm text-white/70">
                                                {seasonData.episode_count} episodes
                                            </p>
                                        )}
                                        <div className="mt-2">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-futuristic-blue-800 rounded-full h-2">
                                                    <div 
                                                        className="bg-futuristic-yellow-500 h-2 rounded-full transition-all"
                                                        style={{ 
                                                            width: `${seasonProgress.total > 0 ? (seasonProgress.watched / seasonProgress.total) * 100 : 0}%` 
                                                        }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs text-white">
                                                    {seasonProgress.watched}/{seasonProgress.total}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSeasonCompleted(season.season_number);
                                        }}
                                        className={`futuristic-button text-sm ${isSeasonCompleted ? 'bg-futuristic-yellow-500 text-black' : ''}`}
                                    >
                                        {isSeasonCompleted ? '✓ Complete' : 'Mark Complete'}
                                    </button>
                                    <svg
                                        className={`w-6 h-6 text-futuristic-yellow-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            {isExpanded && seasonData.episodes && (
                                <div className="mt-4 space-y-2">
                                    {seasonData.episodes.map((episode) => {
                                        // If season is completed, all episodes are watched
                                        const isSeasonCompleted = progress.seasons[season.season_number]?.completed || false;
                                        const watchedEpisodes = progress.seasons[season.season_number]?.episodes || [];
                                        const isWatched = isSeasonCompleted || watchedEpisodes.includes(episode.episode_number);
                                        
                                        return (
                                            <div
                                                key={episode.id}
                                                className={`futuristic-card p-3 flex items-center gap-4 cursor-pointer hover:bg-futuristic-blue-800 transition-colors ${
                                                    isWatched ? 'border-l-4 border-futuristic-yellow-500' : ''
                                                }`}
                                                onClick={() => toggleEpisodeWatched(season.season_number, episode.episode_number)}
                                            >
                                                <div className="flex-shrink-0 w-12 text-center">
                                                    <span className="text-futuristic-yellow-400 font-bold">
                                                        E{episode.episode_number}
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-white">
                                                            {episode.name || `Episode ${episode.episode_number}`}
                                                        </h4>
                                                        {isWatched && (
                                                            <span className="text-futuristic-yellow-500">✓</span>
                                                        )}
                                                    </div>
                                                    {episode.air_date && (
                                                        <p className="text-xs text-futuristic-yellow-400/80">
                                                            {formatDate(episode.air_date)}
                                                        </p>
                                                    )}
                                                    {episode.overview && (
                                                        <p className="text-xs text-white/70 line-clamp-2 mt-1">
                                                            {episode.overview}
                                                        </p>
                                                    )}
                                                </div>
                                                {episode.vote_average && episode.vote_average > 0 ? (
                                                    <div className="text-xs text-futuristic-yellow-400">
                                                        ⭐ {episode.vote_average.toFixed(1)}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-white/60">
                                                        No ratings
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <UnreleasedNotification
                isOpen={showNotification}
                onClose={() => setShowNotification(false)}
                skippedItems={skippedItems}
            />
        </div>
    );
};

export default SeriesSeasons;

