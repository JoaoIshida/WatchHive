import axios from 'axios';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost'); // Adjust the base URL if needed
    const language = searchParams.get('language') || 'en-US'; // Default to English if no language is provided

    try {
        const response = await axios.get(`https://api.themoviedb.org/3/trending/movie/week`, {
            params: {
                api_key: process.env.TMDB_API_KEY,
                language: language,
            },
        });

        return new Response(JSON.stringify(response.data.results), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching trending movies:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch trending movies' }), {
            status: 500,
        });
    }
}
