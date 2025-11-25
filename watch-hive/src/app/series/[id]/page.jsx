import ImageWithFallback from '../../components/ImageWithFallback';
import WatchedButton from '../../components/WatchedButton';
import WishlistButton from '../../components/WishlistButton';
import SeriesSeasons from '../../components/SeriesSeasons';
import ContentCard from '../../components/ContentCard';
import TrailerPlayer from '../../components/TrailerPlayer';
import { getBestTrailer } from '../../utils/trailerHelper';

async function getSerieDetails(id) {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?language=en-US`, {
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
    const { id } = params;
    const tv = await getSerieDetails(id);
    const tv_more = await getSerieMoreDetails(id);
    const tv_trailer = await getSerieTrailer(id);
    const tv_recommendations = await getSerieRecommendations(id, tv.name);

    const bestTrailer = getBestTrailer(tv_trailer);

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Top Section: Image and Overview */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">{tv.name}</h1>
                
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Series Image */}
                    <div className="flex-shrink-0">
                        <ImageWithFallback
                            src={tv.poster_path ? `https://image.tmdb.org/t/p/w500${tv.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image'}
                            alt={tv.name}
                            className="w-full max-w-sm rounded-lg shadow-glow-blue"
                        />
                    </div>

                    {/* Overview and Details */}
                    <div className="flex-1">
                        <div className="mb-6 futuristic-card p-6">
                            <h2 className="font-bold mb-2 text-xl text-futuristic-yellow-400 futuristic-text-glow-yellow">Overview:</h2>
                            <p className="text-white leading-relaxed">{tv.overview}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="futuristic-card p-4">
                                <p className="font-bold text-lg text-futuristic-yellow-400">First Air Date:</p>
                                <p className="text-white font-medium">{tv.first_air_date}</p>
                            </div>
                            <div className="futuristic-card p-4">
                                <p className="font-bold text-lg text-futuristic-yellow-400">Last Air Date:</p>
                                <p className="text-white font-medium">{tv.last_air_date || 'Ongoing'}</p>
                            </div>
                            <div className="futuristic-card p-4">
                                <p className="font-bold text-lg text-futuristic-yellow-400">Rating:</p>
                                <p className="text-white font-medium">{tv.vote_average} / 10</p>
                            </div>
                            <div className="md:col-span-2 futuristic-card p-4">
                                <p className="font-bold text-lg text-futuristic-yellow-400">Genres:</p>
                                <p className="text-white font-medium">{tv.genres.map((genre) => genre.name).join(", ")}</p>
                            </div>
                        </div>

                        {/* User Actions */}
                        <div className="mb-6 futuristic-card p-4">
                            <div className="flex flex-wrap gap-4">
                                <WatchedButton itemId={tv.id} mediaType="tv" seasons={tv.seasons} />
                                <WishlistButton itemId={tv.id} mediaType="tv" />
                            </div>
                        </div>

                        {/* Watch Providers */}
                        {tv_more.results.CA?.flatrate?.length > 0 && (
                            <div className="mb-4">
                                <p className="font-bold text-lg mb-3 text-futuristic-yellow-400 futuristic-text-glow-yellow">Available On:</p>
                                <div className="flex flex-wrap gap-3">
                                    {tv_more.results.CA.flatrate.map(provider => (
                                        <div key={provider.provider_id} className="flex items-center gap-2 bg-futuristic-blue-800/80 border border-futuristic-yellow-500/50 px-4 py-2.5 rounded-lg shadow-glow-yellow hover:border-futuristic-yellow-400 hover:shadow-glow-yellow-lg transition-all">
                                            {provider.logo_path && (
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                                                    alt={provider.provider_name}
                                                    width={40}
                                                    height={40}
                                                    className="rounded"
                                                />
                                            )}
                                            <p className="text-base font-semibold text-futuristic-yellow-400">{provider.provider_name}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Video Trailer */}
                    {bestTrailer && (
                        <div className="flex-shrink-0 lg:w-96 mt-6 lg:mt-0">
                            <h2 className="text-xl font-bold mb-3 text-futuristic-yellow-400 futuristic-text-glow-yellow">
                                {bestTrailer.name.includes('Official') ? 'Official Trailer' : 
                                 bestTrailer.type === 'Trailer' ? 'Trailer' : 
                                 bestTrailer.type || 'Video'}
                            </h2>
                            <TrailerPlayer trailerKey={bestTrailer.key} title={tv.name} />
                        </div>
                    )}
                </div>
            </div>

            {/* Seasons & Episodes Section */}
            {tv.seasons && tv.seasons.length > 0 && (
                <div className="mt-12 border-t border-futuristic-blue-500/30 pt-8">
                    <SeriesSeasons seriesId={tv.id} seasons={tv.seasons} />
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
