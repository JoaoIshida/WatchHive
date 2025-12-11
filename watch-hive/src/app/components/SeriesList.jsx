"use client";
import { useEffect, useState } from 'react';
import ContentCard from './ContentCard';
import LoadingCard from './LoadingCard';

const SeriesList = ({ page, filters, sortConfig, onPageChange }) => {
    const [series, setSeries] = useState([]);
    const [allSeries, setAllSeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        const fetchPopularSeries = async () => {
            setLoading(true);
            setError(null);
            try {
                // Check if airing today filter is active
                let apiEndpoint = '/api/popularSeries';
                let queryParams;
                
                if (filters.airingToday === true) {
                    // Use airing today endpoint instead
                    apiEndpoint = '/api/trending/series/airing-today';
                    // Airing today endpoint doesn't support all filters, so only send page
                    queryParams = new URLSearchParams();
                    queryParams.set('page', page.toString());
                } else {
                    // Build query string with filters and sorting
                    queryParams = new URLSearchParams();
                    queryParams.set('page', page.toString());
                    
                    // Add filters
                    if (filters.genres && filters.genres.length > 0) {
                        queryParams.set('genres', filters.genres.join(','));
                    }
                    // Years - send first year to API (TMDB limitation)
                    if (filters.year) {
                        const yearValue = Array.isArray(filters.year) ? filters.year[0] : filters.year;
                        queryParams.set('year', yearValue);
                    }
                    if (filters.minRating) {
                        queryParams.set('minRating', filters.minRating);
                    }
                    if (filters.maxRating) {
                        queryParams.set('maxRating', filters.maxRating);
                    }
                    if (filters.certification) {
                        // Handle both array and string
                        const certs = Array.isArray(filters.certification) 
                            ? filters.certification 
                            : [filters.certification];
                        if (certs.length > 0) {
                            queryParams.set('certification', certs.join(','));
                        }
                    }
                    if (filters.dateRange) {
                        queryParams.set('dateRange', filters.dateRange);
                    }
                    if (filters.daysPast) {
                        queryParams.set('daysPast', filters.daysPast);
                    }
                    if (filters.watchProviders) {
                        // Handle both array and string
                        const providers = Array.isArray(filters.watchProviders) 
                            ? filters.watchProviders 
                            : [filters.watchProviders];
                        if (providers.length > 0) {
                            queryParams.set('watchProviders', providers.join(','));
                        }
                    }
                    // Keywords - send just the IDs to the API
                    if (filters.keywords && filters.keywords.length > 0) {
                        const keywordIds = filters.keywords.map(k => k.id).join(',');
                        queryParams.set('keywords', keywordIds);
                    }
                    // Always send includeUpcoming parameter so API knows whether to filter
                    if (filters.includeUpcoming !== undefined) {
                        queryParams.set('includeUpcoming', filters.includeUpcoming.toString());
                    }
                    // Season filters - send to API for server-side filtering
                    if (filters.seasonsMin) {
                        queryParams.set('seasonsMin', filters.seasonsMin);
                    }
                    if (filters.seasonsMax) {
                        queryParams.set('seasonsMax', filters.seasonsMax);
                    }
                    
                    // Add sorting (not supported by airing today endpoint)
                    const sortByValue = sortConfig.sortBy === 'popularity' ? 'popularity' :
                                       sortConfig.sortBy === 'rating' ? 'vote_average' :
                                       sortConfig.sortBy === 'release_date' ? 'first_air_date' :
                                       'name';
                    const sortOrder = sortConfig.sortOrder === 'asc' ? 'asc' : 'desc';
                    queryParams.set('sortBy', `${sortByValue}.${sortOrder}`);
                }

                const response = await fetch(`${apiEndpoint}?${queryParams.toString()}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch popular series');
                }
                const data = await response.json();
                setAllSeries(data.results);
                setTotalPages(data.total_pages || 1);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPopularSeries();
    }, [page, filters.genres, filters.year, filters.minRating, filters.maxRating, filters.certification, filters.dateRange, filters.daysPast, filters.includeUpcoming, filters.watchProviders, filters.keywords, filters.airingToday, filters.seasonsMin, filters.seasonsMax, sortConfig]);

    // Use data directly from API (season filtering is now done server-side)
    useEffect(() => {
        setSeries(allSeries);
    }, [allSeries]);

    if (loading) {
        return (
            <div className="flex-1 min-w-0">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    <LoadingCard count={12} />
                </div>
            </div>
        );
    }

    if (error) {
        return <div className="text-center py-6 text-red-400">{`Error: ${error}`}</div>;
    }

    return (
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-center my-6 gap-2">
                <button
                    onClick={() => onPageChange(Math.max(page - 1, 1))}
                    className="futuristic-button disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={page === 1}
                >
                    Prev
                </button>
                <span className="bg-charcoal-800/80 border border-amber-500/50 text-amber-500 font-bold p-2 px-4 rounded-lg">{page}</span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    className="futuristic-button disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={page >= totalPages}
                >
                    Next
                </button>
            </div>
            {series.length === 0 ? (
                <div className="text-center py-6 text-white">No popular series available</div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {series.map((serie) => (
                        <ContentCard
                            key={serie.id}
                            item={serie}
                            mediaType="tv"
                            href={`/series/${serie.id}`}
                        />
                    ))}
                </div>
            )}
            <div className="flex items-center justify-center my-6 gap-2">
                <button
                    onClick={() => onPageChange(Math.max(page - 1, 1))}
                    className="futuristic-button disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={page === 1}
                >
                    Prev
                </button>
                <span className="bg-charcoal-800/80 border border-amber-500/50 text-amber-500 font-bold p-2 px-4 rounded-lg">{page}</span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    className="futuristic-button disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={page >= totalPages}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default SeriesList;

