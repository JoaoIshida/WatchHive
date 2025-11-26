"use client";
import ImageWithFallback from './ImageWithFallback';
import NewReleaseBadge from './NewReleaseBadge';
import UpcomingBadge from './UpcomingBadge';
import SeriesNotificationBadge from './SeriesNotificationBadge';
import QuickActionsMenu from './QuickActionsMenu';
import { formatDate } from '../utils/dateFormatter';

const ContentCard = ({ item, mediaType = 'movie', href }) => {
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date;
    const posterPath = item.poster_path || item.backdrop_path;
    const isSeries = mediaType === 'tv' || item.media_type === 'tv';

    return (
        <div className="block relative group">
            <a href={href} className="block">
                <div className="futuristic-card overflow-hidden">
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
                        
                        {/* Media Type Badge - Left side (opposite to 3-dot menu) */}
                        <div className="absolute top-1 left-1 bg-futuristic-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-glow-blue z-10">
                            {isSeries ? 'TV' : 'Movie'}
                        </div>
                        
                        {/* Rating Badge - Circular */}
                        {item.vote_average && item.vote_average > 0 && (
                            <div className="absolute bottom-2 left-2 w-10 h-10 bg-futuristic-yellow-500 text-black text-xs font-bold rounded-full flex items-center justify-center shadow-glow-yellow z-10 border-2 border-black/20">
                                {item.vote_average.toFixed(1)}
                            </div>
                        )}
                    </div>
                    <div className="p-2 bg-futuristic-blue-900/80">
                        <h2 className="text-xs font-semibold text-white line-clamp-2 mb-1">{title}</h2>
                        {releaseDate && (
                            <p className="text-[10px] text-futuristic-yellow-400/80">{formatDate(releaseDate)}</p>
                        )}
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

