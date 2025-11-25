"use client";
import { useState, useEffect } from 'react';
import { watchedStorage, wishlistStorage, seriesProgressStorage } from '../lib/localStorage';
import ContentCard from '../components/ContentCard';
import LoadingSpinner from '../components/LoadingSpinner';

const ProfilePage = () => {
    const [watched, setWatched] = useState([]);
    const [wishlist, setWishlist] = useState([]);
    const [seriesProgress, setSeriesProgress] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('stats');
    const [watchedDetails, setWatchedDetails] = useState([]);
    const [wishlistDetails, setWishlistDetails] = useState([]);
    const [seriesDetails, setSeriesDetails] = useState({});

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        setLoading(true);
        try {
            // Load from localStorage
            const watchedItems = watchedStorage.getAll();
            const wishlistItems = wishlistStorage.getAll();
            const progress = seriesProgressStorage.getAll();

            setWatched(watchedItems);
            setWishlist(wishlistItems);
            setSeriesProgress(progress);

            // Fetch details for watched items
            if (watchedItems.length > 0) {
                const watchedDetailsPromises = watchedItems.map(async (item) => {
                    try {
                        const response = await fetch(`/api/content/${item.mediaType}/${item.id}`);
                        if (response.ok) {
                            const data = await response.json();
                            return { ...data, media_type: item.mediaType, timesWatched: item.timesWatched, dateWatched: item.dateWatched };
                        }
                    } catch (error) {
                        console.error(`Error fetching ${item.mediaType} ${item.id}:`, error);
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
                        const response = await fetch(`/api/content/${item.mediaType}/${item.id}`);
                        if (response.ok) {
                            const data = await response.json();
                            return { ...data, media_type: item.mediaType, dateAdded: item.dateAdded };
                        }
                    } catch (error) {
                        console.error(`Error fetching ${item.mediaType} ${item.id}:`, error);
                    }
                    return null;
                });
                const details = await Promise.all(wishlistDetailsPromises);
                setWishlistDetails(details.filter(item => item !== null));
            }

            // Fetch series details for progress display
            const seriesIds = Object.keys(progress);
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
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStats = () => {
        const watchedMovies = watched.filter(w => w.mediaType === 'movie').length;
        const watchedSeries = watched.filter(w => w.mediaType === 'tv').length;
        const wishlistMovies = wishlist.filter(w => w.mediaType === 'movie').length;
        const wishlistSeries = wishlist.filter(w => w.mediaType === 'tv').length;
        
        const seriesInProgress = Object.keys(seriesProgress).filter(seriesId => {
            const progress = seriesProgressStorage.getSeriesProgress(seriesId);
            return !progress.completed && Object.keys(progress.seasons).length > 0;
        }).length;
        
        const completedSeries = Object.keys(seriesProgress).filter(seriesId => {
            return seriesProgressStorage.isSeriesCompleted(seriesId);
        }).length;

        const totalEpisodesWatched = Object.values(seriesProgress).reduce((total, progress) => {
            return total + Object.values(progress.seasons || {}).reduce((seasonTotal, season) => {
                return seasonTotal + (season.episodes?.length || 0);
            }, 0);
        }, 0);

        return {
            totalWatched: watched.length,
            watchedMovies,
            watchedSeries,
            totalWishlist: wishlist.length,
            wishlistMovies,
            wishlistSeries,
            seriesInProgress,
            completedSeries,
            totalEpisodesWatched,
        };
    };

    const stats = getStats();

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">Profile</h1>
                <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-4xl font-bold text-futuristic-yellow-400 futuristic-text-glow-yellow">My Profile</h1>
                <button
                    onClick={loadUserData}
                    className="futuristic-button"
                    title="Refresh data"
                >
                    🔄 Refresh
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
        </div>
    );
};

export default ProfilePage;

