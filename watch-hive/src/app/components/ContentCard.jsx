"use client";
import ImageWithFallback from './ImageWithFallback';
import NewReleaseBadge from './NewReleaseBadge';
import SeriesNotificationBadge from './SeriesNotificationBadge';

const ContentCard = ({ item, mediaType = 'movie', href }) => {
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date;
    const posterPath = item.poster_path || item.backdrop_path;
    const isSeries = mediaType === 'tv' || item.media_type === 'tv';

    return (
        <a href={href} className="block">
            <div className="futuristic-card overflow-hidden">
                <div className="relative aspect-[2/3] overflow-hidden bg-futuristic-blue-900">
                    <ImageWithFallback
                        src={posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : 'https://via.placeholder.com/500x750?text=No+Image'}
                        alt={title}
                        className="object-cover w-full h-full hover:scale-110 transition-transform duration-300"
                    />
                    
                    {/* New Release Badge */}
                    <NewReleaseBadge releaseDate={releaseDate} />
                    
                    {/* Series Notification Badge */}
                    {isSeries && (
                        <SeriesNotificationBadge
                            seriesId={item.id}
                            lastAirDate={item.last_air_date}
                            status={item.status}
                            numberOfSeasons={item.number_of_seasons}
                        />
                    )}
                    
                    {/* Media Type Badge */}
                    {isSeries && (
                        <div className="absolute top-1 right-1 bg-futuristic-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-glow-blue z-10">
                            TV
                        </div>
                    )}
                    
                    {/* Rating Badge */}
                    {item.vote_average && (
                        <div className="absolute bottom-1 left-1 bg-futuristic-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-glow-yellow z-10">
                            ⭐ {item.vote_average.toFixed(1)}
                        </div>
                    )}
                </div>
                <div className="p-2 bg-futuristic-blue-900/80">
                    <h2 className="text-xs font-semibold text-white line-clamp-2 mb-1">{title}</h2>
                    {releaseDate && (
                        <p className="text-[10px] text-futuristic-yellow-400/80">{releaseDate}</p>
                    )}
                </div>
            </div>
        </a>
    );
};

export default ContentCard;

