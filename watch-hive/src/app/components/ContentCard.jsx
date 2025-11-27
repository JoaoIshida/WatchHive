"use client";
import { useState, useEffect } from 'react';
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

const ContentCard = ({ item, mediaType = 'movie', href }) => {
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date;
    const posterPath = item.poster_path || item.backdrop_path;
    const isSeries = mediaType === 'tv' || item.media_type === 'tv';
    
    const [watchStatus, setWatchStatus] = useState(null);
    
    useEffect(() => {
        const updateWatchStatus = () => {
            if (isSeries) {
                setWatchStatus(getSeriesWatchProgress(item.id, item));
            } else {
                setWatchStatus(getMovieWatchStatus(item.id));
            }
        };
        
        updateWatchStatus();
        
        // Listen for watch status changes
        const handleUpdate = () => updateWatchStatus();
        window.addEventListener('watchhive-data-updated', handleUpdate);
        
        return () => {
            window.removeEventListener('watchhive-data-updated', handleUpdate);
        };
    }, [item.id, item, isSeries]);

    return (
        <div className="block relative group">
            <a href={href} className="block">
                <div className={`futuristic-card overflow-hidden ${watchStatus?.isWatched ? 'border-2 border-futuristic-yellow-500 shadow-glow-yellow' : ''}`}>
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
                        
                        {/* Water Fill Effect for Series - Fills from bottom based on percentage */}
                        {isSeries && watchStatus?.isWatched && watchStatus.percentage > 0 && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                                <div 
                                    className="absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out"
                                    style={{ 
                                        height: `${watchStatus.percentage}%`,
                                    }}
                                >
                                    <div 
                                        className="absolute bottom-0 left-0 right-0 h-full bg-gradient-to-t from-futuristic-yellow-500/30 via-futuristic-yellow-400/20 to-futuristic-yellow-300/15"
                                    />
                                    {/* Percentage text overlay - centered in the fill area */}
                                    {watchStatus.percentage >= 20 && (
                                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-futuristic-yellow-400 font-bold text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-20">
                                            {watchStatus.percentage}%
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Watched Overlay for Movies - Full fill when watched */}
                        {!isSeries && watchStatus?.isWatched && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                                <div className="absolute bottom-0 left-0 right-0 h-full bg-gradient-to-t from-futuristic-yellow-500/30 via-futuristic-yellow-400/20 to-futuristic-yellow-300/15 transition-all duration-700 ease-out">
                                    {/* Checkmark icon overlay - centered */}
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-futuristic-yellow-400 z-20">
                                        <svg className="w-12 h-12 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-2 bg-futuristic-blue-900/80">
                        <div className="flex items-start gap-2 mb-1">
                            <h2 className="text-xs font-semibold text-white line-clamp-2 flex-1">{title}</h2>
                            <ContentRatingBadge item={item} mediaType={mediaType} size="small" className="flex-shrink-0" />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
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
                            {isSeries && watchStatus?.isWatched && watchStatus.percentage > 0 && (
                                <p className="text-[10px] text-futuristic-yellow-400 font-semibold ml-auto">
                                    {watchStatus.percentage}%
                                </p>
                            )}
                            {!isSeries && watchStatus?.isWatched && (
                                <p className="text-[10px] text-futuristic-yellow-400 font-semibold ml-auto flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Watched
                                </p>
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

