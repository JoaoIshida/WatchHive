/**
 * Utility functions for checking if movies are in theaters
 */

/**
 * Check if a movie is currently in theaters by calling the API
 * @param {number} movieId - TMDB movie ID
 * @returns {Promise<boolean>} - True if movie is currently playing in theaters
 */
export async function checkMovieInTheaters(movieId) {
    if (!movieId) return false;

    try {
        const response = await fetch(`/api/movie/in-theaters?movieId=${movieId}`);
        if (!response.ok) return false;
        
        const data = await response.json();
        return data.inTheaters || false;
    } catch (error) {
        console.error('Error checking if movie is in theaters:', error);
        return false;
    }
}

/**
 * Get all movies currently in theaters
 * @returns {Promise<number[]>} - Array of movie IDs currently in theaters
 */
export async function getNowPlayingMovieIds() {
    try {
        const response = await fetch('/api/now-playing?page=1');
        if (!response.ok) return [];
        
        const data = await response.json();
        // Fetch all pages to get complete list
        const allMovies = [...(data.results || [])];
        const totalPages = data.total_pages || 1;
        
        // Fetch remaining pages (up to 5 pages total)
        const maxPages = Math.min(totalPages, 5);
        const promises = [];
        for (let page = 2; page <= maxPages; page++) {
            promises.push(
                fetch(`/api/now-playing?page=${page}`)
                    .then(res => res.ok ? res.json() : { results: [] })
                    .then(data => data.results || [])
                    .catch(() => [])
            );
        }
        
        const additionalResults = await Promise.all(promises);
        additionalResults.forEach(results => {
            allMovies.push(...results);
        });
        
        return allMovies.map(movie => movie.id);
    } catch (error) {
        console.error('Error fetching now playing movie IDs:', error);
        return [];
    }
}

