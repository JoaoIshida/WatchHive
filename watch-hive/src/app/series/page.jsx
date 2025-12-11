"use client";
import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import LoadingCard from '../components/LoadingCard';
import UnifiedFilter from '../components/UnifiedFilter';
import ActiveFilters from '../components/ActiveFilters';
import SeriesList from '../components/SeriesList';

const PopularSeriesContent = () => {
    const [page, setPage] = useState(1);
    const [genres, setGenres] = useState([]);
    const [watchProviders, setWatchProviders] = useState([]);
    const [sortConfig, setSortConfig] = useState({ sortBy: 'popularity', sortOrder: 'desc' });
    const [filters, setFilters] = useState({});
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const queryPage = searchParams.get('page');
    const isInitialMount = useRef(true);
    const hasInitializedFromURL = useRef(false);
    const previousFiltersRef = useRef({});

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
        // Years can be single value or comma-separated
        const urlYear = searchParams.get('year');
        if (urlYear) {
            const years = urlYear.split(',').map(y => y.trim()).filter(Boolean);
            urlFilters.year = years.length === 1 ? years[0] : years;
        }
        const urlMinRating = searchParams.get('minRating');
        if (urlMinRating) {
            urlFilters.minRating = urlMinRating;
        }
        const urlMaxRating = searchParams.get('maxRating');
        if (urlMaxRating) {
            urlFilters.maxRating = urlMaxRating;
        }
        const urlCertification = searchParams.get('certification');
        if (urlCertification) {
            // Handle both single value and comma-separated values
            const certs = urlCertification.split(',').map(c => c.trim()).filter(Boolean);
            urlFilters.certification = certs.length === 1 ? certs[0] : certs;
        }
        const urlDateRange = searchParams.get('dateRange');
        if (urlDateRange) {
            urlFilters.dateRange = urlDateRange;
        }
        const urlDaysPast = searchParams.get('daysPast');
        if (urlDaysPast) {
            urlFilters.daysPast = urlDaysPast;
        }
        const urlAiringToday = searchParams.get('airingToday');
        if (urlAiringToday === 'true') {
            urlFilters.airingToday = true;
        }
        const urlIncludeUpcoming = searchParams.get('includeUpcoming');
        if (urlIncludeUpcoming !== null) {
            urlFilters.includeUpcoming = urlIncludeUpcoming === 'true';
        } else {
            // Default to true if not specified
            urlFilters.includeUpcoming = true;
        }
        const urlSeasonsMin = searchParams.get('seasonsMin');
        if (urlSeasonsMin) {
            urlFilters.seasonsMin = urlSeasonsMin;
        }
        const urlSeasonsMax = searchParams.get('seasonsMax');
        if (urlSeasonsMax) {
            urlFilters.seasonsMax = urlSeasonsMax;
        }
        const urlWatchProviders = searchParams.get('watchProviders');
        if (urlWatchProviders) {
            // Handle both single value and comma-separated values
            const providers = urlWatchProviders.split(',').map(p => p.trim()).filter(Boolean);
            urlFilters.watchProviders = providers.length === 1 ? providers[0] : providers;
        }
        // Keywords are stored as id:name pairs
        const urlKeywords = searchParams.get('keywords');
        if (urlKeywords) {
            try {
                const keywordPairs = urlKeywords.split(',').filter(Boolean);
                urlFilters.keywords = keywordPairs.map(pair => {
                    const [id, ...nameParts] = pair.split(':');
                    return { id: parseInt(id, 10), name: nameParts.join(':') };
                }).filter(k => k.id && k.name);
            } catch (e) {
                console.error('Error parsing keywords from URL:', e);
            }
        }
        if (Object.keys(urlFilters).length > 0) {
            setFilters(urlFilters);
            previousFiltersRef.current = urlFilters; // Set previous filters to prevent reset on initial load
        }
        
        // Mark URL initialization as complete
        hasInitializedFromURL.current = true;
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
        // Years - can be string or array
        if (newFilters.year) {
            const years = Array.isArray(newFilters.year) 
                ? newFilters.year 
                : [newFilters.year];
            if (years.length > 0) {
                params.set('year', years.join(','));
            }
        }
        if (newFilters.minRating) {
            params.set('minRating', newFilters.minRating);
        }
        if (newFilters.maxRating) {
            params.set('maxRating', newFilters.maxRating);
        }
        if (newFilters.certification) {
            // Handle both array and string
            const certs = Array.isArray(newFilters.certification) 
                ? newFilters.certification 
                : [newFilters.certification];
            if (certs.length > 0) {
                params.set('certification', certs.join(','));
            }
        }
        if (newFilters.dateRange) {
            params.set('dateRange', newFilters.dateRange);
        }
        if (newFilters.daysPast) {
            params.set('daysPast', newFilters.daysPast);
        }
        if (newFilters.airingToday === true) {
            params.set('airingToday', 'true');
        }
        // Only add includeUpcoming to URL if it's explicitly false (default is true)
        if (newFilters.includeUpcoming === false) {
            params.set('includeUpcoming', 'false');
        }
        if (newFilters.seasonsMin) {
            params.set('seasonsMin', newFilters.seasonsMin);
        }
        if (newFilters.seasonsMax) {
            params.set('seasonsMax', newFilters.seasonsMax);
        }
        if (newFilters.watchProviders) {
            // Handle both array and string
            const providers = Array.isArray(newFilters.watchProviders) 
                ? newFilters.watchProviders 
                : [newFilters.watchProviders];
            if (providers.length > 0) {
                params.set('watchProviders', providers.join(','));
            }
        }
        // Keywords are stored as id:name pairs
        if (newFilters.keywords && newFilters.keywords.length > 0) {
            const keywordStr = newFilters.keywords.map(k => `${k.id}:${k.name}`).join(',');
            params.set('keywords', keywordStr);
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

    // Fetch watch providers
    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const response = await fetch('/api/watchProviders?mediaType=tv');
                if (response.ok) {
                    const data = await response.json();
                    setWatchProviders(data.providers || []);
                }
            } catch (error) {
                console.error('Error fetching watch providers:', error);
            }
        };
        fetchProviders();
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
        if (!hasInitializedFromURL.current) {
            previousFiltersRef.current = filters;
            return; // Skip until URL initialization is complete
        }
        // Only reset if filters actually changed (not just initialized)
        const filtersChanged = JSON.stringify(previousFiltersRef.current) !== JSON.stringify(filters);
        if (filtersChanged && Object.keys(filters).length > 0 && page > 1) {
            setPage(1);
        }
        previousFiltersRef.current = filters;
    }, [filters, page]);

    // Memoize callbacks to prevent unnecessary re-renders
    const handleSortChange = useCallback((newSortConfig) => {
        setSortConfig(newSortConfig);
    }, []);

    const handleFilterChange = useCallback((newFilters) => {
        setFilters(newFilters);
    }, []);

    const handlePageChange = useCallback((newPage) => {
        setPage(newPage);
    }, []);

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">Popular Series</h1>
            
            {/* Unified Filter - Mobile: Top, Desktop: Sidebar */}
            <UnifiedFilter
                onSortChange={handleSortChange}
                onFilterChange={handleFilterChange}
                genres={genres}
                showDateFilter={true}
                mediaType="tv"
                sortConfig={sortConfig}
                filters={filters}
            />

            {/* Desktop Layout with Sidebar */}
            <div className="flex gap-6">
                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    {/* Active Filters - Desktop only */}
                    <div className="hidden sm:block">
                        <ActiveFilters
                            filters={filters}
                            genres={genres}
                            watchProviders={watchProviders}
                            onFilterChange={handleFilterChange}
                            onSortChange={handleSortChange}
                            sortConfig={sortConfig}
                        />
                    </div>
                    <SeriesList
                        page={page}
                        filters={filters}
                        sortConfig={sortConfig}
                        onPageChange={handlePageChange}
                    />
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
