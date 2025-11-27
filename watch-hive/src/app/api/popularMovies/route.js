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
        const runtimeMin = searchParams.get('runtimeMin');
        const runtimeMax = searchParams.get('runtimeMax');
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
            include_video: false,
        };

        // Genre filter
        if (genreIds) {
            params.with_genres = genreIds;
        }

        // Year filter - TMDB only supports single year, so use first year if array
        if (year) {
            const yearValue = Array.isArray(year) ? year[0] : year;
            params.primary_release_year = yearValue;
        }

        // Rating filter
        if (minRating) {
            params['vote_average.gte'] = minRating;
        }
        if (maxRating) {
            params['vote_average.lte'] = maxRating;
        }

        // Certification filter (Brazilian certifications for movies)
        // Can be single value or comma-separated
        if (certification) {
            // TMDB API supports pipe-separated certifications
            const certs = certification.split(',').map(c => c.trim()).filter(Boolean);
            if (certs.length > 0) {
                params.certification = certs.join('|');
                params.certification_country = 'BR'; // Brazilian certifications
            }
        }

        // Runtime filter
        if (runtimeMin) {
            params['with_runtime.gte'] = parseInt(runtimeMin, 10);
        }
        if (runtimeMax) {
            params['with_runtime.lte'] = parseInt(runtimeMax, 10);
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

        // Include upcoming movies by default (unless includeUpcoming is explicitly false)
        if (includeUpcoming === false && !dateRange && !daysPast) {
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
