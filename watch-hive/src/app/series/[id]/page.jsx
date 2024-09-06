import Image from 'next/image';

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
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/1/watch/providers`, {
        headers: {
            Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to fetch TV more details');
    }

    return res.json();
}

const SerieDetailPage = async ({ params }) => {
    const { id } = params;
    const tv = await getSerieDetails(id);
    const tv_more = await getSerieMoreDetails(id);

    return (
        <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold mb-4">{tv.name}</h1>
            <div className="flex flex-col md:flex-row gap-6">
                <img
                    src={`https://image.tmdb.org/t/p/w500${tv.poster_path}`}
                    alt={tv.name}
                    width={500}
                    height={750}
                    className="w-full md:w-1/3 rounded-lg"
                />
                <div className="md:w-2/3">
                    <p className="text-lg font-semibold mb-2">Overview:</p>
                    <p className="mb-4">{tv.overview}</p>
                    <p className="font-semibold">First Air Date:</p>
                    <p>{tv.first_air_date}</p>
                    <p className="font-semibold">Last Air Date:</p>
                    <p>{tv.last_air_date}</p>
                    <p className="font-semibold">Rating:</p>
                    <p>{tv.vote_average} / 10</p>
                    <p className="font-semibold">Genres:</p>
                    <ul>
                        {tv.genres.map((genre) => (
                            <li key={genre.id}>{genre.name}</li>
                        ))}
                    </ul>
                    {tv_more.results.CA?.flatrate?.length > 0 && (
                        <div>
                            <p className="font-semibold">Available On:</p>
                            <div className="flex gap-2">
                                {tv_more.results.CA.flatrate.map(provider => (
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
                </div>
            </div>
        </div>
    );
};

export default SerieDetailPage;
