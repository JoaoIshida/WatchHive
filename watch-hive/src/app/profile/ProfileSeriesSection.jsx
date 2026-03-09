"use client";
import { ChevronDown } from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';
import { isEpisodeReleased } from '../utils/releaseDateValidator';
import { calculateSeriesProgress, calculateSeasonProgress } from '../utils/seriesProgressCalculator';

export default function ProfileSeriesSection({
    seriesProgress,
    seriesDetails,
    expandedSeries,
    setExpandedSeries,
    seriesSeasonDetails,
    setSeriesSeasonDetails,
}) {
    if (Object.keys(seriesProgress).length === 0) {
        return (
            <div>
                <div className="text-center py-12 futuristic-card">
                    <p className="text-xl text-white mb-2">No series in progress</p>
                    <p className="text-amber-500/80">Start watching a series and track your progress!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {Object.entries(seriesProgress).map(([seriesId, progress]) => {
                const seriesInfo = seriesDetails[seriesId];
                const isExpanded = expandedSeries[seriesId];

                const totalSeasonsFromTMDB = seriesInfo?.seasons?.filter(s => s.season_number > 0).length || 0;
                const watchedSeasonsCount = Object.keys(progress.seasons || {}).filter(seasonNum => parseInt(seasonNum) > 0).length;
                const totalSeasons = totalSeasonsFromTMDB > 0 ? totalSeasonsFromTMDB : watchedSeasonsCount;
                const specialsCount = seriesInfo?.seasons?.filter(s => s.season_number === 0).length || 0;
                const watchedSpecialsCount = Object.keys(progress.seasons || {}).filter(seasonNum => parseInt(seasonNum) === 0).length;
                const completedSeasons = Object.values(progress.seasons || {}).filter(season => season.completed).length;
                const totalEpisodesWatched = Object.entries(progress.seasons || {})
                    .filter(([seasonNum]) => parseInt(seasonNum) > 0)
                    .reduce((total, [, season]) => total + (season.episodes?.length || 0), 0);

                const getSeriesOverallProgress = () => {
                    return calculateSeriesProgress(progress, seriesInfo?.seasons, seriesSeasonDetails[seriesId]);
                };
                const overallProgress = getSeriesOverallProgress();

                const toggleSeries = async () => {
                    if (isExpanded) {
                        setExpandedSeries(prev => ({ ...prev, [seriesId]: false }));
                    } else {
                        setExpandedSeries(prev => ({ ...prev, [seriesId]: true }));
                        if (seriesInfo?.seasons) {
                            const seasonPromises = Object.keys(progress.seasons || {}).map(async (seasonNum) => {
                                try {
                                    const response = await fetch(`/api/tv/${seriesId}/season/${seasonNum}`);
                                    if (response.ok) {
                                        const data = await response.json();
                                        return { seasonNumber: parseInt(seasonNum), data };
                                    }
                                } catch (error) {
                                    console.error(`Error fetching season ${seasonNum} for series ${seriesId}:`, error);
                                }
                                return null;
                            });
                            const results = await Promise.all(seasonPromises);
                            const seasonDetailsMap = {};
                            results.forEach(result => {
                                if (result) {
                                    if (!seasonDetailsMap[seriesId]) {
                                        seasonDetailsMap[seriesId] = {};
                                    }
                                    seasonDetailsMap[seriesId][result.seasonNumber] = result.data;
                                }
                            });
                            setSeriesSeasonDetails(prev => ({
                                ...prev,
                                ...seasonDetailsMap
                            }));
                        }
                    }
                };

                const getSeasonProgress = (seasonNumber) => {
                    const seasonData = seriesSeasonDetails[seriesId]?.[seasonNumber];
                    return calculateSeasonProgress(parseInt(seasonNumber), progress, seasonData, seriesInfo?.seasons);
                };

                return (
                    <div key={seriesId} className="futuristic-card p-6">
                        <div
                            className="flex items-center justify-between mb-4 cursor-pointer"
                            onClick={toggleSeries}
                        >
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-white">
                                    <a
                                        href={`/series/${seriesId}`}
                                        className="hover:text-amber-500 transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {seriesInfo?.name || (
                                            <span className="text-amber-500/60 animate-pulse">Loading series name...</span>
                                        )}
                                    </a>
                                </h3>
                                <div className="flex items-center gap-4 mt-2">
                                    <p className="text-sm text-amber-500/80">
                                        {watchedSeasonsCount}/{totalSeasons} seasons watched • {completedSeasons} completed • {totalEpisodesWatched} episodes watched
                                        {specialsCount > 0 && (
                                            <span className="ml-2">• {watchedSpecialsCount}/{specialsCount} specials</span>
                                        )}
                                    </p>
                                    {overallProgress.total > 0 && (
                                        <>
                                            <span className="text-sm text-white/60">•</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 bg-charcoal-800 rounded-full h-2">
                                                    <div
                                                        className="bg-amber-500 h-2 rounded-full transition-all"
                                                        style={{ width: `${overallProgress.percentage}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm text-amber-500/80">{overallProgress.percentage}%</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <a
                                    href={`/series/${seriesId}`}
                                    className="futuristic-button text-sm"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    View Series
                                </a>
                                <ChevronDown
                                    className={`w-6 h-6 text-amber-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                />
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="space-y-3 mt-4 border-t border-charcoal-700 pt-4">
                                {Object.entries(progress.seasons || {})
                                    .filter(([seasonNum]) => parseInt(seasonNum) > 0)
                                    .map(([seasonNum, season]) => {
                                        const seasonProgress = getSeasonProgress(parseInt(seasonNum));
                                        const seasonData = seriesSeasonDetails[seriesId]?.[parseInt(seasonNum)];
                                        const watchedEpisodes = season.episodes || [];

                                        return (
                                            <div key={seasonNum} className="bg-charcoal-800/50 p-4 rounded">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-white font-semibold">Season {seasonNum}</span>
                                                        {seasonProgress.total > 0 && (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-20 bg-charcoal-900 rounded-full h-2">
                                                                    <div
                                                                        className="bg-amber-500 h-2 rounded-full transition-all"
                                                                        style={{ width: `${seasonProgress.percentage}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs text-amber-500/80">
                                                                    {seasonProgress.watched}/{seasonProgress.total} ({seasonProgress.percentage}%)
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                        season.completed
                                                            ? 'bg-amber-500 text-black'
                                                            : 'bg-charcoal-800 text-white'
                                                    }`}>
                                                        {season.completed ? 'Completed' : `${watchedEpisodes.length} episodes watched`}
                                                    </span>
                                                </div>

                                                {seasonData && seasonData.episodes && seasonData.episodes.length > 0 ? (
                                                    <div className="mt-3 space-y-1">
                                                        {seasonData.episodes.map((episode) => {
                                                            const episodeIsReleased = isEpisodeReleased(episode, seasonData);
                                                            const isWatched = episodeIsReleased && watchedEpisodes.includes(episode.episode_number);
                                                            const isUpcoming = !episodeIsReleased;
                                                            return (
                                                                <div
                                                                    key={episode.id || episode.episode_number}
                                                                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                                                                        isWatched
                                                                            ? 'bg-amber-500/20 text-amber-400'
                                                                            : isUpcoming
                                                                                ? 'bg-red-500/10 text-red-400/70'
                                                                                : 'bg-charcoal-900/50 text-white/40'
                                                                    }`}
                                                                >
                                                                    <span className="font-semibold w-8">E{episode.episode_number}</span>
                                                                    <span className={`flex-1 ${isWatched ? '' : 'opacity-50'}`}>
                                                                        {episode.name || `Episode ${episode.episode_number}`}
                                                                    </span>
                                                                    {isWatched && <span className="text-amber-500">✓</span>}
                                                                    {isUpcoming && <span className="text-red-400 text-[10px]">Upcoming</span>}
                                                                    {episode.air_date && (
                                                                        <span className={`text-[10px] ${isWatched ? 'text-amber-500/70' : 'text-white/30'}`}>
                                                                            {formatDate(episode.air_date)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-white/40 mt-2">No episode data available</div>
                                                )}
                                            </div>
                                        );
                                    })}

                                {Object.entries(progress.seasons || {}).filter(([seasonNum]) => parseInt(seasonNum) === 0).length > 0 && (
                                    <div className="mt-6 pt-4 border-t border-charcoal-700">
                                        <h4 className="text-lg font-bold text-amber-500 mb-3">Specials</h4>
                                        {Object.entries(progress.seasons || {})
                                            .filter(([seasonNum]) => parseInt(seasonNum) === 0)
                                            .map(([seasonNum, season]) => {
                                                const seasonProgress = getSeasonProgress(parseInt(seasonNum));
                                                const seasonData = seriesSeasonDetails[seriesId]?.[parseInt(seasonNum)];
                                                const seasonFromSeries = seriesInfo?.seasons?.find(s => s.season_number === parseInt(seasonNum));
                                                const watchedEpisodes = season.episodes || [];

                                                return (
                                                    <div key={seasonNum} className="bg-charcoal-800/50 p-4 rounded mb-3">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-white font-semibold">{seasonFromSeries?.name || seasonData?.name || 'Special'}</span>
                                                                {seasonProgress.total > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-20 bg-charcoal-900 rounded-full h-2">
                                                                            <div
                                                                                className="bg-amber-500 h-2 rounded-full transition-all"
                                                                                style={{ width: `${seasonProgress.percentage}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-xs text-amber-500/80">
                                                                            {seasonProgress.watched}/{seasonProgress.total} ({seasonProgress.percentage}%)
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                                season.completed ? 'bg-amber-500 text-black' : 'bg-charcoal-800 text-white'
                                                            }`}>
                                                                {season.completed ? 'Completed' : `${watchedEpisodes.length} episodes watched`}
                                                            </span>
                                                        </div>
                                                        {seasonData && seasonData.episodes && seasonData.episodes.length > 0 ? (
                                                            <div className="mt-3 space-y-1">
                                                                {seasonData.episodes.map((episode) => {
                                                                    const episodeIsReleased = isEpisodeReleased(episode, seasonData);
                                                                    const isWatched = episodeIsReleased && watchedEpisodes.includes(episode.episode_number);
                                                                    const isUpcoming = !episodeIsReleased;
                                                                    return (
                                                                        <div
                                                                            key={episode.id || episode.episode_number}
                                                                            className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                                                                                isWatched ? 'bg-amber-500/20 text-amber-400'
                                                                                    : isUpcoming ? 'bg-red-500/10 text-red-400/70'
                                                                                        : 'bg-charcoal-900/50 text-white/40'
                                                                            }`}
                                                                        >
                                                                            <span className="font-semibold w-8">E{episode.episode_number}</span>
                                                                            <span className={`flex-1 ${isWatched ? '' : 'opacity-50'}`}>
                                                                                {episode.name || `Episode ${episode.episode_number}`}
                                                                            </span>
                                                                            {isWatched && <span className="text-amber-500">✓</span>}
                                                                            {isUpcoming && <span className="text-red-400 text-[10px]">Upcoming</span>}
                                                                            {episode.air_date && (
                                                                                <span className={`text-[10px] ${isWatched ? 'text-amber-500/70' : 'text-white/30'}`}>
                                                                                    {formatDate(episode.air_date)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-white/40 mt-2">No episode data available</div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
