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

        // Fetch ALL upcoming movies by paginating through all pages
        let allUpcomingMovies = [];
        let currentPage = 1;
        let hasMorePages = true;
        const maxPages = 50; // Safety limit

        while (hasMorePages && currentPage <= maxPages) {
            const pageData = await fetchTMDB('/movie/upcoming', {
                language: language,
                page: currentPage,
                region: 'CA',
            });

            if (pageData.results && pageData.results.length > 0) {
                // Filter to only include movies with release date in the future
                const filtered = pageData.results.filter(movie => {
                    if (!movie.release_date) return false;
                    const releaseDate = new Date(movie.release_date);
                    releaseDate.setHours(0, 0, 0, 0);
                    return releaseDate >= today;
                });
                
                allUpcomingMovies = [...allUpcomingMovies, ...filtered];
                
                // Check if there are more pages
                hasMorePages = currentPage < (pageData.total_pages || 1);
                currentPage++;
            } else {
                hasMorePages = false;
            }
        }

        // Sort by release_date ascending (oldest first)
        allUpcomingMovies.sort((a, b) => {
            const dateA = new Date(a.release_date || 0);
            const dateB = new Date(b.release_date || 0);
            return dateA - dateB;
        });

        // Paginate the results
        const itemsPerPage = 20;
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedResults = allUpcomingMovies.slice(startIndex, endIndex);

        return new Response(JSON.stringify({
            results: paginatedResults,
            page: page,
            total_pages: Math.ceil(allUpcomingMovies.length / itemsPerPage),
            total_results: allUpcomingMovies.length
        }), {
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

