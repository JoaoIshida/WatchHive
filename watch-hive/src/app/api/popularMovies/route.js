import { fetchTMDB } from '../utils';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const pageParam = searchParams.get('page');
    const page = parseInt(pageParam, 10);

    // Validate page number
    if (isNaN(page) || page < 1 || page > 500) {
        return new Response(JSON.stringify({ error: 'Invalid page number' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    try {
        const genreIds = searchParams.get('genres');
        const year = searchParams.get('year');
        const minRating = searchParams.get('minRating');
        const sortBy = searchParams.get('sortBy') || 'popularity.desc';
        
        const params = {
            language: 'en-US',
            page: page,
            sort_by: sortBy,
            include_adult: false,
            include_video: false,
        };

        if (genreIds) {
            params.with_genres = genreIds;
        }
        if (year) {
            params.primary_release_year = year;
        }
        if (minRating) {
            params['vote_average.gte'] = minRating;
        }

        const data = await fetchTMDB('/discover/movie', params);

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching popular movies:', error.message);
        return new Response(JSON.stringify({ error: 'Failed to fetch popular movies' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
