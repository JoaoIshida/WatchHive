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
        const certification = searchParams.get('certification');
        const watchProviders = searchParams.get('watchProviders');
        const keywords = searchParams.get('keywords');
        const sortBy = searchParams.get('sortBy') || 'popularity.desc';
        const dateRange = searchParams.get('dateRange');
        const daysPast = searchParams.get('daysPast');
        // Default to true (include upcoming), only exclude if explicitly set to false
        const includeUpcomingParam = searchParams.get('includeUpcoming');
        const includeUpcoming = includeUpcomingParam === null || includeUpcomingParam === 'true';
        
        const params = {
            language: 'en-US',
            page: page,
            sort_by: sortBy,
            include_adult: false,
        };

        // Genre filter
        if (genreIds) {
            params.with_genres = genreIds;
        }

        // Year filter - TMDB only supports single year, so use first year if array
        if (year) {
            const yearValue = Array.isArray(year) ? year[0] : year;
            params.first_air_date_year = yearValue;
        }

        // Rating filter
        if (minRating) {
            params['vote_average.gte'] = minRating;
        }
        if (maxRating) {
            params['vote_average.lte'] = maxRating;
        }

        // Note: TV content ratings filtering may need to be done client-side
        // as TMDB discover API for TV doesn't support content_ratings parameter
        // We'll store it for potential client-side filtering
        if (certification) {
            // For TV, we might need to filter client-side
            // Store in a custom param that we can use later
            params._certification = certification;
        }

        // Watch providers filter
        if (watchProviders) {
            // Can be single value or comma-separated
            const providerIds = watchProviders.split(',').map(p => p.trim()).filter(Boolean);
            if (providerIds.length > 0) {
                params.with_watch_providers = providerIds.join('|');
                params.watch_region = 'CA'; // Canada
            }
        }

        // Keywords filter
        if (keywords) {
            // Can be single value or comma-separated keyword IDs
            const keywordIds = keywords.split(',').map(k => k.trim()).filter(Boolean);
            if (keywordIds.length > 0) {
                params.with_keywords = keywordIds.join('|');
            }
        }

        // Date range filters
        const now = new Date();
        if (dateRange) {
            switch (dateRange) {
                case 'upcoming':
                    params['first_air_date.gte'] = now.toISOString().split('T')[0];
                    break;
                case 'this_week':
                    const thisWeek = new Date(now);
                    thisWeek.setDate(now.getDate() - now.getDay());
                    params['first_air_date.gte'] = thisWeek.toISOString().split('T')[0];
                    params['first_air_date.lte'] = now.toISOString().split('T')[0];
                    break;
                case 'this_month':
                    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    params['first_air_date.gte'] = thisMonth.toISOString().split('T')[0];
                    params['first_air_date.lte'] = now.toISOString().split('T')[0];
                    break;
                case 'this_year':
                    const thisYear = new Date(now.getFullYear(), 0, 1);
                    params['first_air_date.gte'] = thisYear.toISOString().split('T')[0];
                    params['first_air_date.lte'] = now.toISOString().split('T')[0];
                    break;
            }
        }

        // Days past filter
        if (daysPast) {
            const days = parseInt(daysPast, 10);
            const cutoffDate = new Date(now);
            cutoffDate.setDate(now.getDate() - days);
            params['first_air_date.gte'] = cutoffDate.toISOString().split('T')[0];
            params['first_air_date.lte'] = now.toISOString().split('T')[0];
        }

        // Include upcoming series by default (unless includeUpcoming is explicitly false)
        if (includeUpcoming === false && !dateRange && !daysPast) {
            params['first_air_date.lte'] = now.toISOString().split('T')[0];
        }

        const data = await fetchTMDB('/discover/tv', params);

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching popular series:', error.message);
        return new Response(JSON.stringify({ error: 'Failed to fetch popular series' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
