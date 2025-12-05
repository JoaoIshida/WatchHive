"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import ContentCard from '../components/ContentCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate } from '../utils/dateFormatter';

const ProfilePage = () => {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [watched, setWatched] = useState([]);
    const [wishlist, setWishlist] = useState([]);
    const [seriesProgress, setSeriesProgress] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('stats');
    const [watchedDetails, setWatchedDetails] = useState([]);
    const [wishlistDetails, setWishlistDetails] = useState([]);
    const [seriesDetails, setSeriesDetails] = useState({});
    const [customLists, setCustomLists] = useState([]);
    const [listDetails, setListDetails] = useState({});
    const [upcomingSeasons, setUpcomingSeasons] = useState([]);
    const [dbStats, setDbStats] = useState(null);

    useEffect(() => {
        // Wait for auth to load, then check if user is authenticated
        if (authLoading) return;
        
        if (!user) {
            setLoading(false);
            return;
        }

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

            // Load from Supabase via API
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

            // Fetch details for watched items
            if (watchedItems.length > 0) {
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
            }

            // Fetch details for wishlist items
            if (wishlistItems.length > 0) {
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
            }

            // Fetch series details for progress display
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
                setSeriesDetails(seriesMap);

                // Check for upcoming seasons
                const upcomingSeasonsList = [];
                for (const seriesId of seriesIds) {
                    try {
                        const response = await fetch(`/api/content/tv/${seriesId}`);
                        if (response.ok) {
                            const seriesData = await response.json();
                            const progressData = seriesProgressData[seriesId];
                            
                            // Check for upcoming seasons
                            if (seriesData.seasons) {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                
                                seriesData.seasons.forEach(season => {
                                    if (season.air_date) {
                                        const airDate = new Date(season.air_date);
                                        airDate.setHours(0, 0, 0, 0);
                                        
                                        // Check if season is upcoming (future date) and not watched
                                        if (airDate > today) {
                                            const watchedSeasons = Object.keys(progressData?.seasons || {});
                                            const isWatched = watchedSeasons.includes(String(season.season_number));
                                            
                                            if (!isWatched) {
                                                upcomingSeasonsList.push({
                                                    seriesId,
                                                    seriesName: seriesData.name,
                                                    seasonNumber: season.season_number,
                                                    seasonName: season.name,
                                                    airDate: season.air_date,
                                                    episodeCount: season.episode_count,
                                                });
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        console.error(`Error checking upcoming seasons for series ${seriesId}:`, error);
                    }
                }
                
                // Sort upcoming seasons by air date
                upcomingSeasonsList.sort((a, b) => new Date(a.airDate) - new Date(b.airDate));
                setUpcomingSeasons(upcomingSeasonsList);
            }
            
            // TODO: Load custom lists details from Supabase
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
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
                    <p className="text-futuristic-yellow-400/80 mb-6">Sign in to track your watched content, wishlist, and more!</p>
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
            <div className="flex flex-wrap gap-2 mb-6 border-b border-futuristic-blue-500/30">
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'stats'
                            ? 'text-futuristic-yellow-400 border-b-2 border-futuristic-yellow-400'
                            : 'text-white hover:text-futuristic-yellow-400'
                    }`}
                >
                    Statistics
                </button>
                <button
                    onClick={() => setActiveTab('watched')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'watched'
                            ? 'text-futuristic-yellow-400 border-b-2 border-futuristic-yellow-400'
                            : 'text-white hover:text-futuristic-yellow-400'
                    }`}
                >
                    Watched ({stats.totalWatched})
                </button>
                <button
                    onClick={() => setActiveTab('wishlist')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'wishlist'
                            ? 'text-futuristic-yellow-400 border-b-2 border-futuristic-yellow-400'
                            : 'text-white hover:text-futuristic-yellow-400'
                    }`}
                >
                    Wishlist ({stats.totalWishlist})
                </button>
                <button
                    onClick={() => setActiveTab('series')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'series'
                            ? 'text-futuristic-yellow-400 border-b-2 border-futuristic-yellow-400'
                            : 'text-white hover:text-futuristic-yellow-400'
                    }`}
                >
                    Series Progress
                </button>
                <button
                    onClick={() => setActiveTab('lists')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        activeTab === 'lists'
                            ? 'text-futuristic-yellow-400 border-b-2 border-futuristic-yellow-400'
                            : 'text-white hover:text-futuristic-yellow-400'
                    }`}
                >
                    Lists ({stats.totalLists})
                </button>
            </div>

            {/* Stats Tab */}
            {activeTab === 'stats' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="futuristic-card p-6 text-center">
                            <div className="text-4xl font-bold text-futuristic-yellow-400 mb-2">
                                {stats.totalWatched}
                            </div>
                            <div className="text-white font-semibold">Total Watched</div>
                            <div className="text-sm text-futuristic-yellow-400/80 mt-2">
                                {stats.watchedMovies} movies • {stats.watchedSeries} series
                            </div>
                        </div>

                        <div className="futuristic-card p-6 text-center">
                            <div className="text-4xl font-bold text-futuristic-yellow-400 mb-2">
                                {stats.totalWishlist}
                            </div>
                            <div className="text-white font-semibold">In Wishlist</div>
                            <div className="text-sm text-futuristic-yellow-400/80 mt-2">
                                {stats.wishlistMovies} movies • {stats.wishlistSeries} series
                            </div>
                        </div>

                        <div className="futuristic-card p-6 text-center">
                            <div className="text-4xl font-bold text-futuristic-yellow-400 mb-2">
                                {stats.seriesInProgress}
                            </div>
                            <div className="text-white font-semibold">Series In Progress</div>
                            <div className="text-sm text-futuristic-yellow-400/80 mt-2">
                                {stats.completedSeries} completed
                            </div>
                        </div>

                        <div className="futuristic-card p-6 text-center">
                            <div className="text-4xl font-bold text-futuristic-yellow-400 mb-2">
                                {stats.totalEpisodesWatched}
                            </div>
                            <div className="text-white font-semibold">Episodes Watched</div>
                            <div className="text-sm text-futuristic-yellow-400/80 mt-2">
                                Across all series
                            </div>
                        </div>
                    </div>

                    {/* Upcoming Seasons Alert */}
                    {upcomingSeasons.length > 0 && (
                        <div className="futuristic-card p-6 border-2 border-futuristic-yellow-500/50">
                            <h2 className="text-2xl font-bold mb-4 text-futuristic-yellow-400 futuristic-text-glow-yellow flex items-center gap-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Upcoming Seasons ({upcomingSeasons.length})
                            </h2>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {upcomingSeasons.slice(0, 10).map((upcoming, index) => (
                                    <a
                                        key={index}
                                        href={`/series/${upcoming.seriesId}`}
                                        className="flex items-center justify-between p-3 bg-futuristic-blue-800/50 rounded hover:bg-futuristic-blue-700/50 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="text-white font-semibold">
                                                {upcoming.seriesName}
                                            </div>
                                            <div className="text-sm text-futuristic-yellow-400/80">
                                                {upcoming.seasonName || `Season ${upcoming.seasonNumber}`} • {upcoming.episodeCount} episodes
                                            </div>
                                        </div>
                                        <div className="text-futuristic-yellow-400 font-semibold text-sm">
                                            {formatDate(upcoming.airDate)}
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Series Progress Summary */}
                    {Object.keys(seriesProgress).length > 0 && (
                        <div className="futuristic-card p-6">
                            <h2 className="text-2xl font-bold mb-4 text-futuristic-yellow-400 futuristic-text-glow-yellow">
                                Series Progress Summary
                            </h2>
                            <div className="space-y-3">
                                {Object.entries(seriesProgress).map(([seriesId, progress]) => {
                                    const seriesInfo = seriesDetails[seriesId];
                                    const totalSeasons = Object.keys(progress.seasons || {}).length;
                                    const completedSeasons = Object.values(progress.seasons || {}).filter(
                                        season => season.completed
                                    ).length;
                                    
                                    return (
                                        <a 
                                            key={seriesId} 
                                            href={`/series/${seriesId}`}
                                            className="flex items-center justify-between p-3 bg-futuristic-blue-800/50 rounded hover:bg-futuristic-blue-700/50 transition-colors"
                                        >
                                            <div>
                                                <div className="text-white font-semibold">
                                                    {seriesInfo?.name || `Series ID: ${seriesId}`}
                                                </div>
                                                <div className="text-sm text-futuristic-yellow-400/80">
                                                    {completedSeasons}/{totalSeasons} seasons completed
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1 rounded font-semibold ${
                                                progress.completed 
                                                    ? 'bg-futuristic-yellow-500 text-black' 
                                                    : 'bg-futuristic-blue-600 text-white'
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
                            <p className="text-futuristic-yellow-400/80">Start watching and mark items as watched to see them here!</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 text-sm text-futuristic-yellow-400/80">
                                Showing {watchedDetails.length} watched {watchedDetails.length === 1 ? 'item' : 'items'}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {watchedDetails
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
                                                <div className="absolute top-2 right-2 bg-futuristic-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded z-20">
                                                    {item.timesWatched}x
                                                </div>
                                                {item.dateWatched && (
                                                    <div className="absolute bottom-2 right-2 bg-futuristic-blue-800/90 text-white text-[8px] px-1.5 py-0.5 rounded z-20">
                                                        {new Date(item.dateWatched).toLocaleDateString()}
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

            {/* Wishlist Tab */}
            {activeTab === 'wishlist' && (
                <div>
                    {wishlistDetails.length === 0 ? (
                        <div className="text-center py-12 futuristic-card">
                            <p className="text-xl text-white mb-2">Your wishlist is empty</p>
                            <p className="text-futuristic-yellow-400/80">Add movies and series to your wishlist to see them here!</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 text-sm text-futuristic-yellow-400/80">
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
                                                    <div className="absolute bottom-2 right-2 bg-futuristic-blue-800/90 text-white text-[8px] px-1.5 py-0.5 rounded z-20">
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
                            <p className="text-futuristic-yellow-400/80">Start watching a series and track your progress!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(seriesProgress).map(([seriesId, progress]) => {
                                const totalSeasons = Object.keys(progress.seasons || {}).length;
                                const completedSeasons = Object.values(progress.seasons || {}).filter(
                                    season => season.completed
                                ).length;
                                const totalEpisodes = Object.values(progress.seasons || {}).reduce(
                                    (total, season) => total + (season.episodes?.length || 0), 0
                                );

                                return (
                                    <div key={seriesId} className="futuristic-card p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-white">
                                                    <a href={`/series/${seriesId}`} className="hover:text-futuristic-yellow-400 transition-colors">
                                                        {seriesDetails[seriesId]?.name || `Series ID: ${seriesId}`}
                                                    </a>
                                                </h3>
                                                <p className="text-sm text-futuristic-yellow-400/80">
                                                    {completedSeasons}/{totalSeasons} seasons • {totalEpisodes} episodes watched
                                                </p>
                                            </div>
                                            <a 
                                                href={`/series/${seriesId}`}
                                                className="futuristic-button text-sm"
                                            >
                                                View Series
                                            </a>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            {Object.entries(progress.seasons || {}).map(([seasonNum, season]) => (
                                                <div key={seasonNum} className="bg-futuristic-blue-800/50 p-3 rounded">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-white font-semibold">Season {seasonNum}</span>
                                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                            season.completed 
                                                                ? 'bg-futuristic-yellow-500 text-black' 
                                                                : 'bg-futuristic-blue-600 text-white'
                                                        }`}>
                                                            {season.completed ? 'Completed' : `${season.episodes?.length || 0} episodes watched`}
                                                        </span>
                                                    </div>
                                                    {season.episodes && season.episodes.length > 0 && (
                                                        <div className="text-xs text-futuristic-yellow-400/80">
                                                            Episodes: {season.episodes.sort((a, b) => a - b).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
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
                            <p className="text-futuristic-yellow-400/80">Create lists and add movies/series to organize your content!</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {customLists.map((list) => {
                                const items = listDetails[list.id] || [];
                                return (
                                    <div key={list.id} className="futuristic-card p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-futuristic-yellow-400 futuristic-text-glow-yellow">
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
        </div>
    );
};

export default ProfilePage;

