import { fetchTMDB } from '../utils';
import { findSimilarTitles } from '../../utils/similarTitles';

export async function POST(req) {
    try {
        const body = await req.json();
        const { movieIds, seriesIds, mediaType, titles } = body; // Add titles parameter

        // Determine if we're working with movies, series, or both
        const isMovies = mediaType === 'movie' || (movieIds && movieIds.length > 0);
        const isSeries = mediaType === 'tv' || (seriesIds && seriesIds.length > 0);

        let allRecommendations = [];
        const seenIds = new Set();

        // Get similar titles based on title search (e.g., "Zootopia 2" -> "Zootopia")
        if (titles && Array.isArray(titles) && titles.length > 0) {
            for (const titleData of titles) {
                const { title, type } = titleData;
                if (title) {
                    try {
                        const similarTitles = await findSimilarTitles(
                            title,
                            type || mediaType || 'both',
                            5 // Limit to 5 similar titles per input
                        );
                        
                        similarTitles.forEach(item => {
                            if (!seenIds.has(item.id)) {
                                seenIds.add(item.id);
                                allRecommendations.push({
                                    ...item,
                                    media_type: item.media_type || (type || 'movie'),
                                    sourceType: 'similar_title',
                                    similarity: item.similarity || 0,
                                });
                            }
                        });
                    } catch (error) {
                        console.error(`Error finding similar titles for "${title}":`, error);
                    }
                }
            }
        }

        // Get recommendations for movies
        if (isMovies && movieIds && movieIds.length > 0) {
            const movieRecs = await Promise.all(
                movieIds.map(id =>
                    fetchTMDB(`/movie/${id}/recommendations`, {
                        language: 'en-CA',
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
                        language: 'en-CA',
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

        // Sort all recommendations: prioritize similar titles, then by vote average
        allRecommendations.sort((a, b) => {
            // Prioritize similar titles (from title search)
            if (a.sourceType === 'similar_title' && b.sourceType !== 'similar_title') return -1;
            if (b.sourceType === 'similar_title' && a.sourceType !== 'similar_title') return 1;
            
            // If both are similar titles, sort by similarity score
            if (a.sourceType === 'similar_title' && b.sourceType === 'similar_title') {
                if (b.similarity !== a.similarity) {
                    return b.similarity - a.similarity;
                }
            }
            
            // Then by vote average
            return (b.vote_average || 0) - (a.vote_average || 0);
        });

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
