"use client";
import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { isEpisodeReleased } from '../utils/releaseDateValidator';

const UserDataContext = createContext(null);

export function useUserData() {
    const ctx = useContext(UserDataContext);
    if (!ctx) throw new Error('useUserData must be used within UserDataProvider');
    return ctx;
}

export function UserDataProvider({ children }) {
    const { user, loading: authLoading } = useAuth();
    const [watched, setWatched] = useState([]);
    const [wishlist, setWishlist] = useState([]);
    const [seriesProgress, setSeriesProgress] = useState({});
    const [dbStats, setDbStats] = useState(null);
    const [customLists, setCustomLists] = useState([]);
    const [listDetails, setListDetails] = useState({});
    const [loadingListDetails, setLoadingListDetails] = useState({});
    const [watchedDetails, setWatchedDetails] = useState([]);
    const [wishlistDetails, setWishlistDetails] = useState([]);
    const [seriesDetails, setSeriesDetails] = useState({});
    const [upcomingEpisodes, setUpcomingEpisodes] = useState([]);
    const [upcomingWishlistMovies, setUpcomingWishlistMovies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingWatchedDetails, setLoadingWatchedDetails] = useState(false);
    const [loadingWishlistDetails, setLoadingWishlistDetails] = useState(false);
    const [loadingUpcoming, setLoadingUpcoming] = useState(false);
    const loadedForUserRef = useRef(null);

    const clearUserData = useCallback(() => {
        setWatched([]);
        setWishlist([]);
        setSeriesProgress({});
        setDbStats(null);
        setCustomLists([]);
        setListDetails({});
        setLoadingListDetails({});
        setWatchedDetails([]);
        setWishlistDetails([]);
        setSeriesDetails({});
        setUpcomingEpisodes([]);
        setUpcomingWishlistMovies([]);
        setLoading(false);
        setLoadingWatchedDetails(false);
        setLoadingWishlistDetails(false);
        setLoadingUpcoming(false);
        loadedForUserRef.current = null;
    }, []);

    const loadUpcomingMovies = useCallback(async (wishlistItems) => {
        const upcomingMoviesList = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const item of wishlistItems || []) {
            if (item.media_type === 'movie') {
                try {
                    const response = await fetch(`/api/content/movie/${item.content_id}`);
                    if (response.ok) {
                        const movieData = await response.json();
                        if (movieData.release_date) {
                            const releaseDate = new Date(movieData.release_date);
                            releaseDate.setHours(0, 0, 0, 0);
                            if (releaseDate > today) {
                                upcomingMoviesList.push({
                                    movieId: item.content_id,
                                    title: movieData.title,
                                    releaseDate: movieData.release_date,
                                    posterPath: movieData.poster_path,
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error checking upcoming movie:', e);
                }
            }
        }
        upcomingMoviesList.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
        setUpcomingWishlistMovies(upcomingMoviesList);
    }, []);

    const loadUpcomingData = useCallback(async (seriesMap, seriesProgressData, wishlistItems) => {
        setLoadingUpcoming(true);
        try {
            const seriesIds = Object.keys(seriesProgressData || {});
            const upcomingEpisodesList = [];
            const checkSeriesUpcomingEpisodes = async (seriesId, seriesData, progressData = null) => {
                if (!seriesData?.seasons) return;
                for (const season of seriesData.seasons) {
                    if (season.season_number < 0) continue;
                    try {
                        const seasonResponse = await fetch(`/api/tv/${seriesId}/season/${season.season_number}`);
                        if (seasonResponse.ok) {
                            const seasonData = await seasonResponse.json();
                            if (seasonData.episodes?.length) {
                                const watchedEpisodes = progressData?.seasons?.[String(season.season_number)]?.episodes || [];
                                seasonData.episodes.forEach((episode) => {
                                    if (!isEpisodeReleased(episode, seasonData) && !watchedEpisodes.includes(episode.episode_number)) {
                                        const episodeAirDate = episode.air_date || seasonData.air_date;
                                        if (episodeAirDate) {
                                            upcomingEpisodesList.push({
                                                seriesId,
                                                seriesName: seriesData.name,
                                                seasonNumber: season.season_number,
                                                seasonName: seasonData.name || season.name || `Season ${season.season_number}`,
                                                episodeNumber: episode.episode_number,
                                                episodeName: episode.name || `Episode ${episode.episode_number}`,
                                                airDate: episodeAirDate,
                                            });
                                        }
                                    }
                                });
                            }
                        }
                    } catch (e) {
                        console.error('Error fetching season:', e);
                    }
                }
            };
            for (const seriesId of seriesIds) {
                const seriesData = seriesMap[seriesId];
                const progressData = seriesProgressData[seriesId];
                if (seriesData) await checkSeriesUpcomingEpisodes(seriesId, seriesData, progressData);
            }
            const wishlistSeriesItems = (wishlistItems || []).filter((item) => item.media_type === 'tv');
            const wishlistSeriesIds = wishlistSeriesItems.map((item) => String(item.content_id)).filter((id) => !seriesIds.includes(id));
            let wishlistSeriesDetailsMap = {};
            if (wishlistSeriesIds.length) {
                const results = await Promise.all(
                    wishlistSeriesIds.map(async (seriesId) => {
                        try {
                            const response = await fetch(`/api/content/tv/${seriesId}`);
                            if (response.ok) {
                                const data = await response.json();
                                return { seriesId, seriesData: data };
                            }
                        } catch (e) {
                            console.error('Error fetching wishlist series:', e);
                        }
                        return null;
                    })
                );
                results.forEach((r) => {
                    if (r) wishlistSeriesDetailsMap[r.seriesId] = r.seriesData;
                });
                if (Object.keys(wishlistSeriesDetailsMap).length) setSeriesDetails((prev) => ({ ...prev, ...wishlistSeriesDetailsMap }));
            }
            for (const seriesId of wishlistSeriesIds) {
                const seriesData = wishlistSeriesDetailsMap[seriesId];
                if (seriesData) await checkSeriesUpcomingEpisodes(seriesId, seriesData, null);
            }
            upcomingEpisodesList.sort((a, b) => new Date(a.airDate) - new Date(b.airDate));
            setUpcomingEpisodes(upcomingEpisodesList);
            await loadUpcomingMovies(wishlistItems);
        } catch (e) {
            console.error('Error loading upcoming data:', e);
        } finally {
            setLoadingUpcoming(false);
        }
    }, [loadUpcomingMovies]);

    const loadSlowData = useCallback(
        async (watchedItems, wishlistItems, seriesProgressData) => {
            if (watchedItems?.length) {
                setLoadingWatchedDetails(true);
                try {
                    const details = await Promise.all(
                        watchedItems.map(async (item) => {
                            try {
                                const response = await fetch(`/api/content/${item.media_type}/${item.content_id}`);
                                if (response.ok) {
                                    const data = await response.json();
                                    return { ...data, media_type: item.media_type, timesWatched: item.times_watched, dateWatched: item.date_watched, id: item.content_id };
                                }
                            } catch (e) {
                                console.error('Error fetching watched item:', e);
                            }
                            return null;
                        })
                    );
                    setWatchedDetails(details.filter(Boolean));
                } finally {
                    setLoadingWatchedDetails(false);
                }
            }
            if (wishlistItems?.length) {
                setLoadingWishlistDetails(true);
                try {
                    const details = await Promise.all(
                        wishlistItems.map(async (item) => {
                            try {
                                const response = await fetch(`/api/content/${item.media_type}/${item.content_id}`);
                                if (response.ok) {
                                    const data = await response.json();
                                    return { ...data, media_type: item.media_type, dateAdded: item.date_added, id: item.content_id };
                                }
                            } catch (e) {
                                console.error('Error fetching wishlist item:', e);
                            }
                            return null;
                        })
                    );
                    setWishlistDetails(details.filter(Boolean));
                } finally {
                    setLoadingWishlistDetails(false);
                }
            }
            const seriesIds = Object.keys(seriesProgressData || {});
            if (seriesIds.length) {
                try {
                    const details = await Promise.all(
                        seriesIds.map(async (seriesId) => {
                            try {
                                const response = await fetch(`/api/content/tv/${seriesId}`);
                                if (response.ok) {
                                    const data = await response.json();
                                    return { id: seriesId, ...data };
                                }
                            } catch (e) {
                                console.error('Error fetching series:', e);
                            }
                            return null;
                        })
                    );
                    const seriesMap = {};
                    details.filter(Boolean).forEach((item) => {
                        seriesMap[item.id] = item;
                    });
                    setSeriesDetails(seriesMap);
                    await loadUpcomingData(seriesMap, seriesProgressData, wishlistItems);
                } catch (e) {
                    console.error('Error loading series details:', e);
                }
            } else {
                await loadUpcomingMovies(wishlistItems);
            }
        },
        [loadUpcomingData, loadUpcomingMovies]
    );

    const loadUserData = useCallback(
        async (force = false) => {
            if (!user?.id) return;
            if (!force && loadedForUserRef.current === user.id) return;
            setLoading(true);
            try {
                // First wave: critical data for initial paint (no series progress to keep load fast)
                const [watchedRes, wishlistRes, statsRes, customListsRes] = await Promise.all([
                    fetch('/api/watched'),
                    fetch('/api/wishlist'),
                    fetch('/api/user/stats'),
                    fetch('/api/custom-lists'),
                ]);
                const watchedItems = watchedRes.ok ? (await watchedRes.json()).watched : [];
                const wishlistItems = wishlistRes.ok ? (await wishlistRes.json()).wishlist : [];
                const statsData = statsRes.ok ? (await statsRes.json()).stats : null;
                const customListsData = customListsRes.ok ? (await customListsRes.json()).lists : [];
                setWatched(watchedItems);
                setWishlist(wishlistItems);
                setDbStats(statsData);
                setCustomLists(customListsData || []);
                loadedForUserRef.current = user.id;
                setLoading(false);

                // Second wave: series progress and slow data in background (does not block UI)
                const seriesProgressRes = await fetch('/api/series-progress');
                const seriesProgressData = seriesProgressRes.ok ? (await seriesProgressRes.json()) : {};
                setSeriesProgress(seriesProgressData);
                loadSlowData(watchedItems, wishlistItems, seriesProgressData);
            } catch (e) {
                console.error('Error loading user data:', e);
                setLoading(false);
            }
        },
        [user?.id, loadSlowData]
    );

    const refreshUserData = useCallback(() => {
        loadedForUserRef.current = null;
        setListDetails({});
        loadUserData(true);
    }, [loadUserData]);

    const loadListDetails = useCallback(async (listId) => {
        if (listDetails[listId] !== undefined) return;
        setLoadingListDetails((prev) => ({ ...prev, [listId]: true }));
        try {
            const response = await fetch(`/api/custom-lists/${listId}`);
            if (!response.ok) {
                setListDetails((prev) => ({ ...prev, [listId]: [] }));
                return;
            }
            const { list: listWithItems } = await response.json();
            const rawItems = listWithItems.items || [];
            const enriched = await Promise.all(
                rawItems.map(async (item) => {
                    try {
                        const contentRes = await fetch(`/api/content/${item.media_type}/${item.content_id}`);
                        if (contentRes.ok) {
                            const data = await contentRes.json();
                            return { ...data, id: item.content_id, media_type: item.media_type };
                        }
                    } catch (e) {
                        console.error('Error enriching list item:', e);
                    }
                    return null;
                })
            );
            setListDetails((prev) => ({ ...prev, [listId]: enriched.filter(Boolean) }));
        } catch (e) {
            console.error('Error loading list details:', e);
            setListDetails((prev) => ({ ...prev, [listId]: [] }));
        } finally {
            setLoadingListDetails((prev) => ({ ...prev, [listId]: false }));
        }
    }, [listDetails]);

    useEffect(() => {
        if (authLoading) return;
        if (!user?.id) {
            clearUserData();
            return;
        }
        loadUserData();
    }, [user?.id, authLoading, loadUserData, clearUserData]);

    const value = {
        watched,
        wishlist,
        seriesProgress,
        setSeriesProgress,
        dbStats,
        customLists,
        listDetails,
        loadingListDetails,
        watchedDetails,
        wishlistDetails,
        seriesDetails,
        setSeriesDetails,
        upcomingEpisodes,
        upcomingWishlistMovies,
        loading,
        loadingWatchedDetails,
        loadingWishlistDetails,
        loadingUpcoming,
        refreshUserData,
        loadListDetails,
    };

    return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}
