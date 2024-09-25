import axios from 'axios';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const pageParam = searchParams.get('page');
    const page = parseInt(pageParam, 10); // Convert to integer

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
        const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
            params: {
                api_key: process.env.TMDB_API_KEY,
                language: 'en-US',
                page: page,  // Use the valid page number
                sort_by: 'popularity.desc',
                include_adult: false,
                include_video: false,
            },
        });

        return new Response(JSON.stringify(response.data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching popular movies:', error.message);
        return new Response(JSON.stringify({ error: 'Failed to fetch popular movies' }), {
            status: 500,
        });
    }
}
