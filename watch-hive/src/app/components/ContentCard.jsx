"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
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
    const { watched, seriesProgress, seriesDetails: contextSeriesDetails } = useUserData();
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date;
    const posterPath = item.poster_path || item.backdrop_path;
    const isSeries = mediaType === 'tv' || item.media_type === 'tv';
    
    const [watchStatus, setWatchStatus] = useState(null);
    
    useEffect(() => {
        if (!user) {
            setWatchStatus(null);
            return;
        }

        if (isSeries) {
            const isWatched = watched.some(w => w.content_id === item.id && w.media_type === 'tv');
            const progress = seriesProgress[item.id] || null;

            // Use context series details if available, otherwise fall back to prop item
            const contextData = contextSeriesDetails[item.id];
            let seriesDataForProgress = contextData || item;
            const needsDetailsFetch = progress && !contextData && (!item.seasons || !item.seasons.some(s => s.episode_count));

            if (needsDetailsFetch) {
                // Only fetch when we have progress but no season data anywhere
                const fetchAndCalc = async () => {
                    try {
                        const detailsRes = await fetch(`/api/tv/${item.id}`);
                        if (detailsRes.ok) {
                            const data = await detailsRes.json();
                            seriesDataForProgress = data;

                            if (data.seasons && progress?.seasons) {
                                const seasonPromises = Object.keys(progress.seasons).map(async (seasonNum) => {
                                    try {
                                        const seasonRes = await fetch(`/api/tv/${item.id}/season/${seasonNum}`);
                                        if (seasonRes.ok) {
                                            const seasonData = await seasonRes.json();
                                            const idx = seriesDataForProgress.seasons.findIndex(
                                                s => s.season_number === parseInt(seasonNum)
                                            );
                                            if (idx !== -1) {
                                                seriesDataForProgress.seasons[idx] = {
                                                    ...seriesDataForProgress.seasons[idx],
                                                    ...seasonData,
                                                    episode_count: seasonData.episode_count || 
                                                                  seriesDataForProgress.seasons[idx]?.episode_count || 
                                                                  (seasonData.episodes?.length || 0)
                                                };
                                            }
                                        }
                                    } catch {
                                        // fallback to episode_count
                                    }
                                });
                                await Promise.all(seasonPromises);
                            }
                        }
                    } catch (err) {
                        console.error('Error fetching series details for progress:', err);
                    }
                    setWatchStatus(getSeriesWatchProgress(item.id, seriesDataForProgress, progress, isWatched));
                };
                fetchAndCalc();
            } else {
                setWatchStatus(getSeriesWatchProgress(item.id, seriesDataForProgress, progress, isWatched));
            }
        } else {
            const watchedItem = watched.find(w => w.content_id === item.id && w.media_type === 'movie');
            setWatchStatus(getMovieWatchStatus(item.id, watchedItem));
        }
    }, [item.id, item, isSeries, user, watched, seriesProgress, contextSeriesDetails]);

    // Only show watched border if content is released
    const isReleased = isSeries ? isSeriesReleased(item) : isMovieReleased(item);
    const showWatchedBorder = watchStatus?.isWatched && isReleased;
    
    return (
        <div className="block relative group">
            <a href={href} className="block">
                <div className={`futuristic-card overflow-hidden ${showWatchedBorder ? 'border-2 border-amber-500' : ''}`}>
                    <div className="relative aspect-[2/3] overflow-hidden bg-charcoal-900">
                        <ImageWithFallback
                            src={posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null}
                            alt={title}
                            className="object-cover w-full h-full hover:scale-110 transition-transform duration-300"
                        />
                        
                        <NewReleaseBadge releaseDate={releaseDate} />
                        
                        {!isSeries && <UpcomingBadge releaseDate={releaseDate} />}
                        
                        {isSeries && (
                            <SeriesNotificationBadge
                                seriesId={item.id}
                                lastAirDate={item.last_air_date}
                                status={item.status}
                                numberOfSeasons={item.number_of_seasons}
                            />
                        )}
                        
                        <div className="absolute top-1 left-1 bg-charcoal-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-subtle z-10">
                            {getContentType(item, mediaType)}
                        </div>
                        
                        {item.vote_average && item.vote_average > 0 && (
                            <div className="absolute bottom-2 left-2 w-10 h-10 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center shadow-subtle z-10 border-2 border-black/20">
                                {item.vote_average.toFixed(1)}
                            </div>
                        )}
                        
                    </div>
                    <div className="p-2 bg-charcoal-900 min-h-[72px] flex flex-col justify-between">
                        <div className="flex items-start gap-2 mb-1">
                            <h2 className="text-xs font-semibold text-white line-clamp-2 flex-1">{title}</h2>
                            <ContentRatingBadge item={item} mediaType={mediaType} size="small" className="flex-shrink-0" />
                        </div>
                        <div className="flex items-center justify-start gap-2 flex-wrap">
                            {releaseDate && (
                                <p className="text-[10px] text-amber-500/80">{formatDate(releaseDate)}</p>
                            )}
                            {!isSeries && item.runtime && (
                                <p className="text-[10px] text-amber-500/80">• {formatRuntime(item.runtime)}</p>
                            )}
                            {isSeries && getSeriesInfo(item) && (
                                <p className="text-[10px] text-amber-500/80">• {getSeriesInfo(item)}</p>
                            )}
                            {isSeries && watchStatus && isReleased && watchStatus.percentage > 0 && (
                                <div className="flex items-center gap-1 bg-amber-500/30 border border-amber-500/40 px-1.5 py-0.5 rounded shadow-sm">
                                    <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-[10px] text-amber-400 font-bold">
                                        {watchStatus.percentage}%
                                    </span>
                                </div>
                            )}
                            {!isSeries && watchStatus?.isWatched && (
                                <div className="flex items-center gap-1 bg-amber-500/30 border border-amber-500/40 px-1.5 py-0.5 rounded shadow-sm">
                                    <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                    <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </a>
            
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
