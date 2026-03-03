import ImageWithFallback from '../../components/ImageWithFallback';
import ContentCard from '../../components/ContentCard';
import { fetchTMDB } from '../../api/utils';
import { formatDate } from '../../utils/dateFormatter';

async function getCollection(id) {
    return fetchTMDB(`/collection/${id}`, { language: 'en-CA' });
}

const CollectionPage = async ({ params }) => {
    const { id } = await params;
    const collection = await getCollection(id);

    const parts = (collection.parts || []).sort((a, b) =>
        (a.release_date || '').localeCompare(b.release_date || '')
    );

    const totalRevenue = parts.reduce((sum, p) => sum + (p.revenue || 0), 0);
    const avgRating = parts.length
        ? (parts.reduce((sum, p) => sum + (p.vote_average || 0), 0) / parts.length).toFixed(1)
        : null;

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {collection.poster_path && (
                        <div className="flex-shrink-0">
                            <ImageWithFallback
                                src={`https://image.tmdb.org/t/p/w342${collection.poster_path}`}
                                alt={collection.name}
                                className="w-full max-w-[240px] rounded-xl shadow-2xl shadow-charcoal-900/50"
                            />
                        </div>
                    )}
                    <div className="flex-1 space-y-4">
                        <h1 className="text-4xl font-bold text-amber-500">{collection.name}</h1>
                        {collection.overview && (
                            <p className="text-white/80 leading-relaxed text-base max-w-3xl">
                                {collection.overview}
                            </p>
                        )}
                        <div className="flex flex-wrap gap-4">
                            <div className="futuristic-card px-4 py-2">
                                <p className="text-xs text-amber-500/80">Movies</p>
                                <p className="text-white font-bold text-lg">{parts.length}</p>
                            </div>
                            {avgRating && (
                                <div className="futuristic-card px-4 py-2">
                                    <p className="text-xs text-amber-500/80">Avg Rating</p>
                                    <p className="text-white font-bold text-lg">{avgRating} / 10</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Movies in Collection */}
            <div className="border-t border-charcoal-700 pt-8">
                <h2 className="text-2xl font-bold mb-6 text-amber-500">
                    Movies in this Collection
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {parts.map((movie) => (
                        <ContentCard
                            key={movie.id}
                            item={movie}
                            mediaType="movie"
                            href={`/movies/${movie.id}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CollectionPage;
