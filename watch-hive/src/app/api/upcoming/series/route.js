import { fetchTMDB } from '../../utils';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const language = searchParams.get('language') || 'en-US';

    try {
        // Get current date for filtering
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get upcoming/on-the-air TV series
        // Also fetch airing today and upcoming series
        const [onTheAir, airingToday] = await Promise.all([
            fetchTMDB('/tv/on_the_air', {
                language: language,
                page: page,
            }),
            fetchTMDB('/tv/airing_today', {
                language: language,
                page: page,
            })
        ]);

        // Combine results and filter for future air dates
        const allSeries = [
            ...(onTheAir.results || []),
            ...(airingToday.results || [])
        ];

        // Remove duplicates by ID
        const uniqueSeries = allSeries.filter((serie, index, self) =>
            index === self.findIndex(s => s.id === serie.id)
        );

        // Filter to only include series with first_air_date in the future
        const upcomingSeries = uniqueSeries.filter(serie => {
            if (!serie.first_air_date) return false;
            const airDate = new Date(serie.first_air_date);
            airDate.setHours(0, 0, 0, 0);
            return airDate >= today;
        });

        // Sort by first_air_date
        upcomingSeries.sort((a, b) => {
            const dateA = new Date(a.first_air_date || 0);
            const dateB = new Date(b.first_air_date || 0);
            return dateA - dateB;
        });

        return new Response(JSON.stringify({
            results: upcomingSeries,
            page: page,
            total_pages: Math.ceil(upcomingSeries.length / 20),
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

