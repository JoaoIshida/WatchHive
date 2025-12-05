import ImageWithFallback from '../../components/ImageWithFallback';
import WatchedButton from '../../components/WatchedButton';
import WishlistButton from '../../components/WishlistButton';
import AddToListButton from '../../components/AddToListButton';
import SeriesSeasons from '../../components/SeriesSeasons';
import ContentCard from '../../components/ContentCard';
import TrailerPlayer from '../../components/TrailerPlayer';
import WatchProvidersSection from '../../components/WatchProvidersSection';
import ContentRatingBadge from '../../components/ContentRatingBadge';
import { getBestTrailer } from '../../utils/trailerHelper';
import { formatDate } from '../../utils/dateFormatter';
import { getSeriesInfo } from '../../utils/runtimeFormatter';

async function getSerieDetails(id) {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?language=en-CA&append_to_response=content_ratings`, {
        headers: {
            Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to fetch TV details');
    }

    return res.json();
}

async function getSerieMoreDetails(id) {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/watch/providers`, {
        headers: {
            Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to fetch TV more details');
    }

    return res.json();
}

async function getSerieTrailer(id) {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/videos`, {
            headers: {
                Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
            },
        });

        if (!res.ok) {
            return { results: [] };
        }

        return res.json();
    } catch (error) {
        console.error('Error fetching series trailer:', error);
        return { results: [] };
    }
}

async function getSerieRecommendations(id, name) {
    try {
        // Get standard recommendations
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/recommendations`, {
            headers: {
                Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
            },
        });

        let standardRecs = { results: [] };
        if (res.ok) {
            standardRecs = await res.json();
        }

        // Also get similar titles based on title search (server-side)
        let similarTitles = [];
        if (name) {
            try {
                const { findSimilarTitles } = await import('../../utils/similarTitles');
                similarTitles = await findSimilarTitles(name, 'tv', 5);
            } catch (error) {
                console.error('Error fetching similar titles:', error);
            }
        }

        // Combine and deduplicate
        const allRecs = [...(standardRecs.results || [])];
        const seenIds = new Set(allRecs.map(r => r.id));
        
        similarTitles.forEach(item => {
            if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                allRecs.push(item);
            }
        });

        return { results: allRecs };
    } catch (error) {
        console.error('Error fetching series recommendations:', error);
        return { results: [] };
    }
}

