"use client";
import { useState, useEffect } from 'react';
import { seriesProgressStorage } from '../lib/localStorage';
import ImageWithFallback from './ImageWithFallback';

const SeriesSeasons = ({ seriesId, seasons }) => {
    const [expandedSeasons, setExpandedSeasons] = useState({});
    const [seasonDetails, setSeasonDetails] = useState({});
    const [progress, setProgress] = useState({});

    useEffect(() => {
        // Load progress from localStorage
        const seriesProgress = seriesProgressStorage.getSeriesProgress(seriesId);
        setProgress(seriesProgress);
    }, [seriesId]);

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

    const toggleEpisodeWatched = (seasonNumber, episodeNumber) => {
        const isWatched = seriesProgressStorage.isEpisodeWatched(seriesId, seasonNumber, episodeNumber);
        
        if (isWatched) {
            seriesProgressStorage.markEpisodeUnwatched(seriesId, seasonNumber, episodeNumber);
        } else {
            seriesProgressStorage.markEpisodeWatched(seriesId, seasonNumber, episodeNumber);
        }
        
        // Reload progress
        const updatedProgress = seriesProgressStorage.getSeriesProgress(seriesId);
        setProgress(updatedProgress);
        // Dispatch custom event to notify profile page
        window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
    };

    const toggleSeasonCompleted = async (seasonNumber) => {
        const isCompleted = seriesProgressStorage.isSeasonCompleted(seriesId, seasonNumber);
        
        // If marking as completed, fetch all episodes to mark them as watched
        let allEpisodes = [];
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
            } catch (error) {
                console.error('Error fetching season episodes:', error);
            }
        }
        
        seriesProgressStorage.markSeasonCompleted(seriesId, seasonNumber, !isCompleted, allEpisodes);
        
        // Reload progress
        const updatedProgress = seriesProgressStorage.getSeriesProgress(seriesId);
        setProgress(updatedProgress);
        // Dispatch custom event to notify profile page
        window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
    };

    const toggleSeriesCompleted = async () => {
        const isCompleted = seriesProgressStorage.isSeriesCompleted(seriesId);
        
        // If marking as completed, fetch all seasons and episodes to mark them as watched
        let allSeasonsData = {};
        if (!isCompleted) {
            // Fetch all seasons data
            const seasonPromises = seasons.map(async (season) => {
                try {
                    // Try to get from already loaded season details
                    if (seasonDetails[season.season_number] && seasonDetails[season.season_number].episodes) {
                        return {
                            seasonNumber: season.season_number,
                            data: seasonDetails[season.season_number]
                        };
                    }
                    
                    // Fetch from API
                    const response = await fetch(`/api/tv/${seriesId}/season/${season.season_number}`);
                    if (response.ok) {
                        const data = await response.json();
                        setSeasonDetails(prev => ({ ...prev, [season.season_number]: data }));
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
        }
        
        seriesProgressStorage.markSeriesCompleted(seriesId, !isCompleted, allSeasonsData);
        
        // Reload progress
        const updatedProgress = seriesProgressStorage.getSeriesProgress(seriesId);
        setProgress(updatedProgress);
        // Dispatch custom event to notify profile page
        window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
    };

    const getSeasonProgress = (seasonNumber) => {
        const season = seasonDetails[seasonNumber] || seasons.find(s => s.season_number === seasonNumber);
        
        // If season is marked as completed, all episodes are considered watched
        const isSeasonCompleted = seriesProgressStorage.isSeasonCompleted(seriesId, seasonNumber);
        
        if (!season) {
            // For upcoming seasons, use episode_count if available
            const seasonFromList = seasons.find(s => s.season_number === seasonNumber);
            if (seasonFromList && seasonFromList.episode_count) {
                return { 
                    watched: isSeasonCompleted ? seasonFromList.episode_count : 0, 
                    total: seasonFromList.episode_count 
                };
            }
            return { watched: 0, total: 0 };
        }
        
        // If season has episodes data
        if (season.episodes && season.episodes.length > 0) {
            const total = season.episodes.length;
            // If season is completed, all episodes are watched
            const watched = isSeasonCompleted ? total : season.episodes.filter(ep => 
                seriesProgressStorage.isEpisodeWatched(seriesId, seasonNumber, ep.episode_number)
            ).length;
            return { watched, total };
        }
        
        // Fallback: use episode_count if available
        if (season.episode_count) {
            return { 
                watched: isSeasonCompleted ? season.episode_count : 0, 
                total: season.episode_count 
            };
        }
        
        return { watched: 0, total: 0 };
    };

    const getOverallProgress = () => {
        let totalEpisodes = 0;
        let watchedEpisodes = 0;
        
        // Check if series is completed - if so, all episodes are watched
        const isSeriesCompleted = seriesProgressStorage.isSeriesCompleted(seriesId);
        
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
    const isSeriesCompleted = seriesProgressStorage.isSeriesCompleted(seriesId);

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
                    const isSeasonCompleted = seriesProgressStorage.isSeasonCompleted(seriesId, season.season_number);
                    const seasonData = seasonDetails[season.season_number] || season;
                    
                    return (
                        <div key={season.id} className="futuristic-card p-4">
                            <div 
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => toggleSeason(season.season_number)}
                            >
                                <div className="flex items-center gap-4">
                                    {seasonData.poster_path && (
                                        <ImageWithFallback
                                            src={`https://image.tmdb.org/t/p/w200${seasonData.poster_path}`}
                                            alt={`Season ${season.season_number}`}
                                            className="w-20 h-28 object-cover rounded"
                                        />
                                    )}
                                    <div>
                                        <h3 className="text-lg font-bold text-white">
                                            {season.name || `Season ${season.season_number}`}
                                        </h3>
                                        {seasonData.air_date && (
                                            <p className="text-sm text-futuristic-yellow-400/80">
                                                {new Date(seasonData.air_date).toLocaleDateString('en-US', { 
                                                    year: 'numeric', 
                                                    month: 'long', 
                                                    day: 'numeric' 
                                                })}
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
                                        const isSeasonCompleted = seriesProgressStorage.isSeasonCompleted(seriesId, season.season_number);
                                        const isWatched = isSeasonCompleted || seriesProgressStorage.isEpisodeWatched(
                                            seriesId, 
                                            season.season_number, 
                                            episode.episode_number
                                        );
                                        
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
                                                {episode.still_path && (
                                                    <ImageWithFallback
                                                        src={`https://image.tmdb.org/t/w300${episode.still_path}`}
                                                        alt={episode.name}
                                                        className="w-24 h-16 object-cover rounded"
                                                    />
                                                )}
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
                                                            {new Date(episode.air_date).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                    {episode.overview && (
                                                        <p className="text-xs text-white/70 line-clamp-2 mt-1">
                                                            {episode.overview}
                                                        </p>
                                                    )}
                                                </div>
                                                {episode.vote_average && (
                                                    <div className="text-xs text-futuristic-yellow-400">
                                                        ⭐ {episode.vote_average.toFixed(1)}
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
        </div>
    );
};

export default SeriesSeasons;

