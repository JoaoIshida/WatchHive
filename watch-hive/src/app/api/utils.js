/**
 * Helper function to build query string from params object
 */
export function buildQueryString(params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
        }
    });
    return searchParams.toString();
}

/**
 * Helper function to make TMDB API requests using Fetch
 */
export async function fetchTMDB(endpoint, params = {}) {
    const queryString = buildQueryString({
        ...params,
        api_key: process.env.TMDB_API_KEY,
    });
    
    const url = `https://api.themoviedb.org/3${endpoint}?${queryString}`;
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