const SerieDetailPage = async ({ params }) => {
    const { id } = await params;
    const tv = await getSerieDetails(id);
    const tv_more = await getSerieMoreDetails(id);
    const tv_trailer = await getSerieTrailer(id);
    const tv_recommendations = await getSerieRecommendations(id, tv.name);

    const bestTrailer = getBestTrailer(tv_trailer);

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Top Section: Image and Overview */}
            <div className="mb-8">
                <div className="mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                                <h1 className="text-4xl font-bold text-futuristic-yellow-400 futuristic-text-glow-yellow">{tv.name}</h1>
                                <ContentRatingBadge item={tv} mediaType="tv" size="xl" />
                            </div>
                            
                            {/* User Actions */}
                            <div className="flex flex-wrap gap-3">
                                <WatchedButton itemId={tv.id} mediaType="tv" seasons={tv.seasons} itemData={tv} />
                                <WishlistButton itemId={tv.id} mediaType="tv" />
                                <AddToListButton itemId={tv.id} mediaType="tv" itemTitle={tv.name} />
                            </div>
                        </div>
                        
                        {/* Rating - Top Right */}
                        <div className="flex-shrink-0">
                            {tv.vote_average && tv.vote_average > 0 ? (
                                <div className="flex items-center gap-2 bg-futuristic-blue-800/60 border border-futuristic-yellow-500/30 rounded-lg px-4 py-3">
                                    <div className="flex items-center">
                                        <span className="text-2xl font-bold text-futuristic-yellow-400">{tv.vote_average.toFixed(1)}</span>
                                        <span className="text-white/60 text-sm ml-1">/ 10</span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        {[...Array(5)].map((_, i) => (
                                            <svg
                                                key={i}
                                                className={`w-4 h-4 ${i < Math.round(tv.vote_average / 2) ? 'text-futuristic-yellow-400 fill-current' : 'text-white/20'}`}
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                                            </svg>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-futuristic-blue-800/60 border border-futuristic-yellow-500/30 rounded-lg px-4 py-3">
                                    <p className="text-white/60 font-medium">No ratings</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Series Image */}
                    <div className="flex-shrink-0">
                        <ImageWithFallback
                            src={tv.poster_path ? `https://image.tmdb.org/t/p/w500${tv.poster_path}` : null}
                            alt={tv.name}
                            className="w-full max-w-[320px] rounded-xl shadow-2xl shadow-futuristic-blue-900/50"
                        />
                    </div>

                    {/* Overview and Details */}
                    <div className="flex-1 space-y-6">
                        {/* Overview */}
                        <div className="futuristic-card p-6">
                            <h2 className="font-bold mb-3 text-xl text-futuristic-yellow-400 futuristic-text-glow-yellow">Overview</h2>
                            <p className="text-white leading-relaxed text-base">{tv.overview}</p>
                        </div>

                        {/* Key Information */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="futuristic-card p-4">
                                <p className="text-sm text-futuristic-yellow-400/80 mb-1">First Air Date</p>
                                <p className="text-white font-semibold text-lg">{formatDate(tv.first_air_date)}</p>
                            </div>
                            <div className="futuristic-card p-4">
                                <p className="text-sm text-futuristic-yellow-400/80 mb-1">Last Air Date</p>
                                <p className="text-white font-semibold text-lg">{tv.last_air_date ? formatDate(tv.last_air_date) : 'Ongoing'}</p>
                            </div>
                            {getSeriesInfo(tv) && (
                                <div className="futuristic-card p-4">
                                    <p className="text-sm text-futuristic-yellow-400/80 mb-1">Series Info</p>
                                    <p className="text-white font-semibold text-lg">{getSeriesInfo(tv)}</p>
                                </div>
                            )}
                        </div>

                        {/* Genres */}
                        {tv.genres && tv.genres.length > 0 && (
                            <div>
                                <p className="text-sm text-futuristic-yellow-400/80 mb-3">Genres</p>
                                <div className="flex flex-wrap gap-2">
                                    {tv.genres.map((genre) => (
                                        <a
                                            key={genre.id}
                                            href={`/series?genres=${genre.id}`}
                                            className="inline-flex items-center px-4 py-2 bg-futuristic-blue-800/60 hover:bg-futuristic-blue-700 border border-futuristic-yellow-500/30 hover:border-futuristic-yellow-400 rounded-lg text-white font-medium text-sm transition-all duration-200 hover:shadow-glow-yellow hover:scale-105"
                                        >
                                            {genre.name}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Video Trailer and Watch Providers */}
                    <div className="flex-shrink-0 lg:w-80 mt-6 lg:mt-0 space-y-6">
                        {/* Video Trailer */}
                            <div>
                                <h2 className="text-xl font-bold mb-3 text-futuristic-yellow-400 futuristic-text-glow-yellow">
                                {bestTrailer 
                                    ? (bestTrailer.name.includes('Official') ? 'Official Trailer' : 
                                     bestTrailer.type === 'Trailer' ? 'Trailer' : 
                                       bestTrailer.type || 'Video')
                                    : 'Trailer'}
                                </h2>
                            <TrailerPlayer trailerKey={bestTrailer?.key} title={tv.name} />
                            </div>

                        {/* Watch Providers */}
                        <WatchProvidersSection
                            flatrate={tv_more.results.CA?.flatrate}
                            rent={tv_more.results.CA?.rent}
                            buy={tv_more.results.CA?.buy}
                            title={tv.name}
                            mediaType="tv"
                        />
                    </div>
                </div>
            </div>

            {/* Seasons & Episodes Section */}
            {tv.seasons && tv.seasons.length > 0 && (
                <div className="mt-12 border-t border-futuristic-blue-500/30 pt-8">
                    <SeriesSeasons seriesId={tv.id} seasons={tv.seasons} seriesName={tv.name} />
                </div>
            )}

            {/* Bottom Section: Recommendations */}
            {tv_recommendations?.results && tv_recommendations.results.length > 0 && (
                <div className="mt-12 border-t border-futuristic-blue-500/30 pt-8">
                    <h2 className="text-3xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">You Might Also Like</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {tv_recommendations.results
                            .filter(series => series && series.id)
                            .slice(0, 10)
                            .map(series => (
                                <ContentCard
                                    key={series.id}
                                    item={series}
                                    mediaType="tv"
                                    href={`/series/${series.id}`}
                                />
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SerieDetailPage;
