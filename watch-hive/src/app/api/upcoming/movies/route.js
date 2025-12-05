import { fetchTMDB } from '../../utils';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const language = searchParams.get('language') || 'en-CA';

    try {
        // Get current date for filtering
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Get upcoming movies from TMDB
        const data = await fetchTMDB('/movie/upcoming', {
            language: language,
            page: page,
            region: 'CA',
        });

        // Filter to only include movies with release date in the future
        if (data.results) {
            data.results = data.results.filter(movie => {
                if (!movie.release_date) return false;
                const releaseDate = new Date(movie.release_date);
                releaseDate.setHours(0, 0, 0, 0);
                return releaseDate >= today;
            });
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching upcoming movies:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch upcoming movies' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

