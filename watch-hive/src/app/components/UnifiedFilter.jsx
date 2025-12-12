"use client";
import { useState, useMemo, useEffect, useRef, memo } from 'react';
import YearSearch from './YearSearch';
import KeywordSearch from './KeywordSearch';
import RangeSlider from './RangeSlider';
import { formatRuntime } from '../utils/runtimeFormatter';

const UnifiedFilter = memo(({ onSortChange, onFilterChange, genres = [], showDateFilter = true, mediaType = 'movie', sortConfig = { sortBy: 'popularity', sortOrder: 'desc' }, filters = {} }) => {
    const [sortBy, setSortBy] = useState(sortConfig.sortBy || 'popularity');
    const [sortOrder, setSortOrder] = useState(sortConfig.sortOrder || 'desc');
    const [selectedGenres, setSelectedGenres] = useState([]);
    const [selectedYears, setSelectedYears] = useState([]);
    const [ratingFilter, setRatingFilter] = useState('');
    const [dateRangeFilter, setDateRangeFilter] = useState('');
    const [daysPastFilter, setDaysPastFilter] = useState('');
    const [includeUpcoming, setIncludeUpcoming] = useState(true);
    const [inTheaters, setInTheaters] = useState(false);
    const [selectedCertifications, setSelectedCertifications] = useState([]);
    const [selectedKeywords, setSelectedKeywords] = useState([]);
    const [runtimeMinFilter, setRuntimeMinFilter] = useState(0);
    const [runtimeMaxFilter, setRuntimeMaxFilter] = useState(240);
    const [seasonsMinFilter, setSeasonsMinFilter] = useState(1);
    const [seasonsMaxFilter, setSeasonsMaxFilter] = useState(20);
    const [maxSeasonsInput, setMaxSeasonsInput] = useState('');
    const [maxRuntimeInput, setMaxRuntimeInput] = useState('');
    const [selectedProviders, setSelectedProviders] = useState([]);
    const [watchProviders, setWatchProviders] = useState([]);
    const [contentType, setContentType] = useState('all'); // 'all', 'trending', 'upcoming'
    const keywordSearchRef = useRef(null);
    
    // Mobile: all sections start closed, Desktop: all sections start open
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);
    const [isKeywordsOpen, setIsKeywordsOpen] = useState(false);
    const [shouldAutoFocusKeywords, setShouldAutoFocusKeywords] = useState(false);
    const [basicFiltersExpanded, setBasicFiltersExpanded] = useState(false); // Mobile: closed
    const [genreExpanded, setGenreExpanded] = useState(false); // Mobile: closed
    const [mediaInfoExpanded, setMediaInfoExpanded] = useState(false); // Mobile: closed
    const [dateFiltersExpanded, setDateFiltersExpanded] = useState(false); // Mobile: closed
    const [watchProvidersExpanded, setWatchProvidersExpanded] = useState(false); // Mobile: closed
    
    // Available certifications (Brazilian ratings)
    const certifications = ['L', '10', '12', '14', '16', '18'];
    
    // Collapsible section component
    const CollapsibleSection = ({ title, expanded, onToggle, children, mobileOnly = false, desktopOnly = false }) => (
        <div className={`mb-4 ${mobileOnly ? 'sm:hidden' : ''} ${desktopOnly ? 'hidden sm:block' : ''}`}>
            <button
                onClick={onToggle}
                className={`w-full flex items-center justify-between py-2 px-3 bg-charcoal-800/60 border border-charcoal-700 rounded-lg hover:bg-charcoal-700/60 transition-all ${desktopOnly ? 'hidden sm:flex' : ''}`}
            >
                <span className="text-xs sm:text-sm font-semibold text-amber-500/90">{title}</span>
                <svg
                    className={`w-4 h-4 text-amber-500/80 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {expanded && (
                <div className="mt-2 pt-2 border-t border-charcoal-700">
                    {children}
                </div>
            )}
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
        
        // Sync years - can be string (single year) or array (multiple years)
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
        
        // Sync rating: convert minRating/maxRating back to ratingFilter format
        if (filters.minRating) {
            setRatingFilter(filters.minRating);
        } else if (filters.maxRating) {
            setRatingFilter('lt5');
        } else {
            setRatingFilter('');
        }
        
        // Sync dateRange
        setDateRangeFilter(filters.dateRange || '');
        
        // Sync daysPast
        setDaysPastFilter(filters.daysPast || '');
        
        // Sync includeUpcoming
        setIncludeUpcoming(filters.includeUpcoming !== undefined ? filters.includeUpcoming : true);
        
        // Sync inTheaters
        setInTheaters(filters.inTheaters === true);
        
        // Sync certification - can be string or array
        if (filters.certification) {
            if (Array.isArray(filters.certification)) {
                setSelectedCertifications(filters.certification);
            } else {
                setSelectedCertifications([filters.certification]);
            }
        } else {
            setSelectedCertifications([]);
        }
        
        // Sync keywords - array of objects with id and name
        if (filters.keywords && Array.isArray(filters.keywords)) {
            setSelectedKeywords(filters.keywords);
        } else {
            setSelectedKeywords([]);
        }
        
        // Sync runtime filters
        setRuntimeMinFilter(filters.runtimeMin ? parseInt(filters.runtimeMin, 10) : 0);
        const maxRuntime = filters.runtimeMax ? parseInt(filters.runtimeMax, 10) : 240;
        setRuntimeMaxFilter(maxRuntime);
        setMaxRuntimeInput(maxRuntime === 240 ? '' : maxRuntime.toString());
        
        // Sync seasons filters
        setSeasonsMinFilter(filters.seasonsMin ? parseInt(filters.seasonsMin, 10) : 1);
        const maxSeasons = filters.seasonsMax ? parseInt(filters.seasonsMax, 10) : 20;
        setSeasonsMaxFilter(maxSeasons);
        setMaxSeasonsInput(maxSeasons === 20 ? '' : maxSeasons.toString());
        
        // Sync watch providers - can be string or array
        if (filters.watchProviders) {
            if (Array.isArray(filters.watchProviders)) {
                setSelectedProviders(filters.watchProviders.map(p => parseInt(p, 10)));
            } else {
                setSelectedProviders([parseInt(filters.watchProviders, 10)]);
            }
        } else {
            setSelectedProviders([]);
        }
        
        // Sync content type (trending/upcoming)
        if (filters.trending === true) {
            setContentType('trending');
        } else if (filters.upcoming === true) {
            setContentType('upcoming');
        } else {
            setContentType('all');
        }
    }, [JSON.stringify(filters)]);
    
    // Fetch watch providers on mount
    useEffect(() => {
        const fetchWatchProviders = async () => {
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
        fetchWatchProviders();
    }, [mediaType]);

    // Focus keyword search input when keywords section opens (desktop only, mobile handles it synchronously in click handler)
    useEffect(() => {
        // Only auto-focus on desktop - mobile needs synchronous focus from click handler
        if (isKeywordsOpen && keywordSearchRef.current && window.innerWidth >= 640) {
            setTimeout(() => {
                keywordSearchRef.current?.focus();
            }, 100);
        }
    }, [isKeywordsOpen]);

    const buildFilterObject = (updates = {}) => {
        const filterObj = {};
        const genres = updates.genres !== undefined ? updates.genres : selectedGenres;
        const years = updates.years !== undefined ? updates.years : selectedYears;
        const rating = updates.rating !== undefined ? updates.rating : ratingFilter;
        const dateRange = updates.dateRange !== undefined ? updates.dateRange : dateRangeFilter;
        const daysPast = updates.daysPast !== undefined ? updates.daysPast : daysPastFilter;
        const includeUpcomingValue = updates.includeUpcoming !== undefined ? updates.includeUpcoming : includeUpcoming;
        const inTheatersValue = updates.inTheaters !== undefined ? updates.inTheaters : inTheaters;
        const certifications = updates.certifications !== undefined ? updates.certifications : selectedCertifications;
        const keywords = updates.keywords !== undefined ? updates.keywords : selectedKeywords;
        const runtimeMin = updates.runtimeMin !== undefined ? updates.runtimeMin : runtimeMinFilter;
        const runtimeMax = updates.runtimeMax !== undefined ? updates.runtimeMax : runtimeMaxFilter;
        const seasonsMin = updates.seasonsMin !== undefined ? updates.seasonsMin : seasonsMinFilter;
        const seasonsMax = updates.seasonsMax !== undefined ? updates.seasonsMax : seasonsMaxFilter;
        const providers = updates.providers !== undefined ? updates.providers : selectedProviders;
        
        if (genres.length > 0) filterObj.genres = genres;
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
        if (dateRange) filterObj.dateRange = dateRange;
        if (daysPast) filterObj.daysPast = daysPast;
        // Always explicitly set includeUpcoming so the API knows what to filter
        filterObj.includeUpcoming = includeUpcomingValue;
        if (inTheatersValue) filterObj.inTheaters = true;
        // Certification - store as string if single, array if multiple
        if (certifications.length > 0) {
            filterObj.certification = certifications.length === 1 ? certifications[0] : certifications;
        }
        // Keywords - store as array of objects
        if (keywords.length > 0) {
            filterObj.keywords = keywords;
        }
        
        // Runtime filters - only add if not at default values
        if (runtimeMin > 0) filterObj.runtimeMin = runtimeMin.toString();
        if (runtimeMax < 240) filterObj.runtimeMax = runtimeMax.toString();
        
        // Seasons filters - only add if not at default values
        if (seasonsMin > 1) filterObj.seasonsMin = seasonsMin.toString();
        if (seasonsMax < 20) filterObj.seasonsMax = seasonsMax.toString();
        
        // Watch providers
        if (providers.length > 0) {
            filterObj.watchProviders = providers.length === 1 ? providers[0].toString() : providers.map(p => p.toString());
        }
        
        // Content type (trending/upcoming)
        const contentTypeValue = updates.contentType !== undefined ? updates.contentType : contentType;
        if (contentTypeValue === 'trending') {
            filterObj.trending = true;
        } else if (contentTypeValue === 'upcoming') {
            filterObj.upcoming = true;
            filterObj.dateRange = 'upcoming';
        }
        
        return filterObj;
    };

    const handleSortChange = (newSortBy, newSortOrder) => {
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
        onSortChange({ sortBy: newSortBy, sortOrder: newSortOrder });
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

    const handleInTheatersChange = (checked) => {
        setInTheaters(checked);
        onFilterChange(buildFilterObject({ inTheaters: checked }));
    };

    const handleCertificationToggle = (certification) => {
        const newCertifications = selectedCertifications.includes(certification)
            ? selectedCertifications.filter(c => c !== certification)
            : [...selectedCertifications, certification];
        setSelectedCertifications(newCertifications);
        onFilterChange(buildFilterObject({ certifications: newCertifications }));
    };

    const handleKeywordsChange = (newKeywords) => {
        setSelectedKeywords(newKeywords);
        onFilterChange(buildFilterObject({ keywords: newKeywords }));
    };
    
    const handleRuntimeChange = ({ min, max }) => {
        setRuntimeMinFilter(min);
        setRuntimeMaxFilter(max);
        setMaxRuntimeInput(max === 240 ? '' : max.toString());
        onFilterChange(buildFilterObject({ runtimeMin: min, runtimeMax: max }));
    };
    
    const handleSeasonsChange = ({ min, max }) => {
        setSeasonsMinFilter(min);
        setSeasonsMaxFilter(max);
        setMaxSeasonsInput(max === 20 ? '' : max.toString());
        onFilterChange(buildFilterObject({ seasonsMin: min, seasonsMax: max }));
    };
    
    const handleMaxSeasonsChange = (e) => {
        const value = e.target.value;
        setMaxSeasonsInput(value);
        if (value && !isNaN(value) && parseInt(value, 10) >= 1) {
            const maxSeasons = Math.min(Math.max(parseInt(value, 10), 1), 20);
            setSeasonsMaxFilter(maxSeasons);
            onFilterChange(buildFilterObject({ seasonsMax: maxSeasons }));
        } else if (value === '') {
            setSeasonsMaxFilter(20);
            onFilterChange(buildFilterObject({ seasonsMax: 20 }));
        }
    };
    
    const handleMaxRuntimeChange = (e) => {
        const value = e.target.value;
        setMaxRuntimeInput(value);
        if (value && !isNaN(value) && parseInt(value, 10) >= 15) {
            const maxRuntime = Math.min(Math.max(parseInt(value, 10), 15), 240);
            setRuntimeMaxFilter(maxRuntime);
            onFilterChange(buildFilterObject({ runtimeMax: maxRuntime }));
        } else if (value === '') {
            setRuntimeMaxFilter(240);
            onFilterChange(buildFilterObject({ runtimeMax: 240 }));
        }
    };
    
    const handleProviderToggle = (providerId) => {
        const newProviders = selectedProviders.includes(providerId)
            ? selectedProviders.filter(id => id !== providerId)
            : [...selectedProviders, providerId];
        setSelectedProviders(newProviders);
        onFilterChange(buildFilterObject({ providers: newProviders }));
    };
    
    const handleContentTypeChange = (type) => {
        setContentType(type);
        onFilterChange(buildFilterObject({ contentType: type }));
    };

    const clearFilters = () => {
        setSelectedGenres([]);
        setSelectedYears([]);
        setContentType('all');
        setRatingFilter('');
        setDateRangeFilter('');
        setDaysPastFilter('');
        setIncludeUpcoming(true);
        setInTheaters(false);
        setSelectedCertifications([]);
        setSelectedKeywords([]);
        setRuntimeMinFilter(0);
        setRuntimeMaxFilter(240);
        setMaxRuntimeInput('');
        setSeasonsMinFilter(1);
        setSeasonsMaxFilter(20);
        setMaxSeasonsInput('');
        setSelectedProviders([]);
        setSortBy('popularity');
        setSortOrder('desc');
        onSortChange({ sortBy: 'popularity', sortOrder: 'desc' });
        onFilterChange({});
    };

    // Get active filters count
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (selectedGenres.length > 0) count += selectedGenres.length;
        if (selectedYears.length > 0) count += selectedYears.length;
        if (ratingFilter) count++;
        if (dateRangeFilter) count++;
        if (daysPastFilter) count++;
        if (includeUpcoming) count++;
        if (inTheaters) count++;
        if (selectedCertifications.length > 0) count += selectedCertifications.length;
        if (selectedKeywords.length > 0) count += selectedKeywords.length;
        if (runtimeMinFilter > 0 || runtimeMaxFilter < 240) count++;
        if (seasonsMinFilter > 1 || seasonsMaxFilter < 20) count++;
        if (selectedProviders.length > 0) count += selectedProviders.length;
        return count;
    }, [selectedGenres.length, selectedYears.length, ratingFilter, dateRangeFilter, daysPastFilter, includeUpcoming, inTheaters, selectedCertifications.length, selectedKeywords.length, runtimeMinFilter, runtimeMaxFilter, seasonsMinFilter, seasonsMaxFilter, selectedProviders.length]);

    // Desktop: all sections open by default
    useEffect(() => {
        const checkScreenSize = () => {
            if (window.innerWidth >= 640) { // sm breakpoint
                setBasicFiltersExpanded(true);
                setMediaInfoExpanded(true);
                setDateFiltersExpanded(true);
                setWatchProvidersExpanded(true);
            } else {
                setBasicFiltersExpanded(false);
                setGenreExpanded(false);
                setMediaInfoExpanded(false);
                setDateFiltersExpanded(false);
                setWatchProvidersExpanded(false);
            }
        };
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    return (
        <>
            {/* Mobile: Top Filter Bar */}
            <div className="sm:hidden">
                <div className="futuristic-card p-3 mb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Sort Options with Include Upcoming */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-amber-500/80">Sort:</span>
                            <select
                                value={`${sortBy}.${sortOrder}`}
                                onChange={(e) => {
                                    const [newSortBy, newSortOrder] = e.target.value.split('.');
                                    handleSortChange(newSortBy, newSortOrder);
                                }}
                                className="appearance-none bg-charcoal-800/80 border border-charcoal-700/40 text-white text-xs px-3 py-1.5 pr-8 rounded-lg focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 cursor-pointer hover:bg-charcoal-700/80 transition-all"
                                style={{ 
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.5rem center',
                                    backgroundSize: '1rem'
                                }}
                            >
                                <option value="popularity.desc" className="bg-charcoal-900 text-white">Trending ↓</option>
                                <option value="popularity.asc" className="bg-charcoal-900 text-white">Trending ↑</option>
                                <option value="rating.desc" className="bg-charcoal-900 text-white">Rating ↓</option>
                                <option value="rating.asc" className="bg-charcoal-900 text-white">Rating ↑</option>
                                <option value="release_date.desc" className="bg-charcoal-900 text-white">Release Date ↓</option>
                                <option value="release_date.asc" className="bg-charcoal-900 text-white">Release Date ↑</option>
                                <option value="title.asc" className="bg-charcoal-900 text-white">Title A-Z</option>
                                <option value="title.desc" className="bg-charcoal-900 text-white">Title Z-A</option>
                            </select>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="includeUpcoming-mobile"
                                    checked={includeUpcoming}
                                    onChange={(e) => handleIncludeUpcomingChange(e.target.checked)}
                                    className="w-4 h-4 rounded bg-charcoal-800/80 border border-charcoal-700/40 text-amber-500 focus:ring-amber-500/30 focus:ring-1 cursor-pointer"
                                />
                                <label htmlFor="includeUpcoming-mobile" className="text-xs text-white/90 cursor-pointer whitespace-nowrap">
                                    Include Upcoming
                                </label>
                            </div>
                        </div>

                        {/* Quick Filters */}
                        <div className="flex items-center gap-2 flex-wrap">

                            <button
                                onClick={() => {
                                    const willOpen = !isKeywordsOpen;
                                    setIsKeywordsOpen(willOpen);
                                    // Set auto-focus flag - HTML autofocus attribute will handle keyboard activation
                                    setShouldAutoFocusKeywords(willOpen);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    selectedKeywords.length > 0
                                        ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                                        : 'bg-charcoal-800/80 text-white/90 border border-charcoal-700/40 hover:bg-charcoal-700/80'
                                }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <span>Keywords</span>
                                {selectedKeywords.length > 0 && (
                                    <span className="px-1.5 py-0.5 bg-amber-500/30 text-amber-400 rounded-full text-[10px] font-bold">
                                        {selectedKeywords.length}
                                    </span>
                                )}
                            </button>

                            <div className="relative">
                                <select
                                    value={ratingFilter}
                                    onChange={(e) => handleRatingChange(e.target.value)}
                                    className="appearance-none bg-charcoal-800/80 border border-charcoal-700/40 text-white text-xs px-3 py-1.5 pr-8 rounded-lg focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 cursor-pointer hover:bg-charcoal-700/80 transition-all"
                                    style={{ 
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 0.5rem center',
                                        backgroundSize: '1rem'
                                    }}
                                >
                                    <option value="" className="bg-charcoal-900 text-white">Rating</option>
                                    <option value="9" className="bg-charcoal-900 text-white">9+ ⭐</option>
                                    <option value="8" className="bg-charcoal-900 text-white">8+ ⭐</option>
                                    <option value="7" className="bg-charcoal-900 text-white">7+ ⭐</option>
                                    <option value="6" className="bg-charcoal-900 text-white">6+ ⭐</option>
                                    <option value="5" className="bg-charcoal-900 text-white">5+ ⭐</option>
                                    <option value="lt5" className="bg-charcoal-900 text-white">&lt;5 ⭐</option>
                                </select>
                            </div>

                            <button
                                onClick={() => setIsMobileExpanded(!isMobileExpanded)}
                                className="px-3 py-1.5 bg-charcoal-800/60 text-white/90 hover:bg-charcoal-700/60 border border-charcoal-700/30 rounded-lg text-xs font-medium transition-all"
                            >
                                {isMobileExpanded ? 'Less' : 'More'} Filters
                            </button>
                        </div>
                    </div>

                    {/* Keywords Search - Mobile */}
                    {isKeywordsOpen && (
                        <div className="mt-3 pt-3 border-t border-charcoal-700/20">
                            <KeywordSearch
                                key="keywords-search"
                                ref={keywordSearchRef}
                                selectedKeywords={selectedKeywords}
                                onKeywordsChange={handleKeywordsChange}
                                autoFocusOnMount={shouldAutoFocusKeywords}
                            />
                        </div>
                    )}

                    {/* Expanded Filters - Mobile */}
                    {isMobileExpanded && (
                        <div className="mt-4 pt-4 border-t border-charcoal-700/20">
                            <div className="space-y-4">
                                {/* Genre Filter */}
                                {genres.length > 0 && (
                                    <CollapsibleSection
                                        title="Genres"
                                        expanded={genreExpanded}
                                        onToggle={() => setGenreExpanded(!genreExpanded)}
                                        mobileOnly
                                    >
                                        <div className="max-h-32 overflow-y-auto futuristic-card p-2 bg-charcoal-900/40 border border-charcoal-700/20 rounded-lg">
                                            <div className="flex flex-wrap gap-1.5">
                                                {genres.map((genre) => (
                                                    <button
                                                        key={genre.id}
                                                        onClick={() => handleGenreToggle(genre.id)}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                                            selectedGenres.includes(genre.id)
                                                                ? 'bg-amber-500 text-black shadow-subtle'
                                                                : 'bg-charcoal-800/60 text-white/90 hover:bg-charcoal-700/60 border border-charcoal-700/30'
                                                        }`}
                                                    >
                                                        {genre.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </CollapsibleSection>
                                )}

                                {/* Certification Filter */}
                                <CollapsibleSection
                                    title="Age Certification"
                                    expanded={basicFiltersExpanded}
                                    onToggle={() => setBasicFiltersExpanded(!basicFiltersExpanded)}
                                    mobileOnly
                                >
                                    <div className="flex flex-wrap gap-1.5">
                                        {certifications.map((cert) => (
                                            <button
                                                key={cert}
                                                onClick={() => handleCertificationToggle(cert)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                                    selectedCertifications.includes(cert)
                                                        ? 'bg-amber-500 text-black shadow-subtle'
                                                        : 'bg-charcoal-800/60 text-white/90 hover:bg-charcoal-700/60 border border-charcoal-700/30'
                                                }`}
                                            >
                                                {cert}
                                            </button>
                                        ))}
                                    </div>
                                </CollapsibleSection>

                                {/* Date Info Section - Mobile: Year Search + Date Range */}
                                {showDateFilter && (
                                    <CollapsibleSection
                                        title="Date Info"
                                        expanded={dateFiltersExpanded}
                                        onToggle={() => setDateFiltersExpanded(!dateFiltersExpanded)}
                                        mobileOnly
                                    >
                                        <div className="space-y-4">
                                            <YearSearch
                                                selectedYears={selectedYears}
                                                onYearsChange={handleYearsChange}
                                            />
                                            <div>
                                                <label className="block text-xs font-semibold text-amber-500/90 mb-2">Date Range</label>
                                                <select
                                                    value={dateRangeFilter}
                                                    onChange={(e) => handleDateRangeChange(e.target.value)}
                                                    className="w-full appearance-none bg-charcoal-800/80 border border-charcoal-700/40 text-white text-xs px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 cursor-pointer hover:bg-charcoal-700/80 transition-all"
                                                    style={{ 
                                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                                        backgroundRepeat: 'no-repeat',
                                                        backgroundPosition: 'right 0.5rem center',
                                                        backgroundSize: '1rem'
                                                    }}
                                                >
                                                    <option value="" className="bg-charcoal-900 text-white">All Dates</option>
                                                    <option value="upcoming" className="bg-charcoal-900 text-white">Upcoming</option>
                                                    <option value="this_week" className="bg-charcoal-900 text-white">This Week</option>
                                                    <option value="this_month" className="bg-charcoal-900 text-white">This Month</option>
                                                    <option value="this_year" className="bg-charcoal-900 text-white">This Year</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-amber-500/90 mb-2">Released In</label>
                                                <select
                                                    value={daysPastFilter}
                                                    onChange={(e) => handleDaysPastChange(e.target.value)}
                                                    className="w-full appearance-none bg-charcoal-800/80 border border-charcoal-700/40 text-white text-xs px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 cursor-pointer hover:bg-charcoal-700/80 transition-all"
                                                    style={{ 
                                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                                        backgroundRepeat: 'no-repeat',
                                                        backgroundPosition: 'right 0.5rem center',
                                                        backgroundSize: '1rem'
                                                    }}
                                                >
                                                    <option value="" className="bg-charcoal-900 text-white">All Time</option>
                                                    <option value="7" className="bg-charcoal-900 text-white">Last 7 Days</option>
                                                    <option value="30" className="bg-charcoal-900 text-white">Last 30 Days</option>
                                                    <option value="60" className="bg-charcoal-900 text-white">Last 60 Days</option>
                                                    <option value="90" className="bg-charcoal-900 text-white">Last 90 Days</option>
                                                    <option value="180" className="bg-charcoal-900 text-white">Last 6 Months</option>
                                                    <option value="365" className="bg-charcoal-900 text-white">Last Year</option>
                                                </select>
                                            </div>
                                        </div>
                                    </CollapsibleSection>
                                )}

                                {/* Media Info Section - Mobile */}
                                <CollapsibleSection
                                    title="Media Info"
                                    expanded={mediaInfoExpanded}
                                    onToggle={() => setMediaInfoExpanded(!mediaInfoExpanded)}
                                    mobileOnly
                                >
                                    {/* Runtime Filter - Only for movies */}
                                    {mediaType === 'movie' && (
                                        <div className="mb-4">
                                            <h3 className="text-xs font-semibold text-amber-500/90 mb-2">Runtime</h3>
                                            <div className="futuristic-card p-3 bg-charcoal-900/40 border border-charcoal-700/20 rounded-lg space-y-4">
                                                <div>
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
                                                <div>
                                                    <label className="text-xs text-amber-500/80 mb-1 block">Max Runtime (minutes)</label>
                                                    <input
                                                        type="number"
                                                        min="15"
                                                        max="240"
                                                        step="15"
                                                        value={maxRuntimeInput}
                                                        onChange={handleMaxRuntimeChange}
                                                        placeholder="e.g., 120"
                                                        className="w-full px-3 py-2 bg-charcoal-800/60 border border-charcoal-700/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                                                    />
                                                    <p className="text-xs text-white/60 mt-1">Minimum 15 minutes</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Seasons Filter - Only for series */}
                                    {mediaType === 'tv' && (
                                        <div className="mb-4">
                                            <h3 className="text-xs font-semibold text-amber-500/90 mb-2">Seasons</h3>
                                            <div className="futuristic-card p-3 bg-charcoal-900/40 border border-charcoal-700/20 rounded-lg space-y-4">
                                                <div>
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
                                                <div>
                                                    <label className="text-xs text-amber-500/80 mb-1 block">Max Seasons</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="20"
                                                        step="1"
                                                        value={maxSeasonsInput}
                                                        onChange={handleMaxSeasonsChange}
                                                        placeholder="e.g., 5"
                                                        className="w-full px-3 py-2 bg-charcoal-800/60 border border-charcoal-700/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                                                    />
                                                    <p className="text-xs text-white/60 mt-1">Maximum number of seasons (auto-updates slider)</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CollapsibleSection>

                                {/* Watch Providers Section - Mobile */}
                                <CollapsibleSection
                                    title="Where to Watch"
                                    expanded={watchProvidersExpanded}
                                    onToggle={() => setWatchProvidersExpanded(!watchProvidersExpanded)}
                                    mobileOnly
                                >
                                    <div className="mb-4">
                                        <h3 className="text-xs font-semibold text-amber-500/90 mb-2">Streaming Services (Canada)</h3>
                                        {watchProviders.length > 0 ? (
                                            <div className="max-h-48 overflow-y-auto scrollbar futuristic-card p-3 bg-charcoal-900/40 border border-charcoal-700/20 rounded-lg">
                                                <div className="grid grid-cols-3 gap-2">
                                                    {watchProviders.map((provider) => (
                                                        <button
                                                            key={provider.provider_id}
                                                            onClick={() => handleProviderToggle(provider.provider_id)}
                                                            className={`group relative flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                                                                selectedProviders.includes(provider.provider_id)
                                                                    ? 'bg-amber-500/20 border-2 border-amber-500 shadow-subtle'
                                                                    : 'bg-charcoal-800/60 border border-charcoal-700/30 hover:bg-charcoal-700/60'
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
                                                                <span className="text-xs text-amber-500 font-medium mb-1">
                                                                    {provider.provider_name}
                                                                </span>
                                                            )}
                                                            {selectedProviders.includes(provider.provider_id) && (
                                                                <svg className="w-3 h-3 text-amber-500 absolute top-1 right-1" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-white/60 text-center py-4">
                                                Loading providers...
                                            </div>
                                        )}
                                    </div>
                                </CollapsibleSection>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop: Sidebar Filter */}
            <div className="hidden sm:block w-64 flex-shrink-0">
                <div className="overflow-y-auto scrollbar space-y-4">
                    {/* Header Section */}
                    <div className="futuristic-card p-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-amber-500 futuristic-text-glow-orange">Filters</h2>
                            {activeFiltersCount > 0 && (
                                <button
                                    onClick={clearFilters}
                                    className="text-xs text-amber-500/80 hover:text-amber-500 transition-colors"
                                >
                                    Clear ({activeFiltersCount})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Checkboxes Section */}
                    <div className="futuristic-card p-4">
                        <div className="space-y-3">
                            {/* In Theaters Filter - Only for movies */}
                            {mediaType === 'movie' && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={inTheaters}
                                        onChange={(e) => handleInTheatersChange(e.target.checked)}
                                        className="w-4 h-4 rounded bg-charcoal-800 border-charcoal-700 text-amber-500 focus:ring-amber-500 focus:ring-2"
                                    />
                                    <span className="text-sm text-white/90 font-medium">In Theaters</span>
                                </label>
                            )}

                            {/* Include Upcoming Filter */}
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeUpcoming}
                                    onChange={(e) => handleIncludeUpcomingChange(e.target.checked)}
                                    className="w-4 h-4 rounded bg-charcoal-800 border-charcoal-700 text-amber-500 focus:ring-amber-500 focus:ring-2"
                                />
                                <span className="text-sm text-white/90 font-medium">Include Upcoming</span>
                            </label>
                        </div>
                    </div>

                    {/* Sort By Section */}
                    <div className="futuristic-card p-4">
                        <h3 className="text-sm font-semibold text-amber-500/90 mb-3">Sort By</h3>
                        <select
                            value={`${sortBy}.${sortOrder}`}
                            onChange={(e) => {
                                const [newSortBy, newSortOrder] = e.target.value.split('.');
                                handleSortChange(newSortBy, newSortOrder);
                            }}
                            className="w-full appearance-none bg-charcoal-800/80 border border-charcoal-700/40 text-white text-sm px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 cursor-pointer hover:bg-charcoal-700/80 transition-all"
                            style={{ 
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.5rem center',
                                backgroundSize: '1rem'
                            }}
                        >
                            <option value="popularity.desc" className="bg-charcoal-900 text-white">Trending ↓</option>
                            <option value="popularity.asc" className="bg-charcoal-900 text-white">Trending ↑</option>
                            <option value="rating.desc" className="bg-charcoal-900 text-white">Rating ↓</option>
                            <option value="rating.asc" className="bg-charcoal-900 text-white">Rating ↑</option>
                            <option value="release_date.desc" className="bg-charcoal-900 text-white">Release Date ↓ (Newest)</option>
                            <option value="release_date.asc" className="bg-charcoal-900 text-white">Release Date ↑ (Oldest)</option>
                            <option value="title.asc" className="bg-charcoal-900 text-white">Title A-Z</option>
                            <option value="title.desc" className="bg-charcoal-900 text-white">Title Z-A</option>
                        </select>
                    </div>

                    {/* Basic Filters Section - Desktop: Always Open */}
                    <div className="futuristic-card p-4">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-amber-500/90 mb-3">Rating</h3>
                            <select
                                value={ratingFilter}
                                onChange={(e) => handleRatingChange(e.target.value)}
                                className="w-full appearance-none bg-charcoal-800/80 border border-charcoal-700/40 text-white text-sm px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 cursor-pointer hover:bg-charcoal-700/80 transition-all"
                                style={{ 
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.5rem center',
                                    backgroundSize: '1rem'
                                }}
                            >
                                <option value="" className="bg-charcoal-900 text-white">All Ratings</option>
                                <option value="9" className="bg-charcoal-900 text-white">9+ ⭐</option>
                                <option value="8" className="bg-charcoal-900 text-white">8+ ⭐</option>
                                <option value="7" className="bg-charcoal-900 text-white">7+ ⭐</option>
                                <option value="6" className="bg-charcoal-900 text-white">6+ ⭐</option>
                                <option value="5" className="bg-charcoal-900 text-white">5+ ⭐</option>
                                <option value="lt5" className="bg-charcoal-900 text-white">&lt;5 ⭐</option>
                            </select>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-amber-500/90 mb-3">Age Certification</h3>
                            <div className="max-h-64 overflow-y-auto scrollbar futuristic-card p-3 bg-charcoal-900/40 border border-charcoal-700/20 rounded-lg">
                                <div className="flex flex-wrap gap-2">
                                    {certifications.map((cert) => (
                                        <button
                                            key={cert}
                                            onClick={() => handleCertificationToggle(cert)}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                selectedCertifications.includes(cert)
                                                    ? 'bg-amber-500 text-black shadow-subtle'
                                                    : 'bg-charcoal-800/60 text-white/90 hover:bg-charcoal-700/60 border border-charcoal-700/30'
                                            }`}
                                        >
                                            {cert}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Type Section - Desktop: Always Open */}
                    <div className="futuristic-card p-4">
                        {genres.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-amber-500/90 mb-3">Genres</h3>
                                <div className="max-h-64 overflow-y-auto scrollbar futuristic-card p-3 bg-charcoal-900/40 border border-charcoal-700/20 rounded-lg">
                                    <div className="flex flex-wrap gap-2">
                                        {genres.map((genre) => (
                                            <button
                                                key={genre.id}
                                                onClick={() => handleGenreToggle(genre.id)}
                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                    selectedGenres.includes(genre.id)
                                                        ? 'bg-amber-500 text-black shadow-subtle'
                                                        : 'bg-charcoal-800/60 text-white/90 hover:bg-charcoal-700/60 border border-charcoal-700/30'
                                                }`}
                                            >
                                                {genre.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Keywords Search Section - Desktop */}
                    <div className="futuristic-card p-4">
                        <KeywordSearch
                            selectedKeywords={selectedKeywords}
                            onKeywordsChange={handleKeywordsChange}
                        />
                    </div>

                    {/* Media Info Section - Desktop: Always Open */}
                    <div className="futuristic-card p-4">
                        {/* Runtime Filter - Only for movies */}
                        {mediaType === 'movie' && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-amber-500/90 mb-3">Runtime</h3>
                                <div className="futuristic-card p-4 bg-charcoal-900/40 border border-charcoal-700/20 rounded-lg space-y-4">
                                    <div>
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
                                    <div>
                                        <label className="text-sm text-amber-500/80 mb-2 block">Max Runtime (minutes)</label>
                                        <input
                                            type="number"
                                            min="15"
                                            max="240"
                                            step="15"
                                            value={maxRuntimeInput}
                                            onChange={handleMaxRuntimeChange}
                                            placeholder="e.g., 120"
                                            className="w-full px-3 py-2 bg-charcoal-800/60 border border-charcoal-700/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                                        />
                                        <p className="text-xs text-white/60 mt-1">Minimum 15 minutes (auto-updates slider)</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Seasons Filter - Only for series */}
                        {mediaType === 'tv' && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-amber-500/90 mb-3">Seasons</h3>
                                <div className="futuristic-card p-4 bg-charcoal-900/40 border border-charcoal-700/20 rounded-lg space-y-4">
                                    <div>
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
                                    <div>
                                        <label className="text-sm text-amber-500/80 mb-2 block">Max Seasons</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            step="1"
                                            value={maxSeasonsInput}
                                            onChange={handleMaxSeasonsChange}
                                            placeholder="e.g., 5"
                                            className="w-full px-3 py-2 bg-charcoal-800/60 border border-charcoal-700/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                                        />
                                        <p className="text-xs text-white/60 mt-1">Maximum number of seasons (auto-updates slider)</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Where to Watch Section - Desktop: Always Open */}
                    <div className="futuristic-card p-4">
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-amber-500/90 mb-3">Streaming Services (Canada)</h3>
                            {watchProviders.length > 0 ? (
                                <div className="max-h-64 overflow-y-auto scrollbar futuristic-card p-3 bg-charcoal-900/40 border border-charcoal-700/20 rounded-lg">
                                    <div className="grid grid-cols-3 gap-2">
                                        {watchProviders.map((provider) => (
                                            <button
                                                key={provider.provider_id}
                                                onClick={() => handleProviderToggle(provider.provider_id)}
                                                className={`group relative flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                                                    selectedProviders.includes(provider.provider_id)
                                                        ? 'bg-amber-500/20 border-2 border-amber-500 shadow-subtle'
                                                        : 'bg-charcoal-800/60 border border-charcoal-700/30 hover:bg-charcoal-700/60'
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
                                                    <span className="text-xs text-amber-500 font-medium mb-1">
                                                        {provider.provider_name}
                                                    </span>
                                                )}
                                                {selectedProviders.includes(provider.provider_id) && (
                                                    <svg className="w-3 h-3 text-amber-500 absolute top-1 right-1" fill="currentColor" viewBox="0 0 20 20">
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
                    </div>

                    {/* Date Filters Section - Desktop: Always Open */}
                    {showDateFilter && (
                        <div className="futuristic-card p-4">
                            <div className="mb-6">
                                <YearSearch
                                    selectedYears={selectedYears}
                                    onYearsChange={handleYearsChange}
                                />
                            </div>

                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-amber-500/90 mb-3">Date Range</h3>
                                <select
                                    value={dateRangeFilter}
                                    onChange={(e) => handleDateRangeChange(e.target.value)}
                                    className="w-full appearance-none bg-charcoal-800/80 border border-charcoal-700/40 text-white text-sm px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 cursor-pointer hover:bg-charcoal-700/80 transition-all"
                                    style={{ 
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 0.5rem center',
                                        backgroundSize: '1rem'
                                    }}
                                >
                                    <option value="" className="bg-charcoal-900 text-white">All Dates</option>
                                    <option value="upcoming" className="bg-charcoal-900 text-white">Upcoming</option>
                                    <option value="this_week" className="bg-charcoal-900 text-white">This Week</option>
                                    <option value="this_month" className="bg-charcoal-900 text-white">This Month</option>
                                    <option value="this_year" className="bg-charcoal-900 text-white">This Year</option>
                                </select>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-amber-500/90 mb-3">Released In</h3>
                                <select
                                    value={daysPastFilter}
                                    onChange={(e) => handleDaysPastChange(e.target.value)}
                                    className="w-full appearance-none bg-charcoal-800/80 border border-charcoal-700/40 text-white text-sm px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 cursor-pointer hover:bg-charcoal-700/80 transition-all"
                                    style={{ 
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 0.5rem center',
                                        backgroundSize: '1rem'
                                    }}
                                >
                                    <option value="" className="bg-charcoal-900 text-white">All Time</option>
                                    <option value="7" className="bg-charcoal-900 text-white">Last 7 Days</option>
                                    <option value="30" className="bg-charcoal-900 text-white">Last 30 Days</option>
                                    <option value="60" className="bg-charcoal-900 text-white">Last 60 Days</option>
                                    <option value="90" className="bg-charcoal-900 text-white">Last 90 Days</option>
                                    <option value="180" className="bg-charcoal-900 text-white">Last 6 Months</option>
                                    <option value="365" className="bg-charcoal-900 text-white">Last Year</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
});

UnifiedFilter.displayName = 'UnifiedFilter';

export default UnifiedFilter;

