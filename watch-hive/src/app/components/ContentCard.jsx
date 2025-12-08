"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ImageWithFallback from './ImageWithFallback';
import NewReleaseBadge from './NewReleaseBadge';
import UpcomingBadge from './UpcomingBadge';
import SeriesNotificationBadge from './SeriesNotificationBadge';
import ContentRatingBadge from './ContentRatingBadge';
import QuickActionsMenu from './QuickActionsMenu';
import { formatDate } from '../utils/dateFormatter';
import { getSeriesWatchProgress, getMovieWatchStatus } from '../utils/watchProgressHelper';
import { formatRuntime, getSeriesInfo } from '../utils/runtimeFormatter';
import { getContentType } from '../utils/contentTypeHelper';
import { isSeriesReleased, isMovieReleased } from '../utils/releaseDateValidator';

const ContentCard = ({ item, mediaType = 'movie', href }) => {
    const { user } = useAuth();
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date;
    const posterPath = item.poster_path || item.backdrop_path;
    const isSeries = mediaType === 'tv' || item.media_type === 'tv';
    
    const [watchStatus, setWatchStatus] = useState(null);
    
    useEffect(() => {
        const updateWatchStatus = async () => {
            if (!user) {
                setWatchStatus(null);
                return;
            }

            try {
                if (isSeries) {
                    // Fetch series progress
                    const [watchedRes, progressRes] = await Promise.all([
                        fetch('/api/watched'),
                        fetch(`/api/series-progress/${item.id}`),
                    ]);

                    const watched = watchedRes.ok ? (await watchedRes.json()).watched : [];
                    const isWatched = watched.some(w => w.content_id === item.id && w.media_type === 'tv');
                    const progress = progressRes.ok ? await progressRes.json() : null;

                    // Always fetch full series details to get accurate episode counts for percentage calculation
                    // The item from list views might not have complete season data with episode_count
                    let seriesDataForProgress = item;
                    // Fetch series details if we have progress OR if item doesn't have seasons/episode_count
                    const needsSeriesDetails = progress || !item.seasons || !item.seasons.some(s => s.episode_count);
                    if (needsSeriesDetails) {
                        try {
                            const detailsRes = await fetch(`/api/tv/${item.id}`);
                            if (detailsRes.ok) {
                                seriesDataForProgress = await detailsRes.json();
                                
                                // For completed seasons, fetch episode data to accurately count released episodes
                                // This ensures we count only released episodes, not all episodes including unreleased
                                if (seriesDataForProgress.seasons && progress.seasons) {
                                    const seasonPromises = Object.keys(progress.seasons).map(async (seasonNum) => {
                                        const seasonProgress = progress.seasons[seasonNum];
                                        // Only fetch if season is completed (we need episode data to count released episodes)
                                        if (seasonProgress.completed) {
                                            try {
                                                const seasonRes = await fetch(`/api/tv/${item.id}/season/${seasonNum}`);
                                                if (seasonRes.ok) {
                                                    const seasonData = await seasonRes.json();
                                                    // Find and update the season in seriesDataForProgress
                                                    const seasonIndex = seriesDataForProgress.seasons.findIndex(
                                                        s => s.season_number === parseInt(seasonNum)
                                                    );
                                                    if (seasonIndex !== -1) {
                                                        // Preserve episode_count if it exists in original season data
                                                        const originalSeason = seriesDataForProgress.seasons[seasonIndex];
                                                        seriesDataForProgress.seasons[seasonIndex] = {
                                                            ...seasonData,
                                                            // Preserve episode_count - use seasonData's count, or original, or calculate from episodes
                                                            episode_count: seasonData.episode_count || originalSeason?.episode_count || (seasonData.episodes?.length || 0)
                                                        };
                                                    }
                                                }
                                            } catch (err) {
                                                // Silently fail - we'll use progress.episodes as fallback
                                            }
                                        }
                                    });
                                    await Promise.all(seasonPromises);
                                }
                            }
                        } catch (err) {
                            console.error('Error fetching series details for progress:', err);
                        }
                    }

                    const calculatedStatus = getSeriesWatchProgress(item.id, seriesDataForProgress, progress, isWatched);
                    // console.log(`[ContentCard] Series ${item.id} (${item.name || item.title}):`, {
                    //     watchStatus: calculatedStatus,
                    //     hasPercentage: calculatedStatus.percentage > 0,
                    //     willShowPercentage: calculatedStatus.percentage > 0,
                    //     seriesDataHasSeasons: !!seriesDataForProgress?.seasons,
                    //     seriesDataSeasonsCount: seriesDataForProgress?.seasons?.length || 0,
                    //     progressHasSeasons: !!progress?.seasons,
                    //     progressSeasonsCount: progress?.seasons ? Object.keys(progress.seasons).length : 0
                    // });
                    setWatchStatus(calculatedStatus);
                } else {
                    // Fetch watched status
                    const watchedRes = await fetch('/api/watched');
                    if (watchedRes.ok) {
                        const { watched } = await watchedRes.json();
                        const watchedItem = watched.find(w => w.content_id === item.id && w.media_type === 'movie');
                        setWatchStatus(getMovieWatchStatus(item.id, watchedItem));
                    }
                }
            } catch (error) {
                console.error('Error loading watch status:', error);
            }
        };
        
        updateWatchStatus();
        
        // Listen for watch status changes
        const handleUpdate = () => updateWatchStatus();
        window.addEventListener('watchhive-data-updated', handleUpdate);
        
        return () => {
            window.removeEventListener('watchhive-data-updated', handleUpdate);
        };
    }, [item.id, item, isSeries, user]);

    // Only show watched border if content is released
    const isReleased = isSeries ? isSeriesReleased(item) : isMovieReleased(item);
    const showWatchedBorder = watchStatus?.isWatched && isReleased;
    
    return (
        <div className="block relative group">
            <a href={href} className="block">
                <div className={`futuristic-card overflow-hidden ${showWatchedBorder ? 'border-2 border-futuristic-yellow-500 shadow-glow-yellow' : ''}`}>
                    <div className="relative aspect-[2/3] overflow-hidden bg-futuristic-blue-900">
                        <ImageWithFallback
                            src={posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null}
                            alt={title}
                            className="object-cover w-full h-full hover:scale-110 transition-transform duration-300"
                        />
                        
                        {/* New Release Badge */}
                        <NewReleaseBadge releaseDate={releaseDate} />
                        
                        {/* Upcoming Badge */}
                        {!isSeries && <UpcomingBadge releaseDate={releaseDate} />}
                        
                        {/* Series Notification Badge */}
                        {isSeries && (
                            <SeriesNotificationBadge
                                seriesId={item.id}
                                lastAirDate={item.last_air_date}
                                status={item.status}
                                numberOfSeasons={item.number_of_seasons}
                            />
                        )}
                        
                        {/* Content Type Badge - Left side (opposite to 3-dot menu) */}
                        <div className="absolute top-1 left-1 bg-futuristic-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-glow-blue z-10">
                            {getContentType(item, mediaType)}
                        </div>
                        
                        {/* Rating Badge - Circular */}
                        {item.vote_average && item.vote_average > 0 && (
                            <div className="absolute bottom-2 left-2 w-10 h-10 bg-futuristic-yellow-500 text-black text-xs font-bold rounded-full flex items-center justify-center shadow-glow-yellow z-10 border-2 border-black/20">
                                {item.vote_average.toFixed(1)}
                            </div>
                        )}
                        
                    </div>
                    {/* Card Info Section - Fixed height for consistent card sizes */}
                    <div className="p-2 bg-futuristic-blue-900/80 min-h-[72px] flex flex-col justify-between">
                        <div className="flex items-start gap-2 mb-1">
                            <h2 className="text-xs font-semibold text-white line-clamp-2 flex-1">{title}</h2>
                            <ContentRatingBadge item={item} mediaType={mediaType} size="small" className="flex-shrink-0" />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                {releaseDate && (
                                    <p className="text-[10px] text-futuristic-yellow-400/80">{formatDate(releaseDate)}</p>
                                )}
                                {!isSeries && item.runtime && (
                                    <p className="text-[10px] text-futuristic-yellow-400/80">• {formatRuntime(item.runtime)}</p>
                                )}
                                {isSeries && getSeriesInfo(item) && (
                                    <p className="text-[10px] text-futuristic-yellow-400/80">• {getSeriesInfo(item)}</p>
                                )}
                            </div>
                            {/* Watch Status with Eye Icon */}
                            {isSeries && watchStatus && isReleased && watchStatus.percentage > 0 && (
                                <>
                                    {/* DEBUG: Temporary UI element to show raw percentage value */}
                                    {/* {process.env.NODE_ENV === 'development' && watchStatus.totalEpisodes > 0 && (
                                        <div className="ml-auto text-[8px] text-red-400 bg-black/50 px-1 rounded" title={`Debug: percentage=${watchStatus.percentage}, watched=${watchStatus.watchedEpisodes}, total=${watchStatus.totalEpisodes}`}>
                                            {watchStatus.percentage}% ({watchStatus.watchedEpisodes}/{watchStatus.totalEpisodes})
                                        </div>
                                    )} */}
                                    {watchStatus.percentage > 0 && (
                                        <div className="flex items-center gap-1 ml-auto bg-futuristic-yellow-500/30 border border-futuristic-yellow-500/40 px-1.5 py-0.5 rounded shadow-sm">
                                            <svg className="w-3 h-3 text-futuristic-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-[10px] text-futuristic-yellow-300 font-bold">
                                                {watchStatus.percentage}%
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                            {!isSeries && watchStatus?.isWatched && (
                                <div className="flex items-center gap-1 ml-auto bg-futuristic-yellow-500/30 border border-futuristic-yellow-500/40 px-1.5 py-0.5 rounded shadow-sm">
                                    <svg className="w-3 h-3 text-futuristic-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                    <svg className="w-3 h-3 text-futuristic-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </a>
            
            {/* Quick Actions Menu - Always visible */}
            <div className="absolute top-0 right-0 z-20">
                <QuickActionsMenu 
                    itemId={item.id} 
                    mediaType={mediaType} 
                    itemData={item}
                />
            </div>
        </div>
    );
};

export default ContentCard;

