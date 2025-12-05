import { fetchTMDB } from '../../utils';

/**
 * Check if a specific movie is currently in theaters
 * GET /api/movie/in-theaters?movieId=123
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const movieId = searchParams.get('movieId');

    if (!movieId) {
        return new Response(JSON.stringify({ error: 'movieId parameter is required' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    try {
        // Fetch now playing movies - check multiple pages to be thorough
        let allNowPlaying = [];
        let page = 1;
        let hasMore = true;
        const maxPages = 5; // Check up to 5 pages (100 movies)

        while (hasMore && page <= maxPages) {
            const data = await fetchTMDB('/movie/now_playing', {
                language: 'en-CA',
                page: page,
                region: 'CA',
            });

            if (data.results && data.results.length > 0) {
                allNowPlaying = [...allNowPlaying, ...data.results];
                hasMore = page < data.total_pages;
                page++;
            } else {
                hasMore = false;
            }
        }

        // Check if the movie ID is in the now playing list
        const isInTheaters = allNowPlaying.some(movie => movie.id === parseInt(movieId, 10));

        return new Response(JSON.stringify({ inTheaters: isInTheaters }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error checking if movie is in theaters:', error);
        return new Response(JSON.stringify({ error: 'Failed to check theater status', inTheaters: false }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

