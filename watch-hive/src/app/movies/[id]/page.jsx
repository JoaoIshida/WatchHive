async function getMovieDetails(id) {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?language=en-US`, {
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

async function getMovieRecommendations(id) {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/recommendations`, {
            headers: {
                Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
            },
        });

        if (!res.ok) {
            // Return empty results if recommendations fail
            return { results: [] };
        }

        const data = await res.json();
        return data;
    } catch (error) {
        console.error('Error fetching movie recommendations:', error);
        return { results: [] };
    }
}

import ImageWithFallback from '../../components/ImageWithFallback';
import WatchedButton from '../../components/WatchedButton';
import WishlistButton from '../../components/WishlistButton';
import ContentCard from '../../components/ContentCard';

const MovieDetailPage = async ({ params }) => {
    const { id } = params;
    const movie = await getMovieDetails(id);
    const movie_more = await getMovieMoreDetails(id);
    const movie_trailer = await getMovieTrailer(id);
    const movie_recommendations = await getMovieRecommendations(id);

    const officialTrailer = movie_trailer.results.find(
        trailer => trailer.type === "Trailer" && trailer.name.toLowerCase().includes("official")
    );

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Top Section: Title, Image, Overview, and Video */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">{movie.title}</h1>
                
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Movie Image */}
                    <div className="flex-shrink-0">
                        <ImageWithFallback
                            src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image'}
                            alt={movie.title}
                            className="w-full max-w-sm rounded-lg shadow-lg"
                        />
                    </div>

                    {/* Overview and Details */}
                    <div className="flex-1">
                        <div className="mb-6 futuristic-card p-6">
                            <h2 className="font-bold mb-2 text-xl text-futuristic-yellow-400 futuristic-text-glow-yellow">Overview:</h2>
                            <p className="text-white leading-relaxed">{movie.overview}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="futuristic-card p-4">
                                <p className="font-bold text-lg text-futuristic-yellow-400">Release Date:</p>
                                <p className="text-white font-medium">{movie.release_date}</p>
                            </div>
                            <div className="futuristic-card p-4">
                                <p className="font-bold text-lg text-futuristic-yellow-400">Rating:</p>
                                <p className="text-white font-medium">{movie.vote_average} / 10</p>
                            </div>
                            <div className="md:col-span-2 futuristic-card p-4">
                                <p className="font-bold text-lg text-futuristic-yellow-400">Genres:</p>
                                <p className="text-white font-medium">{movie.genres.map((genre) => genre.name).join(", ")}</p>
                            </div>
                        </div>

                        {/* User Actions */}
                        <div className="mb-6 futuristic-card p-4">
                            <div className="flex flex-wrap gap-4">
                                <WatchedButton itemId={movie.id} mediaType="movie" />
                                <WishlistButton itemId={movie.id} mediaType="movie" />
                            </div>
                        </div>

                        {/* Watch Providers */}
                        {movie_more.results.CA?.flatrate?.length > 0 && (
                            <div className="mb-4">
                                <p className="font-bold text-lg mb-3 text-futuristic-yellow-400 futuristic-text-glow-yellow">Available On:</p>
                                <div className="flex flex-wrap gap-3">
                                    {movie_more.results.CA.flatrate.map(provider => (
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
                        {movie_more.results.CA?.rent?.length > 0 && (
                            <div className="mb-4">
                                <p className="font-bold text-lg mb-3 text-futuristic-yellow-400 futuristic-text-glow-yellow">Rent On:</p>
                                <div className="flex flex-wrap gap-3">
                                    {movie_more.results.CA.rent.map(provider => (
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
                        {movie_more.results.CA?.buy?.length > 0 && (
                            <div className="mb-4">
                                <p className="font-bold text-lg mb-3 text-futuristic-yellow-400 futuristic-text-glow-yellow">Buy On:</p>
                                <div className="flex flex-wrap gap-3">
                                    {movie_more.results.CA.buy.map(provider => (
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
                    {officialTrailer && (
                        <div className="flex-shrink-0 lg:w-96">
                            <h2 className="text-xl font-bold mb-3 text-futuristic-yellow-400 futuristic-text-glow-yellow">Official Trailer</h2>
                            <div className="relative w-full futuristic-card p-2" style={{ paddingBottom: '56.25%' }}>
                                <iframe
                                    className="absolute top-0 left-0 w-full h-full rounded-lg border border-futuristic-blue-500/30"
                                    src={`https://www.youtube.com/embed/${officialTrailer.key}`}
                                    allow="autoplay; encrypted-media"
                                    allowFullScreen
                                    title="Official Trailer"
                                ></iframe>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Section: Recommendations */}
            {movie_recommendations?.results && movie_recommendations.results.length > 0 && (
                <div className="mt-12 border-t border-futuristic-blue-500/30 pt-8">
                    <h2 className="text-3xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">You Might Also Like</h2>
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
