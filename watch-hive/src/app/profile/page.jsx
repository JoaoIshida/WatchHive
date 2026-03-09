"use client";
import { useState } from 'react';
import { useUserData } from '../contexts/UserDataContext';
import { isSeriesCompletedByEpisodes } from '../utils/seriesProgressCalculator';
import ProfileStatsSection from './ProfileStatsSection';

export default function ProfileStatsPage() {
    const {
        watched,
        wishlist,
        seriesProgress,
        seriesDetails,
        dbStats,
        customLists,
        upcomingEpisodes,
        upcomingWishlistMovies,
        loadingUpcoming,
    } = useUserData();

    const [expandedUpcomingSeries, setExpandedUpcomingSeries] = useState({});
    const [seriesSummaryExpanded, setSeriesSummaryExpanded] = useState(false);

    const watchedMovies = watched.filter(w => w.media_type === 'movie').length;
    const watchedSeries = watched.filter(w => w.media_type === 'tv').length;
    const wishlistMovies = wishlist.filter(w => w.media_type === 'movie').length;
    const wishlistSeries = wishlist.filter(w => w.media_type === 'tv').length;

    const seriesIds = Object.keys(seriesProgress);
    let seriesInProgressCount = dbStats?.series_in_progress ?? 0;
    let completedSeriesCount = dbStats?.completed_series ?? 0;
    if (seriesIds.length > 0) {
        let inProgress = 0;
        let completed = 0;
        seriesIds.forEach(seriesId => {
            const progress = seriesProgress[seriesId];
            const seasons = seriesDetails[seriesId]?.seasons;
            if (isSeriesCompletedByEpisodes(progress, seasons || [], {})) completed++;
            else if (Object.keys(progress?.seasons || {}).length > 0) inProgress++;
        });
        seriesInProgressCount = inProgress;
        completedSeriesCount = completed;
    }

    const totalEpisodesWatched = dbStats?.total_episodes_watched ??
        Object.values(seriesProgress).reduce((total, progress) =>
            total + Object.values(progress.seasons || {}).reduce((st, season) => st + (season.episodes?.length || 0), 0), 0);

    const stats = {
        totalWatched: dbStats?.watched_count ?? watched.length,
        watchedMovies,
        watchedSeries,
        totalWishlist: dbStats?.wishlist_count ?? wishlist.length,
        wishlistMovies,
        wishlistSeries,
        seriesInProgress: seriesInProgressCount,
        completedSeries: completedSeriesCount,
        totalEpisodesWatched,
        totalLists: dbStats?.custom_lists_count ?? customLists.length,
        totalListItems: customLists.reduce((total, list) => total + (list.items?.length || 0), 0),
    };

    return (
        <ProfileStatsSection
            stats={stats}
            loadingUpcoming={loadingUpcoming}
            upcomingEpisodes={upcomingEpisodes}
            upcomingWishlistMovies={upcomingWishlistMovies}
            expandedUpcomingSeries={expandedUpcomingSeries}
            setExpandedUpcomingSeries={setExpandedUpcomingSeries}
            seriesProgress={seriesProgress}
            seriesDetails={seriesDetails}
            seriesSummaryExpanded={seriesSummaryExpanded}
            setSeriesSummaryExpanded={setSeriesSummaryExpanded}
        />
    );
}
