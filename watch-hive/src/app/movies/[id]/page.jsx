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
    const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/recommendations`, {
        headers: {
            Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to fetch movie recommendations');
    }

    return res.json();
}

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
        <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold mb-4">{movie.title}</h1>
            {officialTrailer && (
                <div className="my-4">
                    <h2 className="text-2xl font-bold">Watch Official Trailer</h2>
                    <iframe
                        width="560"
                        height="315"
                        src={`https://www.youtube.com/embed/${officialTrailer.key}`}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        style={{
                            top: 0,
                            left: 0,
                            border: '2px solid white',
                            borderRadius: '10px',
                        }}
                        title="Official Trailer"
                    ></iframe>
                </div>
            )}
            <div className="flex flex-col md:flex-row gap-6">
                <img
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="w-full md:w-1/3 rounded-lg"
                />
                <div className="md:w-2/3">
                    <p className="font-semibold mb-2 text-xl" >Overview:</p>
                    <p className="mb-4">{movie.overview}</p>
                    <p className="font-semibold text-xl">Release Date:</p>
                    <p>{movie.release_date}</p>
                    <p className="font-semibold text-xl">Rating:</p>
                    <p>{movie.vote_average} / 10</p>
                    <p className="font-semibold text-xl">Genres:</p>
                    <ul>
                        {movie.genres.map((genre) => genre.name).join(", ")}
                    </ul>
                    {movie_more.results.CA?.flatrate?.length > 0 && (
                        <div>
                            <p className="font-semibold text-xl">Available On:</p>
                            <div className="flex gap-2">
                                {movie_more.results.CA.flatrate.map(provider => (
                                    <div key={provider.provider_id} className="flex items-center gap-2">
                                        {provider.logo_path && (
                                            <img
                                                src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                                                alt={provider.provider_name}
                                                width={50}
                                                height={50}
                                                className="rounded"
                                            />
                                        )}
                                        <p>{provider.provider_name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {movie_more.results.CA?.rent?.length > 0 && (
                        <div>
                            <p className="font-semibold text-xl">Rent On:</p>
                            <div className="flex gap-2">
                                {movie_more.results.CA.rent.map(provider => (
                                    <div key={provider.provider_id} className="flex items-center gap-2">
                                        {provider.logo_path && (
                                            <img
                                                src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                                                alt={provider.provider_name}
                                                width={50}
                                                height={50}
                                                className="rounded"
                                            />
                                        )}
                                        <p>{provider.provider_name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {movie_more.results.CA?.buy?.length > 0 && (
                        <div>
                            <p className="font-semibold text-xl">Buy On:</p>
                            <div className="flex gap-2">
                                {movie_more.results.CA.buy.map(provider => (
                                    <div key={provider.provider_id} className="flex items-center gap-2">
                                        {provider.logo_path && (
                                            <img
                                                src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                                                alt={provider.provider_name}
                                                width={50}
                                                height={50}
                                                className="rounded"
                                            />
                                        )}
                                        <p>{provider.provider_name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {movie_recommendations.results.length > 0 && (
                        <div className="overflow-x-scroll overflow-y-hidden h-[300px] scrollbar">
                            <p className="font-semibold mb-4 text-xl">Recommendations:</p>
                            <div className="flex gap-4">
                                {movie_recommendations.results.map(movie => (
                                    <a href={`/movies/${movie.id}`} key={movie.id} className="block">
                                        <div className="flex flex-col items-center hover:opacity-90 hover:scale-105 w-[100px] h-[120px]">
                                            <img
                                                src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                                                alt={movie.title}
                                                className="object-cover rounded-lg w-full h-32"
                                            />
                                            <h2 className="text-lg font-semibold">{movie.title}</h2>
                                            <p>{movie.release_date}</p>
                                            <p>{movie.vote_average} / 10</p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>

                    )}
                </div>
            </div>
        </div>
    );
};

export default MovieDetailPage;
