async function getMovieDetails(id) {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?language=en-CA&append_to_response=release_dates`, {
        headers: {
            Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to fetch movie details');
    }

    return res.json();
}
async function getMovieMoreDetails(id) {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers`, {
        headers: {
            Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to fetch serie more details');
    }

    return res.json();
}


async function getMovieTrailer(id) {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/videos`, {
        headers: {
            Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to fetch movie trailer');
    }

    return res.json();
}

function getRecommendationsBaseUrl() {
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

async function getMovieCollection(movie) {
    if (!movie.belongs_to_collection?.id) return null;
    try {
        const base = getRecommendationsBaseUrl();
        const res = await fetch(
            `${base}/api/collections/${movie.belongs_to_collection.id}`,
            { next: { revalidate: 86400 } }
        );
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

async function getMovieRecommendations(id) {
    try {
        const base = getRecommendationsBaseUrl();
        const res = await fetch(
            `${base}/api/recommendations?titleId=${id}&mediaType=movie&limit=10`,
            { next: { revalidate: 86400 } }
        );
        if (!res.ok) return { results: [] };
        const data = await res.json();
        return { results: data.recommendations || [] };
    } catch (error) {
        console.error('Error fetching movie recommendations:', error);
        return { results: [] };
    }
}

import ImageWithFallback from '../../components/ImageWithFallback';
import WatchedButton from '../../components/WatchedButton';
import WishlistButton from '../../components/WishlistButton';
import AddToListButton from '../../components/AddToListButton';
import ContentCard from '../../components/ContentCard';
import TrailerPlayer from '../../components/TrailerPlayer';
import WatchProvidersSection from '../../components/WatchProvidersSection';
import ContentRatingBadge from '../../components/ContentRatingBadge';
import { getBestTrailer } from '../../utils/trailerHelper';
import { formatDate } from '../../utils/dateFormatter';
import { formatRuntime } from '../../utils/runtimeFormatter';

const MovieDetailPage = async ({ params }) => {
    const { id } = await params;
    const movie = await getMovieDetails(id);
    const movie_more = await getMovieMoreDetails(id);
    const movie_trailer = await getMovieTrailer(id);
    const [movie_recommendations, movie_collection] = await Promise.all([
        getMovieRecommendations(id),
        getMovieCollection(movie),
    ]);

    const bestTrailer = getBestTrailer(movie_trailer);
    const collectionOtherParts = movie_collection?.parts
        ?.filter(p => p.id !== movie.id)
        ?.sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))
        || [];

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Top Section: Title, Image, Overview, and Video */}
            <div className="mb-8">
                <div className="mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                                <h1 className="text-4xl font-bold text-amber-500">{movie.title}</h1>
                                <ContentRatingBadge item={movie} mediaType="movie" size="xl" />
                            </div>
                            
                            {/* User Actions */}
                            <div className="flex flex-wrap gap-3">
                                <WatchedButton itemId={movie.id} mediaType="movie" itemData={movie} />
                                <WishlistButton itemId={movie.id} mediaType="movie" />
                                <AddToListButton itemId={movie.id} mediaType="movie" itemTitle={movie.title} />
                            </div>
                        </div>
                        
                        {/* Rating - Top Right */}
                        <div className="flex-shrink-0">
                            {movie.vote_average && movie.vote_average > 0 ? (
                                <div className="flex items-center gap-2 bg-charcoal-800/60 border border-amber-500/30 rounded-lg px-4 py-3">
                                    <div className="flex items-center">
                                        <span className="text-2xl font-bold text-amber-500">{movie.vote_average.toFixed(1)}</span>
                                        <span className="text-white/60 text-sm ml-1">/ 10</span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        {[...Array(5)].map((_, i) => (
                                            <svg
                                                key={i}
                                                className={`w-4 h-4 ${i < Math.round(movie.vote_average / 2) ? 'text-amber-500 fill-current' : 'text-white/20'}`}
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                                            </svg>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-charcoal-800/60 border border-amber-500/30 rounded-lg px-4 py-3">
                                    <p className="text-white/60 font-medium">No ratings</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Movie Image */}
                    <div className="flex-shrink-0">
                        <ImageWithFallback
                            src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null}
                            alt={movie.title}
                            className="w-full max-w-[320px] rounded-xl shadow-2xl shadow-charcoal-900/50"
                        />
                    </div>

                    {/* Overview and Details */}
                    <div className="flex-1 space-y-6">
                        {/* Overview */}
                        <div className="futuristic-card p-6">
                            <h2 className="font-bold mb-3 text-xl text-amber-500">Overview</h2>
                            <p className="text-white leading-relaxed text-base">{movie.overview}</p>
                        </div>

                        {/* Key Information */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="futuristic-card p-4">
                                <p className="text-sm text-amber-500/80 mb-1">Release Date</p>
                                <p className="text-white font-semibold text-lg">{formatDate(movie.release_date)}</p>
                            </div>
                            {movie.runtime && (
                                <div className="futuristic-card p-4">
                                    <p className="text-sm text-amber-500/80 mb-1">Runtime</p>
                                    <p className="text-white font-semibold text-lg">{formatRuntime(movie.runtime)}</p>
                                </div>
                            )}
                        </div>

                        {/* Genres */}
                        {movie.genres && movie.genres.length > 0 && (
                            <div>
                                <p className="text-sm text-amber-500/80 mb-3">Genres</p>
                                <div className="flex flex-wrap gap-2">
                                    {movie.genres.map((genre) => (
                                        <a
                                            key={genre.id}
                                            href={`/movies?genres=${genre.id}`}
                                            className="inline-flex items-center px-4 py-2 bg-charcoal-800/60 hover:bg-charcoal-700 border border-amber-500/30 hover:border-amber-400 rounded-lg text-white font-medium text-sm transition-all duration-200 hover:shadow-subtle-lg hover:scale-105"
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
                                <h2 className="text-xl font-bold mb-3 text-amber-500">
                                {bestTrailer 
                                    ? (bestTrailer.name.includes('Official') ? 'Official Trailer' : 
                                     bestTrailer.type === 'Trailer' ? 'Trailer' : 
                                       bestTrailer.type || 'Video')
                                    : 'Trailer'}
                                </h2>
                            <TrailerPlayer trailerKey={bestTrailer?.key} title={movie.title} />
                            </div>

                        {/* Watch Providers */}
                        <WatchProvidersSection
                            flatrate={movie_more.results.CA?.flatrate}
                            rent={movie_more.results.CA?.rent}
                            buy={movie_more.results.CA?.buy}
                            title={movie.title}
                            mediaType="movie"
                            movieId={movie.id}
                        />
                    </div>
                </div>
            </div>

            {/* Collection Section */}
            {movie_collection && collectionOtherParts.length > 0 && (
                <div className="mt-12 border-t border-charcoal-700 pt-8">
                    <div className="futuristic-card p-6">
                        <div className="flex items-center gap-3 mb-4">
                            {movie_collection.poster_path && (
                                <ImageWithFallback
                                    src={`https://image.tmdb.org/t/p/w92${movie_collection.poster_path}`}
                                    alt={movie_collection.name}
                                    className="w-12 h-18 rounded-lg object-cover"
                                />
                            )}
                            <div>
                                <p className="text-white/70 text-sm">Part of</p>
                                <a
                                    href={`/collections/${movie_collection.id}`}
                                    className="text-amber-500 hover:text-amber-400 font-bold text-xl transition-colors"
                                >
                                    {movie_collection.name}
                                </a>
                            </div>
                        </div>
                        <p className="text-white/80 text-sm mb-4">
                            Also includes{' '}
                            {collectionOtherParts.length <= 2
                                ? collectionOtherParts.map((p, i) => (
                                    <span key={p.id}>
                                        <a href={`/movies/${p.id}`} className="text-amber-500 hover:text-amber-400 transition-colors font-medium">
                                            {p.title}
                                        </a>
                                        {i < collectionOtherParts.length - 1 && (collectionOtherParts.length === 2 ? ' and ' : ', ')}
                                    </span>
                                ))
                                : <>
                                    {collectionOtherParts.slice(0, 2).map((p, i) => (
                                        <span key={p.id}>
                                            <a href={`/movies/${p.id}`} className="text-amber-500 hover:text-amber-400 transition-colors font-medium">
                                                {p.title}
                                            </a>
                                            {i < 1 && ', '}
                                        </span>
                                    ))}
                                    <a href={`/collections/${movie_collection.id}`} className="text-amber-500/80 hover:text-amber-400 transition-colors">
                                        {' '}and {collectionOtherParts.length - 2} more...
                                    </a>
                                </>
                            }
                        </p>
                        <a
                            href={`/collections/${movie_collection.id}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500 rounded-lg text-amber-500 text-sm font-medium transition-all"
                        >
                            View Full Collection
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </a>
                    </div>
                </div>
            )}

            {/* Bottom Section: Recommendations */}
            {movie_recommendations?.results && movie_recommendations.results.length > 0 && (
                <div className="mt-12 border-t border-charcoal-700 pt-8">
                    <h2 className="text-3xl font-bold mb-6 text-amber-500">You Might Also Like</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {movie_recommendations.results
                            .filter(movie => movie && movie.id)
                            .slice(0, 10)
                            .map(movie => (
                                <ContentCard
                                    key={movie.id}
                                    item={movie}
                                    mediaType="movie"
                                    href={`/movies/${movie.id}`}
                                />
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MovieDetailPage;
