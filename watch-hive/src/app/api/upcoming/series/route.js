import { fetchTMDB } from '../../utils';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const language = searchParams.get('language') || 'en-CA';

    try {
        // Get current date for filtering
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch all pages from multiple endpoints to get comprehensive upcoming series
        let allSeries = [];
        const maxPages = 10; // Safety limit per endpoint

        // 1. Get series with first_air_date in the future (new series)
        let currentPage = 1;
        let hasMorePages = true;
        while (hasMorePages && currentPage <= maxPages) {
            const onTheAirData = await fetchTMDB('/tv/on_the_air', {
                language: language,
                page: currentPage,
            });
            
            if (onTheAirData.results && onTheAirData.results.length > 0) {
                allSeries = [...allSeries, ...onTheAirData.results];
                hasMorePages = currentPage < (onTheAirData.total_pages || 1);
                currentPage++;
            } else {
                hasMorePages = false;
            }
        }

        // 2. Get series airing today (may have new episodes)
        currentPage = 1;
        hasMorePages = true;
        while (hasMorePages && currentPage <= maxPages) {
            const airingTodayData = await fetchTMDB('/tv/airing_today', {
                language: language,
                page: currentPage,
            });
            
            if (airingTodayData.results && airingTodayData.results.length > 0) {
                allSeries = [...allSeries, ...airingTodayData.results];
                hasMorePages = currentPage < (airingTodayData.total_pages || 1);
                currentPage++;
            } else {
                hasMorePages = false;
            }
        }

        // 3. Remove duplicates by ID
        const uniqueSeries = allSeries.filter((serie, index, self) =>
            index === self.findIndex(s => s.id === serie.id)
        );

        // 4. Filter for upcoming content (new series OR series with upcoming episodes/seasons)
        const upcomingSeries = uniqueSeries.filter(serie => {
            // Check if it's a new series (first_air_date in the future)
            if (serie.first_air_date) {
                const airDate = new Date(serie.first_air_date);
                airDate.setHours(0, 0, 0, 0);
                if (airDate >= today) {
                    return true;
                }
            }

            // Check if series has next_episode_to_air with future air date (new season/episode)
            if (serie.next_episode_to_air && serie.next_episode_to_air.air_date) {
                const nextAirDate = new Date(serie.next_episode_to_air.air_date);
                nextAirDate.setHours(0, 0, 0, 0);
                if (nextAirDate >= today) {
                    return true;
                }
            }

            // Check if series is currently airing (status indicates new content)
            if (serie.status === 'Returning Series' || serie.status === 'In Production') {
                // Also check last_air_date to see if it's recent or upcoming
                if (serie.last_air_date) {
                    const lastAirDate = new Date(serie.last_air_date);
                    lastAirDate.setHours(0, 0, 0, 0);
                    // Include if last air date is within last 90 days (recently aired, likely continuing)
                    const daysSinceLastAir = Math.floor((today - lastAirDate) / (1000 * 60 * 60 * 24));
                    if (daysSinceLastAir >= -30 && daysSinceLastAir <= 90) {
                        return true;
                    }
                }
            }

            return false;
        });

        // Sort by next air date or first air date (ascending - oldest first)
        upcomingSeries.sort((a, b) => {
            // Prefer next_episode_to_air date if available, otherwise use first_air_date
            let dateA = 0;
            let dateB = 0;

            if (a.next_episode_to_air && a.next_episode_to_air.air_date) {
                dateA = new Date(a.next_episode_to_air.air_date).getTime();
            } else if (a.first_air_date) {
                dateA = new Date(a.first_air_date).getTime();
            }

            if (b.next_episode_to_air && b.next_episode_to_air.air_date) {
                dateB = new Date(b.next_episode_to_air.air_date).getTime();
            } else if (b.first_air_date) {
                dateB = new Date(b.first_air_date).getTime();
            }

            return dateA - dateB;
        });

        // Paginate the results
        const itemsPerPage = 20;
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedResults = upcomingSeries.slice(startIndex, endIndex);

        return new Response(JSON.stringify({
            results: paginatedResults,
            page: page,
            total_pages: Math.ceil(upcomingSeries.length / itemsPerPage),
            total_results: upcomingSeries.length
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching upcoming series:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch upcoming series' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

