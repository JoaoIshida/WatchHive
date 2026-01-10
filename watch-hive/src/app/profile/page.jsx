"use client";
import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import ContentCard from '../components/ContentCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationModal from '../components/ConfirmationModal';
import ImageWithFallback from '../components/ImageWithFallback';
import { formatDate } from '../utils/dateFormatter';
import { isEpisodeReleased } from '../utils/releaseDateValidator';
import { calculateSeriesProgress, calculateSeasonProgress } from '../utils/seriesProgressCalculator';

// Component that uses useSearchParams - must be wrapped in Suspense
const ProfilePageContent = () => {
    const { user, loading: authLoading, signOut, checkAuthStatus } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [watched, setWatched] = useState([]);
    const [wishlist, setWishlist] = useState([]);
    const [seriesProgress, setSeriesProgress] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadingUpcoming, setLoadingUpcoming] = useState(false);
    const [loadingWatchedDetails, setLoadingWatchedDetails] = useState(false);
    const [loadingWishlistDetails, setLoadingWishlistDetails] = useState(false);
    const [activeTab, setActiveTab] = useState('stats');
    const [watchedDetails, setWatchedDetails] = useState([]);
    const [wishlistDetails, setWishlistDetails] = useState([]);
    const [seriesDetails, setSeriesDetails] = useState({});
    const [customLists, setCustomLists] = useState([]);
    const [listDetails, setListDetails] = useState({});
    const [upcomingSeasons, setUpcomingSeasons] = useState([]);
    const [upcomingEpisodes, setUpcomingEpisodes] = useState([]);
    const [upcomingWishlistMovies, setUpcomingWishlistMovies] = useState([]);
    const [dbStats, setDbStats] = useState(null);
    const [displayName, setDisplayName] = useState('');
    const [showSignOutModal, setShowSignOutModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [expandedSeries, setExpandedSeries] = useState({});
    const [seriesSeasonDetails, setSeriesSeasonDetails] = useState({}); // { seriesId: { seasonNumber: seasonData } }
    const [watchedFilter, setWatchedFilter] = useState('all'); // 'all', 'movie', 'tv'
    const [expandedUpcomingSeries, setExpandedUpcomingSeries] = useState({}); // For upcoming section dropdowns

    useEffect(() => {
        // Check URL params for tab
        const tab = searchParams.get('tab');
        if (tab === 'settings') {
            setActiveTab('settings');
        }
    }, [searchParams]);

    // Reload series data when switching to series tab (only once per tab switch)
    const [hasReloadedSeries, setHasReloadedSeries] = useState(false);
    useEffect(() => {
        if (activeTab === 'series' && user && !hasReloadedSeries) {
            // Reload series progress to get latest episode data
            const reloadSeriesProgress = async () => {
                try {
                    const seriesProgressRes = await fetch('/api/series-progress');
                    if (seriesProgressRes.ok) {
                        const seriesProgressData = await seriesProgressRes.json();
                        setSeriesProgress(seriesProgressData);
                        
                        // Reload series details
                        const seriesIds = Object.keys(seriesProgressData);
                        if (seriesIds.length > 0) {
                            const seriesDetailsPromises = seriesIds.map(async (seriesId) => {
                                try {
                                    const response = await fetch(`/api/content/tv/${seriesId}`);
                                    if (response.ok) {
                                        const data = await response.json();
                                        return { id: seriesId, ...data };
                                    }
                                } catch (error) {
                                    console.error(`Error fetching series ${seriesId}:`, error);
                                }
                                return null;
                            });
                            const details = await Promise.all(seriesDetailsPromises);
                            const seriesMap = {};
                            details.filter(item => item !== null).forEach(item => {
                                seriesMap[item.id] = item;
                            });
                            setSeriesDetails(prev => ({ ...prev, ...seriesMap }));
                        }
                    }
                } catch (error) {
                    console.error('Error reloading series progress:', error);
                } finally {
                    setHasReloadedSeries(true);
                }
            };
            reloadSeriesProgress();
        } else if (activeTab !== 'series') {
            // Reset reload flag when switching away from series tab
            setHasReloadedSeries(false);
        }
    }, [activeTab, user, hasReloadedSeries]);

    useEffect(() => {
        // Wait for auth to load, then check if user is authenticated
        if (authLoading) return;
        
        if (!user) {
            setLoading(false);
            return;
        }

        // Set display name from user
        setDisplayName(user.display_name || user.email || '');

        // User is authenticated, load data
        loadUserData();
        
        // Listen for data updates
        const handleDataUpdate = () => {
            if (user) {
                loadUserData();
            }
        };
        
        window.addEventListener('watchhive-data-updated', handleDataUpdate);
        return () => {
            window.removeEventListener('watchhive-data-updated', handleDataUpdate);
        };
    }, [user, authLoading]);

    const loadUserData = async () => {
        setLoading(true);
        try {
            // User is already checked via useAuth hook, no need to check again
            if (!user) {
                setLoading(false);
                return;
            }

            // Load quick data first (stats, basic lists)
            const [watchedRes, wishlistRes, seriesProgressRes, statsRes, customListsRes] = await Promise.all([
                fetch('/api/watched'),
                fetch('/api/wishlist'),
                fetch('/api/series-progress'),
                fetch('/api/user/stats'),
                fetch('/api/custom-lists'),
            ]);

            const watchedItems = watchedRes.ok ? (await watchedRes.json()).watched : [];
            const wishlistItems = wishlistRes.ok ? (await wishlistRes.json()).wishlist : [];
            const seriesProgressData = seriesProgressRes.ok ? (await seriesProgressRes.json()) : {};
            const statsData = statsRes.ok ? (await statsRes.json()).stats : null;
            const customListsData = customListsRes.ok ? (await customListsRes.json()).lists : [];

            setWatched(watchedItems);
            setWishlist(wishlistItems);
            setSeriesProgress(seriesProgressData);
            setDbStats(statsData);
            setCustomLists(customListsData || []);
            
            // Mark quick data as loaded
            setLoading(false);
            
            // Load slow data in parallel (don't block UI)
            loadSlowData(watchedItems, wishlistItems, seriesProgressData);
        } catch (error) {
            console.error('Error loading user data:', error);
            setLoading(false);
        }
    };

    const loadSlowData = async (watchedItems, wishlistItems, seriesProgressData, customListsData) => {
        // Load list details (items for each list)
        if (customListsData && customListsData.length > 0) {
            const listDetailsPromises = customListsData.map(async (list) => {
                try {
                    const response = await fetch(`/api/custom-lists/${list.id}`);
                    if (response.ok) {
                        const { list: listWithItems } = await response.json();
                        return { listId: list.id, items: listWithItems.items || [] };
                    }
                } catch (error) {
                    console.error(`Error fetching list ${list.id} details:`, error);
                }
                return { listId: list.id, items: [] };
            });
            const details = await Promise.all(listDetailsPromises);
            const detailsMap = {};
            details.forEach(d => {
                detailsMap[d.listId] = d.items;
            });
            setListDetails(detailsMap);
        }

        // Load watched details (can be slow)
        if (watchedItems.length > 0) {
            setLoadingWatchedDetails(true);
            try {
                const watchedDetailsPromises = watchedItems.map(async (item) => {
                    try {
                        const response = await fetch(`/api/content/${item.media_type}/${item.content_id}`);
                        if (response.ok) {
                            const data = await response.json();
                            return { 
                                ...data, 
                                media_type: item.media_type, 
                                timesWatched: item.times_watched, 
                                dateWatched: item.date_watched,
                                id: item.content_id 
                            };
                        }
                    } catch (error) {
                        console.error(`Error fetching ${item.media_type} ${item.content_id}:`, error);
                    }
                    return null;
                });
                const details = await Promise.all(watchedDetailsPromises);
                setWatchedDetails(details.filter(item => item !== null));
            } finally {
                setLoadingWatchedDetails(false);
            }
        }

        // Load wishlist details (can be slow)
        if (wishlistItems.length > 0) {
            setLoadingWishlistDetails(true);
            try {
                const wishlistDetailsPromises = wishlistItems.map(async (item) => {
                    try {
                        const response = await fetch(`/api/content/${item.media_type}/${item.content_id}`);
                        if (response.ok) {
                            const data = await response.json();
                            return { 
                                ...data, 
                                media_type: item.media_type, 
                                dateAdded: item.date_added,
                                id: item.content_id 
                            };
                        }
                    } catch (error) {
                        console.error(`Error fetching ${item.media_type} ${item.content_id}:`, error);
                    }
                    return null;
                });
                const details = await Promise.all(wishlistDetailsPromises);
                setWishlistDetails(details.filter(item => item !== null));
            } finally {
                setLoadingWishlistDetails(false);
            }
        }

        // Load series details and upcoming data (slowest)
        const seriesIds = Object.keys(seriesProgressData);
        if (seriesIds.length > 0) {
            try {
                const seriesDetailsPromises = seriesIds.map(async (seriesId) => {
                    try {
                        const response = await fetch(`/api/content/tv/${seriesId}`);
                        if (response.ok) {
                            const data = await response.json();
                            return { id: seriesId, ...data };
                        }
                    } catch (error) {
                        console.error(`Error fetching series ${seriesId}:`, error);
                    }
                    return null;
                });
                const details = await Promise.all(seriesDetailsPromises);
                const seriesMap = {};
                details.filter(item => item !== null).forEach(item => {
                    seriesMap[item.id] = item;
                });
                setSeriesDetails(seriesMap);
                
                // Load upcoming data (episodes and movies)
                loadUpcomingData(seriesMap, seriesProgressData, wishlistItems);
            } catch (error) {
                console.error('Error loading series details:', error);
            }
        } else {
            // Still check for upcoming movies even if no series
            loadUpcomingMovies(wishlistItems);
        }
    };

    const loadUpcomingData = async (seriesMap, seriesProgressData, wishlistItems) => {
        setLoadingUpcoming(true);
        try {
            const seriesIds = Object.keys(seriesProgressData);
            
            // Check for upcoming episodes
            const upcomingEpisodesList = [];
            
            // Helper function to check episodes for a series
            const checkSeriesUpcomingEpisodes = async (seriesId, seriesData, progressData = null) => {
                if (!seriesData || !seriesData.seasons) return;
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                for (const season of seriesData.seasons) {
                    if (season.season_number < 0) continue; // Skip specials
                    
                    try {
                        const seasonResponse = await fetch(`/api/tv/${seriesId}/season/${season.season_number}`);
                        if (seasonResponse.ok) {
                            const seasonData = await seasonResponse.json();
                                
                            if (seasonData.episodes && seasonData.episodes.length > 0) {
                                const watchedEpisodes = progressData?.seasons?.[String(season.season_number)]?.episodes || [];
                                
                                seasonData.episodes.forEach(episode => {
                                    const episodeIsReleased = isEpisodeReleased(episode, seasonData);
                                    
                                    if (!episodeIsReleased && !watchedEpisodes.includes(episode.episode_number)) {
                                        const episodeAirDate = episode.air_date || seasonData.air_date;
                                        if (!episodeAirDate) return;
                                        
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
                                });
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching season ${season.season_number} episodes for series ${seriesId}:`, error);
                    }
                }
            };

            // Check watched series
            for (const seriesId of seriesIds) {
                try {
                    const seriesData = seriesMap[seriesId];
                    const progressData = seriesProgressData[seriesId];
                    
                    if (!seriesData) {
                        console.warn(`Series data not available for ${seriesId}, skipping upcoming episodes check`);
                        continue;
                    }
                    
                    await checkSeriesUpcomingEpisodes(seriesId, seriesData, progressData);
                } catch (error) {
                    console.error(`Error checking upcoming episodes for series ${seriesId}:`, error);
                }
            }

            // Check wishlist series
            const wishlistSeriesItems = wishlistItems.filter(item => item.media_type === 'tv');
            const wishlistSeriesIds = wishlistSeriesItems
                .map(item => String(item.content_id))
                .filter(id => !seriesIds.includes(id));
            
            const wishlistSeriesDetailsPromises = wishlistSeriesIds.map(async (seriesId) => {
                try {
                    const seriesData = seriesDetails[seriesId];
                    if (seriesData) {
                        return { seriesId, seriesData };
                    }
                    
                    const response = await fetch(`/api/content/tv/${seriesId}`);
                    if (response.ok) {
                        const data = await response.json();
                        return { seriesId, seriesData: data };
                    }
                } catch (error) {
                    console.error(`Error fetching wishlist series ${seriesId}:`, error);
                }
                return null;
            });
            
            const wishlistSeriesDetailsResults = await Promise.all(wishlistSeriesDetailsPromises);
            const wishlistSeriesDetailsMap = {};
            
            wishlistSeriesDetailsResults.forEach(result => {
                if (result) {
                    wishlistSeriesDetailsMap[result.seriesId] = result.seriesData;
                }
            });
            
            if (Object.keys(wishlistSeriesDetailsMap).length > 0) {
                setSeriesDetails(prev => ({ ...prev, ...wishlistSeriesDetailsMap }));
            }
            
            // Check episodes for wishlist series
            for (const seriesId of wishlistSeriesIds) {
                try {
                    const seriesData = wishlistSeriesDetailsMap[seriesId];
                    if (seriesData) {
                        await checkSeriesUpcomingEpisodes(seriesId, seriesData, null);
                    }
                } catch (error) {
                    console.error(`Error checking upcoming episodes for wishlist series ${seriesId}:`, error);
                }
            }
            
            // Sort upcoming episodes by air date
            upcomingEpisodesList.sort((a, b) => new Date(a.airDate) - new Date(b.airDate));
            setUpcomingEpisodes(upcomingEpisodesList);
            
            // Load upcoming movies
            loadUpcomingMovies(wishlistItems);
        } catch (error) {
            console.error('Error loading upcoming data:', error);
        } finally {
            setLoadingUpcoming(false);
        }
    };

    const loadUpcomingMovies = async (wishlistItems) => {
        const upcomingMoviesList = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (const item of wishlistItems) {
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
                } catch (error) {
                    console.error(`Error checking upcoming movie ${item.content_id}:`, error);
                }
            }
        }
        
        upcomingMoviesList.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
        setUpcomingWishlistMovies(upcomingMoviesList);
    };

    const getStats = () => {
        // Use database stats if available, otherwise calculate from local state
        const watchedMovies = watched.filter(w => w.media_type === 'movie').length;
        const watchedSeries = watched.filter(w => w.media_type === 'tv').length;
        const wishlistMovies = wishlist.filter(w => w.media_type === 'movie').length;
        const wishlistSeries = wishlist.filter(w => w.media_type === 'tv').length;

        // Use database function stats when available
        const seriesInProgress = dbStats?.series_in_progress ?? 
            Object.keys(seriesProgress).filter(seriesId => {
                const progress = seriesProgress[seriesId];
                return !progress.completed && Object.keys(progress.seasons || {}).length > 0;
            }).length;
        
        const completedSeries = dbStats?.completed_series ?? 
            Object.keys(seriesProgress).filter(seriesId => {
                return seriesProgress[seriesId]?.completed || false;
            }).length;

        const totalEpisodesWatched = dbStats?.total_episodes_watched ?? 
            Object.values(seriesProgress).reduce((total, progress) => {
                return total + Object.values(progress.seasons || {}).reduce((seasonTotal, season) => {
                    return seasonTotal + (season.episodes?.length || 0);
                }, 0);
            }, 0);

        const totalLists = dbStats?.custom_lists_count ?? customLists.length;
        const totalListItems = customLists.reduce((total, list) => total + (list.items?.length || 0), 0);

        return {
            totalWatched: dbStats?.watched_count ?? watched.length,
            watchedMovies,
            watchedSeries,
            totalWishlist: dbStats?.wishlist_count ?? wishlist.length,
            wishlistMovies,
            wishlistSeries,
            seriesInProgress,
            completedSeries,
            totalEpisodesWatched,
            totalLists,
            totalListItems,
        };
    };

    const stats = getStats();

    if (loading) {
        return (
            <div className="page-container">
                <h1 className="page-title">Profile</h1>
                <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" />
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="page-container max-w-7xl">
                <h1 className="page-title">Profile</h1>
                <div className="futuristic-card p-8 text-center">
                    <p className="text-xl text-white mb-4">Please sign in to view your profile</p>
                    <p className="text-amber-500/80 mb-6">Sign in to track your watched content, wishlist, and more!</p>
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
                            }}
                            className="futuristic-button-yellow px-6 py-3"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signup' } }));
                            }}
                            className="futuristic-button px-6 py-3"
                        >
                            Sign Up
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container max-w-7xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="page-title mb-0">My Profile</h1>
                <button
                    onClick={loadUserData}
                    className="futuristic-button flex items-center gap-2"
                    title="Refresh data"
                >
                    <svg 
                        className="w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                        />
                    </svg>
                    <span>Refresh</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-charcoal-700/30">
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'stats'
                            ? 'text-amber-500 border-b-2 border-amber-500'
                            : 'text-white hover:text-amber-500'
                    }`}
                >
                    Statistics
                </button>
                <button
                    onClick={() => setActiveTab('watched')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'watched'
                            ? 'text-amber-500 border-b-2 border-amber-500'
                            : 'text-white hover:text-amber-500'
                    }`}
                >
                    Watched ({stats.totalWatched})
                </button>
                <button
                    onClick={() => setActiveTab('wishlist')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'wishlist'
                            ? 'text-amber-500 border-b-2 border-amber-500'
                            : 'text-white hover:text-amber-500'
                    }`}
                >
                    Wishlist ({stats.totalWishlist})
                </button>
                <button
                    onClick={() => setActiveTab('series')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'series'
                            ? 'text-amber-500 border-b-2 border-amber-500'
                            : 'text-white hover:text-amber-500'
                    }`}
                >
                    Series Progress
                </button>
                <button
                    onClick={() => setActiveTab('lists')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'lists'
                            ? 'text-amber-500 border-b-2 border-amber-500'
                            : 'text-white hover:text-amber-500'
                    }`}
                >
                    Lists ({stats.totalLists})
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'settings'
                            ? 'text-amber-500 border-b-2 border-amber-500'
                            : 'text-white hover:text-amber-500'
                    }`}
                >
                    Settings
                </button>
            </div>

            {/* Stats Tab */}
            {activeTab === 'stats' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="futuristic-card p-6 text-center">
                            <div className="text-4xl font-bold text-amber-500 mb-2">
                                {stats.totalWatched}
                            </div>
                            <div className="text-white font-semibold">Total Watched</div>
                            <div className="text-sm text-amber-500/80 mt-2">
                                {stats.watchedMovies} movies • {stats.watchedSeries} series
                            </div>
                        </div>

                        <div className="futuristic-card p-6 text-center">
                            <div className="text-4xl font-bold text-amber-500 mb-2">
                                {stats.totalWishlist}
                            </div>
                            <div className="text-white font-semibold">In Wishlist</div>
                            <div className="text-sm text-amber-500/80 mt-2">
                                {stats.wishlistMovies} movies • {stats.wishlistSeries} series
                            </div>
                        </div>

                        <div className="futuristic-card p-6 text-center">
                            <div className="text-4xl font-bold text-amber-500 mb-2">
                                {stats.seriesInProgress}
                            </div>
                            <div className="text-white font-semibold">Series In Progress</div>
                            <div className="text-sm text-amber-500/80 mt-2">
                                {stats.completedSeries} completed
                            </div>
                        </div>

                        <div className="futuristic-card p-6 text-center">
                            <div className="text-4xl font-bold text-amber-500 mb-2">
                                {stats.totalEpisodesWatched}
                            </div>
                            <div className="text-white font-semibold">Episodes Watched</div>
                            <div className="text-sm text-amber-500/80 mt-2">
                                Across all series
                            </div>
                        </div>
                    </div>

                    {/* Upcoming Section - Combined */}
                    {loadingUpcoming ? (
                        <div className="futuristic-card p-6 border-2 border-amber-500/50">
                            <h2 className="text-2xl font-bold mb-4 text-amber-500 flex items-center gap-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Upcoming
                            </h2>
                            <div className="flex justify-center py-8">
                                <LoadingSpinner size="md" text="Loading upcoming content..." />
                            </div>
                        </div>
                    ) : (upcomingEpisodes.length > 0 || upcomingWishlistMovies.length > 0) && (() => {
                        // Group episodes by series
                        const seriesMap = {};
                        
                        // Add episodes to series map
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
                        
                        // Sort episodes within each series by air date
                        Object.values(seriesMap).forEach(series => {
                            series.episodes.sort((a, b) => new Date(a.airDate) - new Date(b.airDate));
                        });
                        
                        // Sort series by earliest upcoming episode
                        const sortedSeries = Object.values(seriesMap).sort((a, b) => {
                            const getEarliestDate = (series) => {
                                const dates = series.episodes.map(e => new Date(e.airDate)).filter(d => !isNaN(d));
                                return dates.length > 0 ? Math.min(...dates) : new Date(0);
                            };
                            return getEarliestDate(a) - getEarliestDate(b);
                        });
                        
                        const totalUpcoming = upcomingEpisodes.length + upcomingWishlistMovies.length;
                        
                        return (
                            <div className="futuristic-card p-6 border-2 border-amber-500/50">
                                <h2 className="text-2xl font-bold mb-4 text-amber-500 flex items-center gap-2">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Upcoming ({totalUpcoming})
                                </h2>
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {/* Series with episodes */}
                                    {sortedSeries.map((series) => {
                                        const isExpanded = expandedUpcomingSeries[series.seriesId];
                                        const totalItems = series.episodes.length;
                                        // Get series name from seriesDetails if not available in series object
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
                                                        <svg
                                                            className={`w-5 h-5 text-amber-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
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
                                                                {displayName || (
                                                                    <span className="text-amber-500/60 animate-pulse">Loading series name...</span>
                                                                )}
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
                                                        {/* Episodes */}
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
                                    
                                    {/* Movies */}
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
                            <h2 className="text-2xl font-bold mb-4 text-amber-500">
                                Series Progress Summary
                            </h2>
                            <div className="space-y-3">
                                {Object.entries(seriesProgress).map(([seriesId, progress]) => {
                                    const seriesInfo = seriesDetails[seriesId];
                                    
                                    // Get total seasons from TMDB (exclude specials - only season_number > 0)
                                    const totalSeasonsFromTMDB = seriesInfo?.seasons?.filter(s => s.season_number > 0).length || 0;
                                    // Get watched seasons (seasons user has progress on, exclude specials)
                                    const watchedSeasonsCount = Object.keys(progress.seasons || {}).filter(seasonNum => parseInt(seasonNum) > 0).length;
                                    // Use TMDB total if available, otherwise fallback to watched count
                                    const totalSeasons = totalSeasonsFromTMDB > 0 ? totalSeasonsFromTMDB : watchedSeasonsCount;
                                    
                                    // Count specials separately
                                    const specialsCount = seriesInfo?.seasons?.filter(s => s.season_number === 0).length || 0;
                                    const watchedSpecialsCount = Object.keys(progress.seasons || {}).filter(seasonNum => parseInt(seasonNum) === 0).length;
                                    
                                    const completedSeasons = Object.values(progress.seasons || {}).filter(
                                        season => season.completed
                                    ).length;
                                    
                                    // Calculate total episodes watched (exclude specials)
                                    const totalEpisodesWatched = Object.entries(progress.seasons || {})
                                        .filter(([seasonNum]) => parseInt(seasonNum) > 0) // Exclude specials
                                        .reduce((total, [, season]) => total + (season.episodes?.length || 0), 0);
                                    
                                    // Calculate progress using shared utility (excludes specials automatically)
                                    const seriesProgressData = calculateSeriesProgress(progress, seriesInfo?.seasons, {});
                                    
                                    return (
                                        <a 
                                            key={seriesId} 
                                            href={`/series/${seriesId}`}
                                            className="flex items-center justify-between p-3 bg-charcoal-800/50 rounded hover:bg-charcoal-700/50 transition-colors"
                                        >
                                            <div className="flex-1">
                                                <div className="text-white font-semibold">
                                                    {seriesInfo?.name || (
                                                        <span className="text-amber-500/60 animate-pulse">Loading series...</span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-amber-500/80 mt-1">
                                                    {watchedSeasonsCount}/{totalSeasons} seasons watched • {completedSeasons} completed • {totalEpisodesWatched} episodes watched
                                                    {specialsCount > 0 && (
                                                        <span className="ml-2">• {watchedSpecialsCount}/{specialsCount} specials</span>
                                                    )}
                                                    {seriesProgressData.total > 0 && (
                                                        <span className="ml-2">• {seriesProgressData.percentage}%</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1 rounded font-semibold ${
                                                progress.completed 
                                                    ? 'bg-amber-500 text-black' 
                                                    : 'bg-charcoal-800 text-white'
                                            }`}>
                                                {progress.completed ? 'Completed' : 'In Progress'}
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Watched Tab */}
            {activeTab === 'watched' && (
                <div>
                    {watchedDetails.length === 0 ? (
                        <div className="text-center py-12 futuristic-card">
                            <p className="text-xl text-white mb-2">No watched items yet</p>
                            <p className="text-amber-500/80">Start watching and mark items as watched to see them here!</p>
                        </div>
                    ) : (
                        <>
                            {/* Filter Buttons */}
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-sm text-white/70">Filter:</span>
                                <button
                                    onClick={() => setWatchedFilter('all')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                        watchedFilter === 'all'
                                            ? 'bg-amber-500 text-black'
                                            : 'bg-charcoal-800 text-white hover:bg-charcoal-700'
                                    }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setWatchedFilter('movie')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                        watchedFilter === 'movie'
                                            ? 'bg-amber-500 text-black'
                                            : 'bg-charcoal-800 text-white hover:bg-charcoal-700'
                                    }`}
                                >
                                    Movies
                                </button>
                                <button
                                    onClick={() => setWatchedFilter('tv')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                        watchedFilter === 'tv'
                                            ? 'bg-amber-500 text-black'
                                            : 'bg-charcoal-800 text-white hover:bg-charcoal-700'
                                    }`}
                                >
                                    Series
                                </button>
                            </div>

                            {/* Filtered Items */}
                            {(() => {
                                const filteredItems = watchedDetails.filter(item => {
                                    if (watchedFilter === 'all') return true;
                                    if (watchedFilter === 'movie') return item.media_type === 'movie';
                                    if (watchedFilter === 'tv') return item.media_type === 'tv';
                                    return true;
                                });

                                if (filteredItems.length === 0) {
                                    return (
                                        <div className="text-center py-12 futuristic-card">
                                            <p className="text-xl text-white mb-2">No {watchedFilter === 'movie' ? 'movies' : watchedFilter === 'tv' ? 'series' : 'items'} watched yet</p>
                                            <p className="text-amber-500/80">Start watching {watchedFilter === 'movie' ? 'movies' : watchedFilter === 'tv' ? 'series' : 'content'} to see them here!</p>
                                        </div>
                                    );
                                }

                                return (
                                    <>
                                        <div className="mb-4 text-sm text-amber-500/80">
                                            Showing {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} 
                                            {watchedFilter !== 'all' && (
                                                <span> ({watchedDetails.length} total)</span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                            {filteredItems
                                                .sort((a, b) => {
                                                    // Sort by most recently watched first
                                                    const dateA = new Date(a.dateWatched || 0);
                                                    const dateB = new Date(b.dateWatched || 0);
                                                    return dateB - dateA;
                                                })
                                                .map((item) => {
                                                    const href = item.media_type === 'movie' 
                                                        ? `/movies/${item.id}` 
                                                        : `/series/${item.id}`;
                                                    
                                                    return (
                                                        <div key={`${item.media_type}-${item.id}`} className="relative">
                                                            <ContentCard
                                                                item={item}
                                                                mediaType={item.media_type}
                                                                href={href}
                                                            />
                                                            <div className="absolute top-2 right-2 bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded z-20">
                                                                {item.timesWatched}x
                                                            </div>
                                                            {item.dateWatched && (
                                                                <div className="absolute bottom-2 right-2 bg-charcoal-800/90 text-white text-[8px] px-1.5 py-0.5 rounded z-20">
                                                                    {new Date(item.dateWatched).toLocaleDateString()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </>
                                );
                            })()}
                        </>
                    )}
                </div>
            )}

            {/* Wishlist Tab */}
            {activeTab === 'wishlist' && (
                <div>
                    {loadingWishlistDetails ? (
                        <div className="flex justify-center py-12">
                            <LoadingSpinner size="lg" text="Loading wishlist content..." />
                        </div>
                    ) : wishlistDetails.length === 0 ? (
                        <div className="text-center py-12 futuristic-card">
                            <p className="text-xl text-white mb-2">Your wishlist is empty</p>
                            <p className="text-amber-500/80">Add movies and series to your wishlist to see them here!</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 text-sm text-amber-500/80">
                                Showing {wishlistDetails.length} {wishlistDetails.length === 1 ? 'item' : 'items'} in wishlist
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {wishlistDetails
                                    .sort((a, b) => {
                                        // Sort by most recently added first
                                        const dateA = new Date(a.dateAdded || 0);
                                        const dateB = new Date(b.dateAdded || 0);
                                        return dateB - dateA;
                                    })
                                    .map((item) => {
                                        const href = item.media_type === 'movie' 
                                            ? `/movies/${item.id}` 
                                            : `/series/${item.id}`;
                                        
                                        return (
                                            <div key={`${item.media_type}-${item.id}`} className="relative">
                                                <ContentCard
                                                    item={item}
                                                    mediaType={item.media_type}
                                                    href={href}
                                                />
                                                {item.dateAdded && (
                                                    <div className="absolute bottom-2 right-2 bg-charcoal-800/90 text-white text-[8px] px-1.5 py-0.5 rounded z-20">
                                                        Added {new Date(item.dateAdded).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Series Progress Tab */}
            {activeTab === 'series' && (
                <div>
                    {Object.keys(seriesProgress).length === 0 ? (
                        <div className="text-center py-12 futuristic-card">
                            <p className="text-xl text-white mb-2">No series in progress</p>
                            <p className="text-amber-500/80">Start watching a series and track your progress!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(seriesProgress).map(([seriesId, progress]) => {
                                const seriesInfo = seriesDetails[seriesId];
                                const isExpanded = expandedSeries[seriesId];
                                
                                // Get total seasons from TMDB (exclude specials - only season_number > 0)
                                const totalSeasonsFromTMDB = seriesInfo?.seasons?.filter(s => s.season_number > 0).length || 0;
                                // Get watched seasons (seasons user has progress on, exclude specials)
                                const watchedSeasonsCount = Object.keys(progress.seasons || {}).filter(seasonNum => parseInt(seasonNum) > 0).length;
                                // Use TMDB total if available, otherwise fallback to watched count
                                const totalSeasons = totalSeasonsFromTMDB > 0 ? totalSeasonsFromTMDB : watchedSeasonsCount;
                                
                                // Count specials separately
                                const specialsCount = seriesInfo?.seasons?.filter(s => s.season_number === 0).length || 0;
                                const watchedSpecialsCount = Object.keys(progress.seasons || {}).filter(seasonNum => parseInt(seasonNum) === 0).length;
                                
                                const completedSeasons = Object.values(progress.seasons || {}).filter(
                                    season => season.completed
                                ).length;
                                // Calculate total episodes watched (exclude specials)
                                const totalEpisodesWatched = Object.entries(progress.seasons || {})
                                    .filter(([seasonNum]) => parseInt(seasonNum) > 0) // Exclude specials
                                    .reduce((total, [, season]) => total + (season.episodes?.length || 0), 0);

                                // Calculate progress percentage using shared utility
                                const getSeriesOverallProgress = () => {
                                    return calculateSeriesProgress(progress, seriesInfo?.seasons, seriesSeasonDetails[seriesId]);
                                };

                                const overallProgress = getSeriesOverallProgress();

                                // Toggle series expansion and fetch season details
                                const toggleSeries = async () => {
                                    if (isExpanded) {
                                        setExpandedSeries(prev => ({ ...prev, [seriesId]: false }));
                                    } else {
                                        setExpandedSeries(prev => ({ ...prev, [seriesId]: true }));
                                        
                                        // Fetch season details for all seasons the user is watching
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

                                // Get season progress using shared utility
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
                                                                    ></div>
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
                                                <svg
                                                    className={`w-6 h-6 text-amber-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                        
                                        {isExpanded && (
                                            <div className="space-y-3 mt-4 border-t border-charcoal-700 pt-4">
                                                {/* Regular Seasons */}
                                                {Object.entries(progress.seasons || {})
                                                    .filter(([seasonNum]) => parseInt(seasonNum) > 0)
                                                    .map(([seasonNum, season]) => {
                                                    const seasonProgress = getSeasonProgress(parseInt(seasonNum));
                                                    const seasonData = seriesSeasonDetails[seriesId]?.[parseInt(seasonNum)];
                                                    const seasonFromSeries = seriesInfo?.seasons?.find(s => s.season_number === parseInt(seasonNum));
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
                                                                                ></div>
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
                                                            
                                                            {/* Episodes List */}
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
                                                                                <span className="font-semibold w-8">
                                                                                    E{episode.episode_number}
                                                                                </span>
                                                                                <span className={`flex-1 ${isWatched ? '' : 'opacity-50'}`}>
                                                                                    {episode.name || `Episode ${episode.episode_number}`}
                                                                                </span>
                                                                                {isWatched && (
                                                                                    <span className="text-amber-500">✓</span>
                                                                                )}
                                                                                {isUpcoming && (
                                                                                    <span className="text-red-400 text-[10px]">Upcoming</span>
                                                                                )}
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
                                                                <div className="text-xs text-white/40 mt-2">
                                                                    No episode data available
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                
                                                {/* Specials Section */}
                                                {Object.entries(progress.seasons || {})
                                                    .filter(([seasonNum]) => parseInt(seasonNum) === 0)
                                                    .length > 0 && (
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
                                                                                            ></div>
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
                                                                        
                                                                        {/* Episodes List */}
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
                                                                                            <span className="font-semibold w-8">
                                                                                                E{episode.episode_number}
                                                                                            </span>
                                                                                            <span className={`flex-1 ${isWatched ? '' : 'opacity-50'}`}>
                                                                                                {episode.name || `Episode ${episode.episode_number}`}
                                                                                            </span>
                                                                                            {isWatched && (
                                                                                                <span className="text-amber-500">✓</span>
                                                                                            )}
                                                                                            {isUpcoming && (
                                                                                                <span className="text-red-400 text-[10px]">Upcoming</span>
                                                                                            )}
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
                                                                            <div className="text-xs text-white/40 mt-2">
                                                                                No episode data available
                                                                            </div>
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
                    )}
                </div>
            )}

            {/* Lists Tab */}
            {activeTab === 'lists' && (
                <div>
                    {customLists.length === 0 ? (
                        <div className="text-center py-12 futuristic-card">
                            <p className="text-xl text-white mb-2">No custom lists yet</p>
                            <p className="text-amber-500/80">Create lists and add movies/series to organize your content!</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {customLists.map((list) => {
                                const items = listDetails[list.id] || [];
                                return (
                                    <div key={list.id} className="futuristic-card p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-amber-500">
                                                    {list.name}
                                                </h3>
                                                <p className="text-sm text-white/70 mt-1">
                                                    {items.length} {items.length === 1 ? 'item' : 'items'} • Created {formatDate(list.createdAt)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Delete "${list.name}"?`)) {
                                                        // TODO: Delete list via API
                                                        loadUserData();
                                                    }
                                                }}
                                                className="futuristic-button text-sm bg-red-600 hover:bg-red-500"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                        {items.length === 0 ? (
                                            <p className="text-white/60 text-center py-4">This list is empty</p>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                                {items.map((item) => {
                                                    const href = item.media_type === 'movie' 
                                                        ? `/movies/${item.id}` 
                                                        : `/series/${item.id}`;
                                                    
                                                    return (
                                                        <div key={`${item.media_type}-${item.id}`} className="relative">
                                                            <ContentCard
                                                                item={item}
                                                                mediaType={item.media_type}
                                                                href={href}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="space-y-6">
                    {/* Change Display Name */}
                    <div className="futuristic-card p-6">
                        <h2 className="text-2xl font-bold mb-4 text-amber-500">
                            Profile Settings
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-white font-semibold mb-2">
                                    Display Name (Tag)
                                </label>
                                <div className="flex gap-4">
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="flex-1 px-4 py-2 bg-charcoal-900/50 border border-charcoal-700/50 rounded text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                                        placeholder="Enter your display name"
                                    />
                                    <button
                                        onClick={async () => {
                                            if (!displayName.trim()) {
                                                alert('Display name cannot be empty');
                                                return;
                                            }
                                            setIsUpdating(true);
                                            try {
                                                const response = await fetch('/api/user/profile', {
                                                    method: 'PUT',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                    },
                                                    credentials: 'include',
                                                    body: JSON.stringify({ display_name: displayName.trim() }),
                                                });

                                                if (response.ok) {
                                                    await checkAuthStatus();
                                                    alert('Display name updated successfully!');
                                                } else {
                                                    const error = await response.json();
                                                    alert(error.error || 'Failed to update display name');
                                                }
                                            } catch (error) {
                                                console.error('Error updating display name:', error);
                                                alert('Error updating display name');
                                            } finally {
                                                setIsUpdating(false);
                                            }
                                        }}
                                        disabled={isUpdating}
                                        className="futuristic-button-yellow px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isUpdating ? 'Updating...' : 'Update'}
                                    </button>
                                </div>
                                <p className="text-sm text-amber-500/80 mt-2">
                                    This is how your name will appear on your profile
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Account Actions */}
                    <div className="futuristic-card p-6">
                        <h2 className="text-2xl font-bold mb-4 text-amber-500">
                            Account Actions
                        </h2>
                        <div className="space-y-4">
                            <button
                                onClick={() => setShowSignOutModal(true)}
                                className="w-full futuristic-button px-4 py-3 text-left flex items-center gap-3"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Sign Out</span>
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="w-full px-4 py-3 text-left flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Delete Account</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modals */}
            <ConfirmationModal
                isOpen={showSignOutModal}
                onClose={() => setShowSignOutModal(false)}
                onConfirm={async () => {
                    setShowSignOutModal(false);
                    await signOut();
                    router.push('/');
                    router.refresh();
                }}
                title="Sign Out"
                message="Are you sure you want to sign out?"
                confirmText="Sign Out"
                cancelText="Cancel"
            />
            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={async () => {
                    setShowDeleteModal(false);
                    setIsDeleting(true);
                    try {
                        const response = await fetch('/api/user/delete', {
                            method: 'DELETE',
                            credentials: 'include',
                        });

                        if (response.ok) {
                            await signOut();
                            router.push('/');
                            router.refresh();
                            alert('Your account has been deleted successfully.');
                        } else {
                            const error = await response.json();
                            alert(error.error || 'Failed to delete account');
                        }
                    } catch (error) {
                        console.error('Error deleting account:', error);
                        alert('Error deleting account');
                    } finally {
                        setIsDeleting(false);
                    }
                }}
                title="Delete Account"
                message="Are you sure you want to delete your account? This action cannot be undone. All your data including watched content, wishlist, and lists will be permanently deleted."
                confirmText="Delete Account"
                cancelText="Cancel"
                isDanger={true}
            />
        </div>
    );
};

// Main component with Suspense boundary
const ProfilePage = () => {
    return (
        <Suspense fallback={
            <div className="page-container">
                <h1 className="page-title">Profile</h1>
                <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" />
                </div>
            </div>
        }>
            <ProfilePageContent />
        </Suspense>
    );
};

export default ProfilePage;

