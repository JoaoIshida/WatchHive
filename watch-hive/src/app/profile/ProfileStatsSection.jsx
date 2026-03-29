"use client";
import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import LoadingSpinner from '../components/LoadingSpinner';
import ImageWithFallback from '../components/ImageWithFallback';
import { formatDate } from '../utils/dateFormatter';
import { isSeriesCompletedByEpisodes, calculateSeriesProgress } from '../utils/seriesProgressCalculator';

export default function ProfileStatsSection({
    stats,
    loadingUpcoming,
    upcomingEpisodes,
    upcomingWishlistMovies,
    expandedUpcomingSeries,
    setExpandedUpcomingSeries,
    seriesProgress,
    seriesDetails,
    seriesSummaryExpanded,
    setSeriesSummaryExpanded,
}) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Link
                    href="/profile/watched"
                    className="futuristic-card p-6 text-center block transition-colors hover:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded-xl"
                >
                    <div className="text-4xl font-bold text-amber-500 mb-2">
                        {stats.totalWatched}
                    </div>
                    <div className="text-white font-semibold">Watched</div>
                    <div className="text-sm text-amber-500/80 mt-2">
                        {stats.watchedMovies} movies • {stats.watchedSeries} series
                    </div>
                </Link>

                <Link
                    href="/profile/wishlist"
                    className="futuristic-card p-6 text-center block transition-colors hover:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded-xl"
                >
                    <div className="text-4xl font-bold text-amber-500 mb-2">
                        {stats.totalWishlist}
                    </div>
                    <div className="text-white font-semibold">Wishlist</div>
                    <div className="text-sm text-amber-500/80 mt-2">
                        {stats.wishlistMovies} movies • {stats.wishlistSeries} series
                    </div>
                </Link>

                <Link
                    href="/profile/favorites"
                    className="futuristic-card p-6 text-center block transition-colors hover:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded-xl"
                >
                    <div className="text-4xl font-bold text-amber-500 mb-2">
                        {stats.totalFavorites ?? 0}
                    </div>
                    <div className="text-white font-semibold">Favorites</div>
                    <div className="text-sm text-amber-500/80 mt-2">
                        {(stats.favoriteMovies ?? 0)} movies • {(stats.favoriteSeries ?? 0)} series
                    </div>
                </Link>

                <Link
                    href="/profile/series"
                    className="futuristic-card p-6 text-center block transition-colors hover:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded-xl"
                >
                    <div className="text-4xl font-bold text-amber-500 mb-2">
                        {stats.seriesInProgress}
                    </div>
                    <div className="text-white font-semibold">Series in progress</div>
                    <div className="text-sm text-amber-500/80 mt-2">
                        {stats.completedSeries} completed
                    </div>
                </Link>

                <Link
                    href="/profile/series"
                    className="futuristic-card p-6 text-center block transition-colors hover:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded-xl lg:col-span-2"
                >
                    <div className="text-4xl font-bold text-amber-500 mb-2">
                        {stats.totalEpisodesWatched}
                    </div>
                    <div className="text-white font-semibold">Episodes watched</div>
                    <div className="text-sm text-amber-500/80 mt-2">
                        Across all series
                    </div>
                </Link>
            </div>

            {/* Upcoming Section - Combined */}
            {loadingUpcoming ? (
                <div className="futuristic-card p-6 border-2 border-amber-500/50">
                    <h2 className="text-2xl font-bold mb-4 text-amber-500">
                        Upcoming
                    </h2>
                    <div className="flex justify-center py-8">
                        <LoadingSpinner size="md" text="Loading upcoming content..." />
                    </div>
                </div>
            ) : (upcomingEpisodes.length > 0 || upcomingWishlistMovies.length > 0) && (() => {
                const seriesMap = {};
                upcomingEpisodes.forEach(episode => {
                    if (!seriesMap[episode.seriesId]) {
                        const seriesInfo = seriesDetails[episode.seriesId];
                        seriesMap[episode.seriesId] = {
                            seriesId: episode.seriesId,
                            seriesName: episode.seriesName,
                            posterPath: seriesInfo?.poster_path || null,
                            episodes: []
                        };
                    }
                    seriesMap[episode.seriesId].episodes.push(episode);
                });
                Object.values(seriesMap).forEach(series => {
                    series.episodes.sort((a, b) => new Date(a.airDate) - new Date(b.airDate));
                });
                const sortedSeries = Object.values(seriesMap).sort((a, b) => {
                    const getEarliestDate = (s) => {
                        const dates = s.episodes.map(e => new Date(e.airDate)).filter(d => !isNaN(d));
                        return dates.length > 0 ? Math.min(...dates) : new Date(0);
                    };
                    return getEarliestDate(a) - getEarliestDate(b);
                });
                const totalUpcoming = upcomingEpisodes.length + upcomingWishlistMovies.length;

                return (
                    <div className="futuristic-card p-6 border-2 border-amber-500/50">
                        <h2 className="text-2xl font-bold mb-4 text-amber-500">
                            Upcoming ({totalUpcoming})
                        </h2>
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                            {sortedSeries.map((series) => {
                                const isExpanded = expandedUpcomingSeries[series.seriesId];
                                const totalItems = series.episodes.length;
                                const seriesInfo = seriesDetails[series.seriesId];
                                const displayName = series.seriesName || seriesInfo?.name;

                                return (
                                    <div key={series.seriesId} className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setExpandedUpcomingSeries(prev => ({
                                                    ...prev,
                                                    [series.seriesId]: !prev[series.seriesId]
                                                }))}
                                                className="flex items-center gap-2 text-left group"
                                            >
                                                <ChevronRight className={`w-5 h-5 text-amber-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            </button>
                                            {(series.posterPath || seriesInfo?.poster_path) && (
                                                <ImageWithFallback
                                                    src={`https://image.tmdb.org/t/p/w92${series.posterPath || seriesInfo?.poster_path}`}
                                                    alt={displayName || 'Series'}
                                                    className="w-12 h-16 object-cover rounded"
                                                />
                                            )}
                                            <button
                                                onClick={() => setExpandedUpcomingSeries(prev => ({
                                                    ...prev,
                                                    [series.seriesId]: !prev[series.seriesId]
                                                }))}
                                                className="flex-1 text-left group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="text-lg font-bold text-amber-500 group-hover:text-amber-400 transition-colors">
                                                        {displayName || <span className="text-amber-500/60 animate-pulse">Loading series name...</span>}
                                                    </div>
                                                    <span className="text-sm text-amber-500/60">
                                                        ({totalItems} {totalItems === 1 ? 'item' : 'items'})
                                                    </span>
                                                </div>
                                            </button>
                                            <a
                                                href={`/series/${series.seriesId}`}
                                                className="futuristic-button text-sm px-3 py-1.5 whitespace-nowrap"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                View
                                            </a>
                                        </div>

                                        {isExpanded && (
                                            <div className="space-y-2 ml-7">
                                                {series.episodes.map((episode, index) => (
                                                    <a
                                                        key={`episode-${episode.seriesId}-${episode.seasonNumber}-${episode.episodeNumber}-${index}`}
                                                        href={`/series/${episode.seriesId}`}
                                                        className="flex items-center justify-between p-2 bg-charcoal-800/50 rounded hover:bg-charcoal-700/50 transition-colors"
                                                    >
                                                        <div className="flex-1">
                                                            <div className="text-sm text-amber-500/80">
                                                                {episode.seasonName} • {episode.episodeName}
                                                            </div>
                                                        </div>
                                                        <div className="text-amber-500 font-semibold text-xs">
                                                            {formatDate(episode.airDate)}
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {upcomingWishlistMovies.length > 0 && (
                                <div className="pt-2 border-t border-charcoal-700">
                                    <h3 className="text-lg font-bold text-amber-500 mb-3">Movies</h3>
                                    <div className="space-y-2">
                                        {upcomingWishlistMovies.map((movie, index) => (
                                            <a
                                                key={`movie-${movie.movieId}-${index}`}
                                                href={`/movies/${movie.movieId}`}
                                                className="flex items-center justify-between p-2 bg-charcoal-800/50 rounded hover:bg-charcoal-700/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 flex-1">
                                                    {movie.posterPath && (
                                                        <img
                                                            src={`https://image.tmdb.org/t/p/w92${movie.posterPath}`}
                                                            alt={movie.title}
                                                            className="w-12 h-16 object-cover rounded"
                                                        />
                                                    )}
                                                    <div className="flex-1">
                                                        <div className="text-white font-semibold text-sm">
                                                            {movie.title}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-amber-500 font-semibold text-xs">
                                                    {formatDate(movie.releaseDate)}
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Series Progress Summary */}
            {Object.keys(seriesProgress).length > 0 && (
                <div className="futuristic-card p-6">
                    <button
                        type="button"
                        onClick={() => setSeriesSummaryExpanded(prev => !prev)}
                        className="w-full flex items-center justify-between text-left"
                    >
                        <h2 className="text-2xl font-bold text-amber-500">
                            Series Progress Summary
                        </h2>
                        <span className="text-white/70 text-sm">
                            {Object.keys(seriesProgress).length} series
                        </span>
                        <ChevronDown className={`w-5 h-5 text-white/70 transition-transform ${seriesSummaryExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {seriesSummaryExpanded && (
                        <div className="mt-4 space-y-3">
                            {(() => {
                                const entries = Object.entries(seriesProgress);
                                const withCompleted = entries.map(([seriesId, progress]) => ({
                                    seriesId,
                                    progress,
                                    completedByEpisodes: isSeriesCompletedByEpisodes(progress, seriesDetails[seriesId]?.seasons || [], {}),
                                }));
                                const sorted = withCompleted.sort((a, b) => (a.completedByEpisodes === b.completedByEpisodes ? 0 : a.completedByEpisodes ? 1 : -1));
                                const latest = sorted.slice(0, 10);
                                return (
                                    <>
                                        {latest.map(({ seriesId, progress, completedByEpisodes }) => {
                                            const seriesInfo = seriesDetails[seriesId];
                                            const totalSeasonsFromTMDB = seriesInfo?.seasons?.filter(s => s.season_number > 0).length || 0;
                                            const watchedSeasonsCount = Object.keys(progress.seasons || {}).filter(seasonNum => parseInt(seasonNum) > 0).length;
                                            const totalSeasons = totalSeasonsFromTMDB > 0 ? totalSeasonsFromTMDB : watchedSeasonsCount;
                                            const specialsCount = seriesInfo?.seasons?.filter(s => s.season_number === 0).length || 0;
                                            const watchedSpecialsCount = Object.keys(progress.seasons || {}).filter(seasonNum => parseInt(seasonNum) === 0).length;
                                            const totalEpisodesWatched = Object.entries(progress.seasons || {})
                                                .filter(([seasonNum]) => parseInt(seasonNum) > 0)
                                                .reduce((total, [, season]) => total + (season.episodes?.length || 0), 0);
                                            const seriesProgressData = calculateSeriesProgress(progress, seriesInfo?.seasons, {});
                                            return (
                                                <a
                                                    key={seriesId}
                                                    href={`/series/${seriesId}`}
                                                    className="flex items-center justify-between p-3 bg-charcoal-800/50 rounded hover:bg-charcoal-700/50 transition-colors"
                                                >
                                                    <div className="flex-1">
                                                        <div className="text-white font-semibold">
                                                            {seriesInfo?.name || <span className="text-amber-500/60 animate-pulse">Loading series...</span>}
                                                        </div>
                                                        <div className="text-sm text-amber-500/80 mt-1">
                                                            {watchedSeasonsCount}/{totalSeasons} seasons • {totalEpisodesWatched} episodes watched
                                                            {specialsCount > 0 && <span className="ml-2">• {watchedSpecialsCount}/{specialsCount} specials</span>}
                                                            {seriesProgressData.total > 0 && <span className="ml-2">• {seriesProgressData.percentage}%</span>}
                                                        </div>
                                                    </div>
                                                    <div className={`px-3 py-1 rounded font-semibold ${completedByEpisodes ? 'bg-amber-500 text-black' : 'bg-charcoal-800 text-white'}`}>
                                                        {completedByEpisodes ? 'Completed' : 'In Progress'}
                                                    </div>
                                                </a>
                                            );
                                        })}
                                        {entries.length > 10 ? (
                                            <div className="pt-2 text-center">
                                                <Link href="/profile/series" className="text-amber-500 hover:text-amber-400 font-semibold">
                                                    View more ({entries.length - 10} more) &rarr;
                                                </Link>
                                            </div>
                                        ) : (
                                            <div className="pt-2 text-center">
                                                <Link href="/profile/series" className="text-amber-500 hover:text-amber-400 font-semibold">
                                                    View all in Series tab &rarr;
                                                </Link>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
