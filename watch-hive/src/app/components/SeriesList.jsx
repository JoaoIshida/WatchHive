"use client";
import { useEffect, useState } from 'react';
import ContentCard from './ContentCard';
import LoadingCard from './LoadingCard';

const SeriesList = ({ page, filters, sortConfig, onPageChange }) => {
    const [series, setSeries] = useState([]);
    const [allSeries, setAllSeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPopularSeries = async () => {
            setLoading(true);
            setError(null);
            try {
                // Build query string with filters and sorting
                const queryParams = new URLSearchParams();
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
                if (filters.includeUpcoming) {
                    queryParams.set('includeUpcoming', 'true');
                }
                
                // Add sorting
                const sortByValue = sortConfig.sortBy === 'popularity' ? 'popularity' :
                                   sortConfig.sortBy === 'rating' ? 'vote_average' :
                                   sortConfig.sortBy === 'release_date' ? 'first_air_date' :
                                   'name';
                const sortOrder = sortConfig.sortOrder === 'asc' ? 'asc' : 'desc';
                queryParams.set('sortBy', `${sortByValue}.${sortOrder}`);

                const response = await fetch(`/api/popularSeries?${queryParams.toString()}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch popular series');
                }
                const data = await response.json();
                setAllSeries(data.results);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPopularSeries();
    }, [page, filters.genres, filters.year, filters.minRating, filters.maxRating, filters.certification, filters.dateRange, filters.daysPast, filters.includeUpcoming, filters.watchProviders, filters.keywords, sortConfig]);

    // Client-side filtering for seasons
    useEffect(() => {
        let filtered = [...allSeries];

        // Filter by seasons
        if (filters.seasonsMin || filters.seasonsMax) {
            const minSeasons = filters.seasonsMin ? parseInt(filters.seasonsMin, 10) : 1;
            const maxSeasons = filters.seasonsMax ? parseInt(filters.seasonsMax, 10) : 20;
            filtered = filtered.filter(serie => {
                const seasons = serie.number_of_seasons || 0;
                return seasons >= minSeasons && seasons <= maxSeasons;
            });
        }

        setSeries(filtered);
    }, [allSeries, filters.seasonsMin, filters.seasonsMax]);

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
                <span className="bg-futuristic-blue-800/80 border border-futuristic-yellow-500/50 text-futuristic-yellow-400 font-bold p-2 px-4 rounded-lg">{page}</span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    className="futuristic-button"
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
                <span className="bg-futuristic-blue-800/80 border border-futuristic-yellow-500/50 text-futuristic-yellow-400 font-bold p-2 px-4 rounded-lg">{page}</span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    className="futuristic-button"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default SeriesList;

