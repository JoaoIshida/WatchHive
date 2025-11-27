"use client";
import { useState, useMemo, useEffect, memo } from 'react';
import RangeSlider from './RangeSlider';
import KeywordSearch from './KeywordSearch';
import YearSearch from './YearSearch';
import { formatRuntime } from '../utils/runtimeFormatter';

const FilterSidebar = memo(({ onSortChange, onFilterChange, genres = [], showDateFilter = true, mediaType = 'movie', sortConfig = { sortBy: 'popularity', sortOrder: 'desc' }, filters = {} }) => {
    const [sortBy, setSortBy] = useState(sortConfig.sortBy || 'popularity');
    const [sortOrder, setSortOrder] = useState(sortConfig.sortOrder || 'desc');
    const [selectedGenres, setSelectedGenres] = useState([]);
    const [selectedCertifications, setSelectedCertifications] = useState([]);
    const [selectedYears, setSelectedYears] = useState([]);
    const [ratingFilter, setRatingFilter] = useState('');
    const [runtimeMinFilter, setRuntimeMinFilter] = useState(0);
    const [runtimeMaxFilter, setRuntimeMaxFilter] = useState(240);
    const [dateRangeFilter, setDateRangeFilter] = useState('');
    const [daysPastFilter, setDaysPastFilter] = useState('');
    const [includeUpcoming, setIncludeUpcoming] = useState(true);
    const [seasonsMinFilter, setSeasonsMinFilter] = useState(1);
    const [seasonsMaxFilter, setSeasonsMaxFilter] = useState(20);
    const [selectedProviders, setSelectedProviders] = useState([]);
    const [watchProviders, setWatchProviders] = useState([]);
    const [selectedKeywords, setSelectedKeywords] = useState([]);
    
    // Available certifications (Brazilian ratings)
    const certifications = ['L', '10', '12', '14', '16', '18'];
    
    // Collapsible sections state
    const [basicFiltersExpanded, setBasicFiltersExpanded] = useState(true);
    const [contentTypeExpanded, setContentTypeExpanded] = useState(true);
    const [mediaInfoExpanded, setMediaInfoExpanded] = useState(true);
    const [dateFiltersExpanded, setDateFiltersExpanded] = useState(true);
    const [watchProvidersExpanded, setWatchProvidersExpanded] = useState(true);
    
    // Collapsible section component
    const CollapsibleSection = ({ title, expanded, onToggle, children }) => (
        <div className="mb-4">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between mb-3 text-sm font-semibold text-futuristic-yellow-400/90 hover:text-futuristic-yellow-400 transition-colors"
            >
                <span>{title}</span>
                <svg
                    className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="pb-2">
                    {children}
                </div>
            </div>
        </div>
    );

    // Sync internal state with prop changes
    useEffect(() => {
        if (sortConfig.sortBy) {
            setSortBy(sortConfig.sortBy);
        }
        if (sortConfig.sortOrder) {
            setSortOrder(sortConfig.sortOrder);
        }
    }, [sortConfig.sortBy, sortConfig.sortOrder]);

    // Sync filter state with prop changes
    useEffect(() => {
        setSelectedGenres(filters.genres && Array.isArray(filters.genres) ? filters.genres : []);
        // Handle years - can be string (single year) or array (multiple years)
        if (filters.year) {
            if (Array.isArray(filters.year)) {
                setSelectedYears(filters.year.map(y => parseInt(y, 10)).filter(y => !isNaN(y)));
            } else {
                const year = parseInt(filters.year, 10);
                setSelectedYears(isNaN(year) ? [] : [year]);
            }
        } else {
            setSelectedYears([]);
        }
        if (filters.minRating) {
            setRatingFilter(filters.minRating);
        } else if (filters.maxRating) {
            setRatingFilter('lt5');
        } else {
            setRatingFilter('');
        }
        // Handle certification - can be string or array
        if (filters.certification) {
            if (Array.isArray(filters.certification)) {
                setSelectedCertifications(filters.certification);
            } else {
                setSelectedCertifications([filters.certification]);
            }
        } else {
            setSelectedCertifications([]);
        }
        setRuntimeMinFilter(filters.runtimeMin ? parseInt(filters.runtimeMin, 10) : 0);
        setRuntimeMaxFilter(filters.runtimeMax ? parseInt(filters.runtimeMax, 10) : 240);
        setDateRangeFilter(filters.dateRange || '');
        setDaysPastFilter(filters.daysPast || '');
        setIncludeUpcoming(filters.includeUpcoming !== undefined ? filters.includeUpcoming : true);
        setSeasonsMinFilter(filters.seasonsMin ? parseInt(filters.seasonsMin, 10) : 1);
        setSeasonsMaxFilter(filters.seasonsMax ? parseInt(filters.seasonsMax, 10) : 20);
        // Handle watch providers - can be string or array
        if (filters.watchProviders) {
            if (Array.isArray(filters.watchProviders)) {
                setSelectedProviders(filters.watchProviders.map(p => parseInt(p, 10)));
            } else {
                setSelectedProviders([parseInt(filters.watchProviders, 10)]);
            }
        } else {
            setSelectedProviders([]);
        }
        // Handle keywords - array of objects with id and name
        if (filters.keywords && Array.isArray(filters.keywords)) {
            setSelectedKeywords(filters.keywords);
        } else {
            setSelectedKeywords([]);
        }
    }, [JSON.stringify(filters)]);
    
    // Fetch watch providers on mount
    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const response = await fetch(`/api/watchProviders?mediaType=${mediaType}`);
                if (response.ok) {
                    const data = await response.json();
                    setWatchProviders(data.providers || []);
                }
            } catch (error) {
                console.error('Error fetching watch providers:', error);
            }
        };
        fetchProviders();
    }, [mediaType]);

    // Generate year options
    const currentYear = new Date().getFullYear();
    const yearOptions = useMemo(() => {
        const years = [];
        for (let year = currentYear + 1; year >= 1900; year--) {
            years.push(year);
        }
        return years;
    }, [currentYear]);

    const handleSortChange = (newSortBy, newSortOrder) => {
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
        onSortChange({ sortBy: newSortBy, sortOrder: newSortOrder });
    };

    const buildFilterObject = (updates = {}) => {
        const filterObj = {};
        const genres = updates.genres !== undefined ? updates.genres : selectedGenres;
        const certifications = updates.certifications !== undefined ? updates.certifications : selectedCertifications;
        const years = updates.years !== undefined ? updates.years : selectedYears;
        const rating = updates.rating !== undefined ? updates.rating : ratingFilter;
        const runtimeMin = updates.runtimeMin !== undefined ? updates.runtimeMin : runtimeMinFilter;
        const runtimeMax = updates.runtimeMax !== undefined ? updates.runtimeMax : runtimeMaxFilter;
        const dateRange = updates.dateRange !== undefined ? updates.dateRange : dateRangeFilter;
        const daysPast = updates.daysPast !== undefined ? updates.daysPast : daysPastFilter;
        const includeUpcomingValue = updates.includeUpcoming !== undefined ? updates.includeUpcoming : includeUpcoming;
        const seasonsMin = updates.seasonsMin !== undefined ? updates.seasonsMin : seasonsMinFilter;
        const seasonsMax = updates.seasonsMax !== undefined ? updates.seasonsMax : seasonsMaxFilter;
        const providers = updates.providers !== undefined ? updates.providers : selectedProviders;
        const keywords = updates.keywords !== undefined ? updates.keywords : selectedKeywords;
        
        if (genres.length > 0) filterObj.genres = genres;
        if (certifications.length > 0) {
            // If only one certification, store as string for backward compatibility
            filterObj.certification = certifications.length === 1 ? certifications[0] : certifications;
        }
        // Years - store as array if multiple, string if single for backward compatibility
        if (years.length > 0) {
            filterObj.year = years.length === 1 ? years[0].toString() : years.map(y => y.toString());
        }
        if (rating) {
            if (rating === 'lt5') {
                filterObj.maxRating = '5';
            } else {
                filterObj.minRating = rating;
            }
        }
        // Only add runtime filters if they're not at default values
        if (runtimeMin && runtimeMin > 0) filterObj.runtimeMin = runtimeMin.toString();
        if (runtimeMax && runtimeMax < 240) filterObj.runtimeMax = runtimeMax.toString();
        if (dateRange) filterObj.dateRange = dateRange;
        if (daysPast) filterObj.daysPast = daysPast;
        // Include upcoming is true by default, always set it
        filterObj.includeUpcoming = includeUpcomingValue;
        // Only add season filters if they're not at default values
        if (seasonsMin > 1) filterObj.seasonsMin = seasonsMin.toString();
        if (seasonsMax < 20) filterObj.seasonsMax = seasonsMax.toString();
        if (providers.length > 0) {
            filterObj.watchProviders = providers.length === 1 ? providers[0].toString() : providers.map(p => p.toString());
        }
        // Keywords - store as array of objects
        if (keywords.length > 0) {
            filterObj.keywords = keywords;
        }
        return filterObj;
    };

    const handleGenreToggle = (genreId) => {
        const newGenres = selectedGenres.includes(genreId)
            ? selectedGenres.filter(id => id !== genreId)
            : [...selectedGenres, genreId];
        setSelectedGenres(newGenres);
        onFilterChange(buildFilterObject({ genres: newGenres }));
    };

    const handleYearsChange = (newYears) => {
        setSelectedYears(newYears);
        onFilterChange(buildFilterObject({ years: newYears }));
    };

    const handleRatingChange = (rating) => {
        setRatingFilter(rating);
        onFilterChange(buildFilterObject({ rating }));
    };

    const handleRuntimeChange = ({ min, max }) => {
        setRuntimeMinFilter(min);
        setRuntimeMaxFilter(max);
        onFilterChange(buildFilterObject({ runtimeMin: min, runtimeMax: max }));
    };

    const handleCertificationToggle = (certification) => {
        const newCertifications = selectedCertifications.includes(certification)
            ? selectedCertifications.filter(c => c !== certification)
            : [...selectedCertifications, certification];
        setSelectedCertifications(newCertifications);
        onFilterChange(buildFilterObject({ certifications: newCertifications }));
    };

    const handleDateRangeChange = (range) => {
        setDateRangeFilter(range);
        onFilterChange(buildFilterObject({ dateRange: range }));
    };

    const handleDaysPastChange = (days) => {
        setDaysPastFilter(days);
        onFilterChange(buildFilterObject({ daysPast: days }));
    };

    const handleIncludeUpcomingChange = (checked) => {
        setIncludeUpcoming(checked);
        onFilterChange(buildFilterObject({ includeUpcoming: checked }));
    };

    const handleSeasonsChange = ({ min, max }) => {
        setSeasonsMinFilter(min);
        setSeasonsMaxFilter(max);
        onFilterChange(buildFilterObject({ seasonsMin: min, seasonsMax: max }));
    };
    
    const handleProviderToggle = (providerId) => {
        const newProviders = selectedProviders.includes(providerId)
            ? selectedProviders.filter(id => id !== providerId)
            : [...selectedProviders, providerId];
        setSelectedProviders(newProviders);
        onFilterChange(buildFilterObject({ providers: newProviders }));
    };

    const handleKeywordsChange = (newKeywords) => {
        setSelectedKeywords(newKeywords);
        onFilterChange(buildFilterObject({ keywords: newKeywords }));
    };

    const clearFilters = () => {
        setSelectedGenres([]);
        setSelectedCertifications([]);
        setSelectedYears([]);
        setRatingFilter('');
        setRuntimeMinFilter(0);
        setRuntimeMaxFilter(240);
        setDateRangeFilter('');
        setDaysPastFilter('');
        setIncludeUpcoming(true);
        setSeasonsMinFilter(1);
        setSeasonsMaxFilter(20);
        setSelectedProviders([]);
        setSelectedKeywords([]);
        setSortBy('popularity');
        setSortOrder('desc');
        onSortChange({ sortBy: 'popularity', sortOrder: 'desc' });
        onFilterChange({});
    };

    const getSortLabel = (option) => {
        if (option === 'popularity') return 'Trending';
        if (option === 'release_date') return 'Release Date';
        if (option === 'title') return 'Title';
        return option.charAt(0).toUpperCase() + option.slice(1);
    };

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (selectedGenres.length > 0) count += selectedGenres.length;
        if (selectedCertifications.length > 0) count += selectedCertifications.length;
        if (selectedYears.length > 0) count += selectedYears.length;
        if (ratingFilter) count++;
        if (runtimeMinFilter > 0 || runtimeMaxFilter < 240) count++;
        if (dateRangeFilter) count++;
        if (daysPastFilter) count++;
        if (includeUpcoming) count++;
        if (selectedKeywords.length > 0) count += selectedKeywords.length;
        return count;
    }, [selectedGenres.length, selectedCertifications.length, selectedYears.length, ratingFilter, runtimeMinFilter, runtimeMaxFilter, dateRangeFilter, daysPastFilter, includeUpcoming, selectedKeywords.length]);

    return (
        <div className="hidden sm:block w-64 flex-shrink-0">
            <div className="futuristic-card p-4 overflow-y-auto scrollbar">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-futuristic-yellow-400 futuristic-text-glow-yellow">Filters</h2>
                    {activeFiltersCount > 0 && (
                        <button
                            onClick={clearFilters}
                            className="text-xs text-futuristic-yellow-400/80 hover:text-futuristic-yellow-400 transition-colors"
                        >
                            Clear ({activeFiltersCount})
                        </button>
                    )}
                </div>

                {/* Sort Options */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-futuristic-yellow-400/90 mb-3">Sort By</h3>
                    <select
                        value={`${sortBy}.${sortOrder}`}
                        onChange={(e) => {
                            const [newSortBy, newSortOrder] = e.target.value.split('.');
                            handleSortChange(newSortBy, newSortOrder);
                        }}
                        className="w-full appearance-none bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-white text-sm px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-futuristic-yellow-500/50 focus:ring-1 focus:ring-futuristic-yellow-500/30 cursor-pointer hover:bg-futuristic-blue-700/80 transition-all"
                        style={{ 
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.5rem center',
                            backgroundSize: '1rem'
                        }}
                    >
                        <option value="popularity.desc" className="bg-futuristic-blue-900 text-white">Trending ↓</option>
                        <option value="popularity.asc" className="bg-futuristic-blue-900 text-white">Trending ↑</option>
                        <option value="rating.desc" className="bg-futuristic-blue-900 text-white">Rating ↓</option>
                        <option value="rating.asc" className="bg-futuristic-blue-900 text-white">Rating ↑</option>
                        <option value="release_date.desc" className="bg-futuristic-blue-900 text-white">Release Date ↓ (Newest)</option>
                        <option value="release_date.asc" className="bg-futuristic-blue-900 text-white">Release Date ↑ (Oldest)</option>
                        <option value="title.asc" className="bg-futuristic-blue-900 text-white">Title A-Z</option>
                        <option value="title.desc" className="bg-futuristic-blue-900 text-white">Title Z-A</option>
                    </select>
                </div>

                {/* Include Upcoming */}
                <div className="mb-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeUpcoming}
                            onChange={(e) => handleIncludeUpcomingChange(e.target.checked)}
                            className="w-4 h-4 rounded bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-futuristic-yellow-500 focus:ring-futuristic-yellow-500/30 focus:ring-1 cursor-pointer"
                        />
                        <span className="text-sm text-white/90">Include Upcoming</span>
                    </label>
                </div>

                {/* Year Search - Always visible */}
                <div className="mb-6">
                    <YearSearch
                        selectedYears={selectedYears}
                        onYearsChange={handleYearsChange}
                    />
                </div>

                {/* Basic Filters Section */}
                <CollapsibleSection
                    title="Basic Filters"
                    expanded={basicFiltersExpanded}
                    onToggle={() => setBasicFiltersExpanded(!basicFiltersExpanded)}
                >

                    {/* Rating Filter */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-futuristic-yellow-400/90 mb-3">Rating</h3>
                        <select
                            value={ratingFilter}
                            onChange={(e) => handleRatingChange(e.target.value)}
                            className="w-full appearance-none bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-white text-sm px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-futuristic-yellow-500/50 focus:ring-1 focus:ring-futuristic-yellow-500/30 cursor-pointer hover:bg-futuristic-blue-700/80 transition-all"
                            style={{ 
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.5rem center',
                                backgroundSize: '1rem'
                            }}
                        >
                            <option value="" className="bg-futuristic-blue-900 text-white">All Ratings</option>
                            <option value="9" className="bg-futuristic-blue-900 text-white">9+ ⭐</option>
                            <option value="8" className="bg-futuristic-blue-900 text-white">8+ ⭐</option>
                            <option value="7" className="bg-futuristic-blue-900 text-white">7+ ⭐</option>
                            <option value="6" className="bg-futuristic-blue-900 text-white">6+ ⭐</option>
                            <option value="5" className="bg-futuristic-blue-900 text-white">5+ ⭐</option>
                            <option value="lt5" className="bg-futuristic-blue-900 text-white">&lt;5 ⭐</option>
                        </select>
                    </div>

                    {/* Certification Filter */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-futuristic-yellow-400/90 mb-3">Certification</h3>
                        <div className="max-h-64 overflow-y-auto scrollbar futuristic-card p-3 bg-futuristic-blue-900/40 border border-futuristic-blue-500/20 rounded-lg">
                            <div className="flex flex-wrap gap-2">
                                {certifications.map((cert) => (
                                    <button
                                        key={cert}
                                        onClick={() => handleCertificationToggle(cert)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            selectedCertifications.includes(cert)
                                                ? 'bg-futuristic-yellow-500 text-black shadow-glow-yellow'
                                                : 'bg-futuristic-blue-800/60 text-white/90 hover:bg-futuristic-blue-700/60 border border-futuristic-blue-500/30'
                                        }`}
                                    >
                                        {cert}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* Media Info Section */}
                <CollapsibleSection
                    title="Media Info"
                    expanded={mediaInfoExpanded}
                    onToggle={() => setMediaInfoExpanded(!mediaInfoExpanded)}
                >
                    {/* Runtime Filter - Only for movies */}
                    {mediaType === 'movie' && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-futuristic-yellow-400/90 mb-3">Runtime</h3>
                            <div className="futuristic-card p-4 bg-futuristic-blue-900/40 border border-futuristic-blue-500/20 rounded-lg">
                                <RangeSlider
                                    min={0}
                                    max={240}
                                    step={15}
                                    valueMin={runtimeMinFilter}
                                    valueMax={runtimeMaxFilter}
                                    onChange={handleRuntimeChange}
                                    formatLabel={(value) => formatRuntime(value) || '0m'}
                                />
                            </div>
                        </div>
                    )}

                    {/* Seasons Filter - Only for series */}
                    {mediaType === 'tv' && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-futuristic-yellow-400/90 mb-3">Seasons</h3>
                            <div className="futuristic-card p-4 bg-futuristic-blue-900/40 border border-futuristic-blue-500/20 rounded-lg">
                                <RangeSlider
                                    min={1}
                                    max={20}
                                    step={1}
                                    valueMin={seasonsMinFilter}
                                    valueMax={seasonsMaxFilter}
                                    onChange={handleSeasonsChange}
                                    formatLabel={(value) => `${value} ${value === 1 ? 'Season' : 'Seasons'}`}
                                />
                            </div>
                        </div>
                    )}
                </CollapsibleSection>

                {/* Watch Providers Section - Moved to top */}
                <CollapsibleSection
                    title="Where to Watch"
                    expanded={watchProvidersExpanded}
                    onToggle={() => setWatchProvidersExpanded(!watchProvidersExpanded)}
                >
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-futuristic-yellow-400/90 mb-3">Streaming Services (Canada)</h3>
                        {watchProviders.length > 0 ? (
                            <div className="max-h-64 overflow-y-auto scrollbar futuristic-card p-3 bg-futuristic-blue-900/40 border border-futuristic-blue-500/20 rounded-lg">
                                <div className="grid grid-cols-3 gap-2">
                                    {watchProviders.map((provider) => (
                                        <button
                                            key={provider.provider_id}
                                            onClick={() => handleProviderToggle(provider.provider_id)}
                                            className={`group relative flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                                                selectedProviders.includes(provider.provider_id)
                                                    ? 'bg-futuristic-yellow-500/20 border-2 border-futuristic-yellow-500 shadow-glow-yellow'
                                                    : 'bg-futuristic-blue-800/60 border border-futuristic-blue-500/30 hover:bg-futuristic-blue-700/60'
                                            }`}
                                            title={provider.provider_name}
                                        >
                                            {provider.logo_path ? (
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`}
                                                    alt={provider.provider_name}
                                                    className="w-10 h-10 object-contain mb-1"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <span className="text-xs text-futuristic-yellow-400 font-medium mb-1">
                                                    {provider.provider_name}
                                                </span>
                                            )}
                                            {selectedProviders.includes(provider.provider_id) && (
                                                <svg className="w-3 h-3 text-futuristic-yellow-400 absolute top-1 right-1" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-white/60 text-center py-4">
                                Loading providers...
                            </div>
                        )}
                    </div>
                </CollapsibleSection>

                {/* Content Type Section */}
                <CollapsibleSection
                    title="Content Type"
                    expanded={contentTypeExpanded}
                    onToggle={() => setContentTypeExpanded(!contentTypeExpanded)}
                >
                    {/* Genres Filter */}
                    {genres.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-futuristic-yellow-400/90 mb-3">Genres</h3>
                            <div className="max-h-64 overflow-y-auto scrollbar futuristic-card p-3 bg-futuristic-blue-900/40 border border-futuristic-blue-500/20 rounded-lg">
                                <div className="flex flex-wrap gap-2">
                                    {genres.map((genre) => (
                                        <button
                                            key={genre.id}
                                            onClick={() => handleGenreToggle(genre.id)}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                selectedGenres.includes(genre.id)
                                                    ? 'bg-futuristic-yellow-500 text-black shadow-glow-yellow'
                                                    : 'bg-futuristic-blue-800/60 text-white/90 hover:bg-futuristic-blue-700/60 border border-futuristic-blue-500/30'
                                            }`}
                                        >
                                            {genre.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </CollapsibleSection>

                {/* Keywords Search - Always visible */}
                <div className="mb-6">
                    <KeywordSearch
                        selectedKeywords={selectedKeywords}
                        onKeywordsChange={handleKeywordsChange}
                    />
                </div>

                {/* Date Filters Section */}
                {showDateFilter && (
                    <CollapsibleSection
                        title="Date Filters"
                        expanded={dateFiltersExpanded}
                        onToggle={() => setDateFiltersExpanded(!dateFiltersExpanded)}
                    >
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-futuristic-yellow-400/90 mb-3">Date Range</h3>
                            <select
                                value={dateRangeFilter}
                                onChange={(e) => handleDateRangeChange(e.target.value)}
                                className="w-full appearance-none bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-white text-sm px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-futuristic-yellow-500/50 focus:ring-1 focus:ring-futuristic-yellow-500/30 cursor-pointer hover:bg-futuristic-blue-700/80 transition-all"
                                style={{ 
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.5rem center',
                                    backgroundSize: '1rem'
                                }}
                            >
                                <option value="" className="bg-futuristic-blue-900 text-white">All Dates</option>
                                <option value="upcoming" className="bg-futuristic-blue-900 text-white">Upcoming</option>
                                <option value="this_week" className="bg-futuristic-blue-900 text-white">This Week</option>
                                <option value="this_month" className="bg-futuristic-blue-900 text-white">This Month</option>
                                <option value="this_year" className="bg-futuristic-blue-900 text-white">This Year</option>
                            </select>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-futuristic-yellow-400/90 mb-3">Released In</h3>
                            <select
                                value={daysPastFilter}
                                onChange={(e) => handleDaysPastChange(e.target.value)}
                                className="w-full appearance-none bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-white text-sm px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-futuristic-yellow-500/50 focus:ring-1 focus:ring-futuristic-yellow-500/30 cursor-pointer hover:bg-futuristic-blue-700/80 transition-all"
                                style={{ 
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.5rem center',
                                    backgroundSize: '1rem'
                                }}
                            >
                                <option value="" className="bg-futuristic-blue-900 text-white">All Time</option>
                                <option value="7" className="bg-futuristic-blue-900 text-white">Last 7 Days</option>
                                <option value="30" className="bg-futuristic-blue-900 text-white">Last 30 Days</option>
                                <option value="60" className="bg-futuristic-blue-900 text-white">Last 60 Days</option>
                                <option value="90" className="bg-futuristic-blue-900 text-white">Last 90 Days</option>
                                <option value="180" className="bg-futuristic-blue-900 text-white">Last 6 Months</option>
                                <option value="365" className="bg-futuristic-blue-900 text-white">Last Year</option>
                            </select>
                        </div>
                    </CollapsibleSection>
                )}
            </div>
        </div>
    );
});

FilterSidebar.displayName = 'FilterSidebar';

export default FilterSidebar;


