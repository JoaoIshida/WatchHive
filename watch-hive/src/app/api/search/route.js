import axios from 'axios';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost'); // Adjust the base URL if needed
    const query = searchParams.get('query'); // Get the search query from the URL
    const language = searchParams.get('language') || 'en-US'; // Default to English if no language is provided

    if (!query) {
        return new Response(JSON.stringify({ error: 'Query parameter is required' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    try {
        const response = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
            params: {
                api_key: process.env.TMDB_API_KEY,
                query: query,
                include_adult: false,
                language: language,
                page: 1,
            },
        });

        return new Response(JSON.stringify(response.data.results), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching search results:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch search results' }), {
            status: 500,
        });
    }
}
