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
            language: 'en-CA',
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

        // Season filter - needs to be done server-side for proper pagination
        const seasonsMin = searchParams.get('seasonsMin');
        const seasonsMax = searchParams.get('seasonsMax');
        const hasSeasonFilter = (seasonsMin && parseInt(seasonsMin, 10) > 1) || 
                               (seasonsMax && parseInt(seasonsMax, 10) < 20);

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

        let data;

        // If season filter is enabled, fetch multiple pages and filter by season count
        if (hasSeasonFilter) {
            try {
                const minSeasons = seasonsMin ? parseInt(seasonsMin, 10) : 1;
                const maxSeasons = seasonsMax ? parseInt(seasonsMax, 10) : 20;
                
                // Fetch multiple pages from discover to get enough results after filtering
                let allFilteredResults = [];
                let discoverPage = 1;
                const maxDiscoverPages = 10; // Fetch up to 10 pages to ensure we have enough results
                const itemsPerPage = 20;
                const targetResults = page * itemsPerPage;

                while (discoverPage <= maxDiscoverPages && allFilteredResults.length < targetResults) {
                    const discoverParams = { ...params, page: discoverPage };
                    const discoverData = await fetchTMDB('/discover/tv', discoverParams);
                    
                    if (discoverData.results && discoverData.results.length > 0) {
                        // Fetch season counts for all series in this page in parallel
                        const seasonCountPromises = discoverData.results.map(async (serie) => {
                            try {
                                // Use the series detail endpoint to get accurate season count
                                const seriesDetail = await fetchTMDB(`/tv/${serie.id}`, {
                                    language: 'en-CA',
                                });
                                
                                // Count valid seasons (season_number >= 0)
                                const validSeasons = (seriesDetail.seasons || []).filter(season => 
                                    season.season_number !== null && 
                                    season.season_number !== undefined && 
                                    typeof season.season_number === 'number' &&
                                    season.season_number >= 0
                                );
                                const seasonCount = validSeasons.length;
                                
                                // Check if season count is within the range
                                if (seasonCount < minSeasons || seasonCount > maxSeasons) {
                                    return null;
                                }
                                
                                return serie;
                            } catch (error) {
                                console.error(`Error fetching details for series ${serie.id}:`, error);
                                // Fallback to number_of_seasons if API call fails
                                const seasons = serie.number_of_seasons || 0;
                                if (seasons >= minSeasons && seasons <= maxSeasons) {
                                    return serie;
                                }
                                return null;
                            }
                        });
                        
                        const filtered = (await Promise.all(seasonCountPromises)).filter(serie => serie !== null);
                        allFilteredResults = [...allFilteredResults, ...filtered];
                        discoverPage++;
                    } else {
                        break;
                    }
                }

                // Now paginate the filtered results properly
                const startIndex = (page - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedResults = allFilteredResults.slice(startIndex, endIndex);

                data = {
                    results: paginatedResults,
                    page: page,
                    total_results: allFilteredResults.length,
                    total_pages: Math.ceil(allFilteredResults.length / itemsPerPage),
                };
            } catch (error) {
                console.error('Error filtering by seasons:', error);
                // Fallback to regular discover if error
                data = await fetchTMDB('/discover/tv', params);
            }
        } else {
            // Normal flow without season filter
            data = await fetchTMDB('/discover/tv', params);
        }

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
