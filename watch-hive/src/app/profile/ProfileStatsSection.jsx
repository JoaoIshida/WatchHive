"use client";
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import LoadingSpinner from '../components/LoadingSpinner';
import ImageWithFallback from '../components/ImageWithFallback';
import { formatDate } from '../utils/dateFormatter';
import ProfileInProgressSeriesStrip from './ProfileInProgressSeriesStrip';

export default function ProfileStatsSection({
    stats,
    loadingUpcoming,
    upcomingEpisodes,
    upcomingWishlistMovies,
    expandedUpcomingSeries,
    setExpandedUpcomingSeries,
    seriesProgress,
    seriesDetails,
}) {
    return (
        <div className="space-y-6">
            <ProfileInProgressSeriesStrip
                seriesProgress={seriesProgress}
                seriesDetails={seriesDetails}
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
                        {stats.totalEpisodesWatched}
                    </div>
                    <div className="text-white font-semibold">Episodes watched</div>
                    <div className="text-sm text-amber-500/80 mt-2">
                        {stats.completedSeries} series completed
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

        </div>
    );
}
