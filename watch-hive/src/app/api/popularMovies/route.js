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
        const maxRating = searchParams.get('maxRating');
        const sortBy = searchParams.get('sortBy') || 'popularity.desc';
        const dateRange = searchParams.get('dateRange');
        const daysPast = searchParams.get('daysPast');
        const includeUpcoming = searchParams.get('includeUpcoming') === 'true';
        
        const params = {
            language: 'en-US',
            page: page,
            sort_by: sortBy,
            include_adult: false,
            include_video: false,
        };

        // Genre filter
        if (genreIds) {
            params.with_genres = genreIds;
        }

        // Year filter
        if (year) {
            params.primary_release_year = year;
        }

        // Rating filter
        if (minRating) {
            params['vote_average.gte'] = minRating;
        }
        if (maxRating) {
            params['vote_average.lte'] = maxRating;
        }

        // Date range filters
        const now = new Date();
        if (dateRange) {
            switch (dateRange) {
                case 'upcoming':
                    params['primary_release_date.gte'] = now.toISOString().split('T')[0];
                    break;
                case 'this_week':
                    const thisWeek = new Date(now);
                    thisWeek.setDate(now.getDate() - now.getDay());
                    params['primary_release_date.gte'] = thisWeek.toISOString().split('T')[0];
                    params['primary_release_date.lte'] = now.toISOString().split('T')[0];
                    break;
                case 'this_month':
                    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    params['primary_release_date.gte'] = thisMonth.toISOString().split('T')[0];
                    params['primary_release_date.lte'] = now.toISOString().split('T')[0];
                    break;
                case 'this_year':
                    const thisYear = new Date(now.getFullYear(), 0, 1);
                    params['primary_release_date.gte'] = thisYear.toISOString().split('T')[0];
                    params['primary_release_date.lte'] = now.toISOString().split('T')[0];
                    break;
            }
        }

        // Days past filter
        if (daysPast) {
            const days = parseInt(daysPast, 10);
            const cutoffDate = new Date(now);
            cutoffDate.setDate(now.getDate() - days);
            params['primary_release_date.gte'] = cutoffDate.toISOString().split('T')[0];
            params['primary_release_date.lte'] = now.toISOString().split('T')[0];
        }

        // Exclude upcoming movies by default (unless includeUpcoming is true)
        if (!includeUpcoming && !dateRange && !daysPast) {
            params['primary_release_date.lte'] = now.toISOString().split('T')[0];
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
