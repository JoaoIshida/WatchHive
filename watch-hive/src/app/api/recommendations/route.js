import { fetchTMDB } from '../utils';

export async function POST(req) {
    try {
        const body = await req.json();
        const { movieIds, seriesIds, mediaType } = body;

        // Determine if we're working with movies, series, or both
        const isMovies = mediaType === 'movie' || (movieIds && movieIds.length > 0);
        const isSeries = mediaType === 'tv' || (seriesIds && seriesIds.length > 0);

        let allRecommendations = [];
        const seenIds = new Set();

        // Get recommendations for movies
        if (isMovies && movieIds && movieIds.length > 0) {
            const movieRecs = await Promise.all(
                movieIds.map(id =>
                    fetchTMDB(`/movie/${id}/recommendations`, {
                        language: 'en-US',
                        page: 1,
                    }).catch(() => null)
                )
            );

            movieRecs.forEach((data, index) => {
                if (data?.results) {
                    data.results.forEach(item => {
                        if (!seenIds.has(item.id)) {
                            seenIds.add(item.id);
                            allRecommendations.push({
                                ...item,
                                media_type: 'movie',
                                sourceId: movieIds[index],
                            });
                        }
                    });
                }
            });
        }

        // Get recommendations for series
        if (isSeries && seriesIds && seriesIds.length > 0) {
            const seriesRecs = await Promise.all(
                seriesIds.map(id =>
                    fetchTMDB(`/tv/${id}/recommendations`, {
                        language: 'en-US',
                        page: 1,
                    }).catch(() => null)
                )
            );

            seriesRecs.forEach((data, index) => {
                if (data?.results) {
                    data.results.forEach(item => {
                        if (!seenIds.has(item.id)) {
                            seenIds.add(item.id);
                            allRecommendations.push({
                                ...item,
                                media_type: 'tv',
                                sourceId: seriesIds[index],
                            });
                        }
                    });
                }
            });
        }

        // If we have multiple sources, find common recommendations by scoring
        if ((movieIds?.length > 1 || seriesIds?.length > 1) && allRecommendations.length > 0) {
            const recommendationScores = new Map();

            allRecommendations.forEach(rec => {
                const key = `${rec.media_type}-${rec.id}`;
                if (!recommendationScores.has(key)) {
                    recommendationScores.set(key, {
                        ...rec,
                        score: 0,
                        voteCount: 0,
                    });
                }
                const entry = recommendationScores.get(key);
                entry.score += rec.vote_average || 0;
                entry.voteCount += rec.vote_count || 0;
            });

            // Convert back to array and sort by score (recommendations that appear multiple times)
            allRecommendations = Array.from(recommendationScores.values())
                .sort((a, b) => {
                    // Prioritize recommendations that appear from multiple sources
                    const aAppearances = allRecommendations.filter(r => 
                        `${r.media_type}-${r.id}` === `${a.media_type}-${a.id}`
                    ).length;
                    const bAppearances = allRecommendations.filter(r => 
                        `${r.media_type}-${r.id}` === `${b.media_type}-${b.id}`
                    ).length;
                    
                    if (aAppearances !== bAppearances) {
                        return bAppearances - aAppearances;
                    }
                    // Then by vote average
                    return (b.vote_average || 0) - (a.vote_average || 0);
                });
        } else {
            // Sort by vote average for single source
            allRecommendations.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        }

        // Limit to top 20 recommendations
        const recommendations = allRecommendations.slice(0, 20);

        return new Response(JSON.stringify({ recommendations }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch recommendations' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
