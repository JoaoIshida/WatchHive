"use client";
import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import LoadingSpinner from '../components/LoadingSpinner';
import LoadingCard from '../components/LoadingCard';
import SortFilter from '../components/SortFilter';
import FilterSidebar from '../components/FilterSidebar';
import ActiveFilters from '../components/ActiveFilters';
import ContentCard from '../components/ContentCard';

const PopularSeriesContent = () => {
    const [series, setSeries] = useState([]);
    const [allSeries, setAllSeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [genres, setGenres] = useState([]);
    const [sortConfig, setSortConfig] = useState({ sortBy: 'popularity', sortOrder: 'desc' });
    const [filters, setFilters] = useState({});
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const queryPage = searchParams.get('page');
    const isInitialMount = useRef(true);

    // Initialize state from URL params
    useEffect(() => {
        // Initialize page
        const urlPage = searchParams.get('page');
        if (urlPage) {
            setPage(Number(urlPage));
        }

        // Initialize sort config
        const urlSortBy = searchParams.get('sortBy');
        if (urlSortBy) {
            const [sortField, sortOrder] = urlSortBy.split('.');
            let sortBy = 'popularity';
            if (sortField === 'vote_average') sortBy = 'rating';
            else if (sortField === 'first_air_date') sortBy = 'release_date';
            else if (sortField === 'name') sortBy = 'title';
            setSortConfig({ sortBy, sortOrder: sortOrder || 'desc' });
        }

        // Initialize filters
        const urlFilters = {};
        const urlGenres = searchParams.get('genres');
        if (urlGenres) {
            urlFilters.genres = urlGenres.split(',').map(Number).filter(Boolean);
        }
        const urlYear = searchParams.get('year');
        if (urlYear) {
            urlFilters.year = urlYear;
        }
        const urlMinRating = searchParams.get('minRating');
        if (urlMinRating) {
            urlFilters.minRating = urlMinRating;
        }
        const urlMaxRating = searchParams.get('maxRating');
        if (urlMaxRating) {
            urlFilters.maxRating = urlMaxRating;
        }
        const urlDateRange = searchParams.get('dateRange');
        if (urlDateRange) {
            urlFilters.dateRange = urlDateRange;
        }
        const urlDaysPast = searchParams.get('daysPast');
        if (urlDaysPast) {
            urlFilters.daysPast = urlDaysPast;
        }
        const urlIncludeUpcoming = searchParams.get('includeUpcoming');
        if (urlIncludeUpcoming === 'true') {
            urlFilters.includeUpcoming = true;
        }
        if (Object.keys(urlFilters).length > 0) {
            setFilters(urlFilters);
        }
    }, []); // Only run on mount

    // Update URL when filters, sort, or page changes
    const updateURL = useCallback((newPage, newFilters, newSortConfig) => {
        const params = new URLSearchParams();
        
        if (newPage > 1) {
            params.set('page', newPage.toString());
        }
        
        // Add filters to URL
        if (newFilters.genres && newFilters.genres.length > 0) {
            params.set('genres', newFilters.genres.join(','));
        }
        if (newFilters.year) {
            params.set('year', newFilters.year);
        }
        if (newFilters.minRating) {
            params.set('minRating', newFilters.minRating);
        }
        if (newFilters.maxRating) {
            params.set('maxRating', newFilters.maxRating);
        }
        if (newFilters.dateRange) {
            params.set('dateRange', newFilters.dateRange);
        }
        if (newFilters.daysPast) {
            params.set('daysPast', newFilters.daysPast);
        }
        if (newFilters.includeUpcoming) {
            params.set('includeUpcoming', 'true');
        }
        
        // Add sorting to URL
        const sortByValue = newSortConfig.sortBy === 'popularity' ? 'popularity' :
                           newSortConfig.sortBy === 'rating' ? 'vote_average' :
                           newSortConfig.sortBy === 'release_date' ? 'first_air_date' :
                           'name';
        const sortOrder = newSortConfig.sortOrder || 'desc';
        if (sortByValue !== 'popularity' || sortOrder !== 'desc') {
            params.set('sortBy', `${sortByValue}.${sortOrder}`);
        }
        
        const queryString = params.toString();
        const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
        router.replace(newUrl, { scroll: false });
    }, [pathname, router]);

    // Fetch genres
    useEffect(() => {
        const fetchGenres = async () => {
            try {
                const response = await fetch('/api/genres?type=tv');
                if (response.ok) {
                    const data = await response.json();
                    setGenres(data);
                }
            } catch (error) {
                console.error('Error fetching genres:', error);
            }
        };
        fetchGenres();
    }, []);

    // Update URL when filters change (but not on initial mount)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        updateURL(page, filters, sortConfig);
    }, [page, filters, sortConfig, updateURL]);

    // Reset page to 1 when filters change (but not on initial load)
    useEffect(() => {
        if (Object.keys(filters).length > 0 && page > 1) {
            setPage(1);
        }
    }, [filters]);

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
                if (filters.year) {
                    queryParams.set('year', filters.year);
                }
                if (filters.minRating) {
                    queryParams.set('minRating', filters.minRating);
                }
                if (filters.maxRating) {
                    queryParams.set('maxRating', filters.maxRating);
                }
                if (filters.dateRange) {
                    queryParams.set('dateRange', filters.dateRange);
                }
                if (filters.daysPast) {
                    queryParams.set('daysPast', filters.daysPast);
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
                setSeries(data.results);
                setAllSeries(data.results); // Keep for reference, but filtering is done server-side
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPopularSeries();
    }, [page, filters, sortConfig]);


    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">Popular Series</h1>
                <div className="flex gap-6">
                    <div className="hidden sm:block w-64 flex-shrink-0">
                        <div className="futuristic-card p-4">
                            <div className="h-96 bg-futuristic-blue-900/40 rounded-lg animate-pulse"></div>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            <LoadingCard count={12} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    if (error) return <div className="text-center py-6 text-red-400">{`Error: ${error}`}</div>;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">Popular Series</h1>
            
            {/* Mobile Filter - Hidden on sm and above */}
            <div className="sm:hidden mb-4">
                <SortFilter
                    onSortChange={setSortConfig}
                    onFilterChange={setFilters}
                    genres={genres}
                    showDateFilter={true}
                    sortConfig={sortConfig}
                    filters={filters}
                />
            </div>

            {/* Desktop Layout with Sidebar */}
            <div className="flex gap-6">
                {/* Desktop Sidebar Filter - Hidden on mobile */}
                <FilterSidebar
                    onSortChange={setSortConfig}
                    onFilterChange={setFilters}
                    genres={genres}
                    showDateFilter={true}
                    sortConfig={sortConfig}
                    filters={filters}
                />

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    {/* Active Filters - Desktop only */}
                    <div className="hidden sm:block">
                        <ActiveFilters
                            filters={filters}
                            genres={genres}
                            onFilterChange={setFilters}
                            onSortChange={setSortConfig}
                            sortConfig={sortConfig}
                        />
                    </div>
                    <div className="flex items-center justify-center my-6 gap-2">
                        <button
                            onClick={() => setPage((prevPage) => Math.max(prevPage - 1, 1))}
                            className="futuristic-button disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={page === 1}
                        >
                            Prev
                        </button>
                        <span className="bg-futuristic-blue-800/80 border border-futuristic-yellow-500/50 text-futuristic-yellow-400 font-bold p-2 px-4 rounded-lg">{page}</span>
                        <button
                            onClick={() => setPage((prevPage) => prevPage + 1)}
                            className="futuristic-button"
                        >
                            Next
                        </button>
                    </div>
                    {
                        series.length === 0 ? (
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
                        )
                    }
                    <div className="flex items-center justify-center my-6 gap-2">
                        <button
                            onClick={() => setPage((prevPage) => Math.max(prevPage - 1, 1))}
                            className="futuristic-button disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={page === 1}
                        >
                            Prev
                        </button>
                        <span className="bg-futuristic-blue-800/80 border border-futuristic-yellow-500/50 text-futuristic-yellow-400 font-bold p-2 px-4 rounded-lg">{page}</span>
                        <button
                            onClick={() => setPage((prevPage) => prevPage + 1)}
                            className="futuristic-button"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PopularSeriesPage = () => {
    return (
        <Suspense fallback={
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">Popular Series</h1>
                <div className="flex gap-6">
                    <div className="hidden sm:block w-64 flex-shrink-0">
                        <div className="futuristic-card p-4">
                            <div className="h-96 bg-futuristic-blue-900/40 rounded-lg animate-pulse"></div>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            <LoadingCard count={12} />
                        </div>
                    </div>
                </div>
            </div>
        }>
            <PopularSeriesContent />
        </Suspense>
    );
};

export default PopularSeriesPage;
