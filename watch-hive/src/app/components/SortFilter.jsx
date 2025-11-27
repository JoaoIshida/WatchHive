"use client";
import { useState, useMemo, useEffect } from 'react';
import YearSearch from './YearSearch';

const SortFilter = ({ onSortChange, onFilterChange, genres = [], showDateFilter = true, sortConfig = { sortBy: 'popularity', sortOrder: 'desc' }, filters = {} }) => {
    const [sortBy, setSortBy] = useState(sortConfig.sortBy || 'popularity');
    const [sortOrder, setSortOrder] = useState(sortConfig.sortOrder || 'desc');
    const [selectedGenres, setSelectedGenres] = useState([]);
    const [selectedYears, setSelectedYears] = useState([]);
    const [ratingFilter, setRatingFilter] = useState('');
    const [dateRangeFilter, setDateRangeFilter] = useState('');
    const [daysPastFilter, setDaysPastFilter] = useState('');
    const [includeUpcoming, setIncludeUpcoming] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);

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
        // Sync genres
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
    }, [JSON.stringify(filters)]);

    // Generate year options (from 1900 to current year + 1)
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
        const years = updates.years !== undefined ? updates.years : selectedYears;
        const rating = updates.rating !== undefined ? updates.rating : ratingFilter;
        const dateRange = updates.dateRange !== undefined ? updates.dateRange : dateRangeFilter;
        const daysPast = updates.daysPast !== undefined ? updates.daysPast : daysPastFilter;
        const includeUpcomingValue = updates.includeUpcoming !== undefined ? updates.includeUpcoming : includeUpcoming;
        
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
        if (includeUpcomingValue) filterObj.includeUpcoming = true;
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

    const clearFilters = () => {
        setSelectedGenres([]);
        setSelectedYears([]);
        setRatingFilter('');
        setDateRangeFilter('');
        setDaysPastFilter('');
        setIncludeUpcoming(false);
        setSortBy('popularity');
        setSortOrder('desc');
        onSortChange({ sortBy: 'popularity', sortOrder: 'desc' });
        onFilterChange({});
    };

    // Get selected genre names for display
    const getSelectedGenreNames = () => {
        return selectedGenres.map(id => {
            const genre = genres.find(g => g.id === id);
            return genre ? { id, name: genre.name } : null;
        }).filter(Boolean);
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
        return count;
    }, [selectedGenres.length, selectedYears.length, ratingFilter, dateRangeFilter, daysPastFilter, includeUpcoming]);

    const removeFilter = (type, value = null) => {
        switch (type) {
            case 'genre':
                handleGenreToggle(value);
                break;
            case 'year':
                const newYears = selectedYears.filter(y => y !== value);
                handleYearsChange(newYears);
                break;
            case 'rating':
                handleRatingChange('');
                break;
            case 'dateRange':
                handleDateRangeChange('');
                break;
            case 'daysPast':
                handleDaysPastChange('');
                break;
            case 'includeUpcoming':
                handleIncludeUpcomingChange(false);
                break;
        }
    };

    const getSortLabel = (option) => {
        if (option === 'popularity') return 'Trending';
        if (option === 'release_date') return 'Release Date';
        if (option === 'title') return 'Title';
        return option.charAt(0).toUpperCase() + option.slice(1);
    };

    return (
        <>
            {/* Compact Filter Bar */}
            <div className="futuristic-card p-3 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Sort Options - Always Visible */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-futuristic-yellow-400/80">Sort:</span>
                        <select
                            value={`${sortBy}.${sortOrder}`}
                            onChange={(e) => {
                                const [newSortBy, newSortOrder] = e.target.value.split('.');
                                handleSortChange(newSortBy, newSortOrder);
                            }}
                            className="appearance-none bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-white text-xs px-3 py-1.5 pr-8 rounded-lg focus:outline-none focus:border-futuristic-yellow-500/50 focus:ring-1 focus:ring-futuristic-yellow-500/30 cursor-pointer hover:bg-futuristic-blue-700/80 transition-all"
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
                            <option value="release_date.desc" className="bg-futuristic-blue-900 text-white">Release Date ↓</option>
                            <option value="release_date.asc" className="bg-futuristic-blue-900 text-white">Release Date ↑</option>
                            <option value="title.asc" className="bg-futuristic-blue-900 text-white">Title A-Z</option>
                            <option value="title.desc" className="bg-futuristic-blue-900 text-white">Title Z-A</option>
                        </select>
                    </div>

                    {/* Quick Filters - Compact */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Include Upcoming Checkbox */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="includeUpcoming"
                                checked={includeUpcoming}
                                onChange={(e) => handleIncludeUpcomingChange(e.target.checked)}
                                className="w-4 h-4 rounded bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-futuristic-yellow-500 focus:ring-futuristic-yellow-500/30 focus:ring-1 cursor-pointer"
                            />
                            <label htmlFor="includeUpcoming" className="text-xs text-white/90 cursor-pointer whitespace-nowrap">
                                Include Upcoming
                            </label>
                        </div>

                        {/* Year Search - Compact for mobile */}
                        <div className="w-full">
                            <YearSearch
                                selectedYears={selectedYears}
                                onYearsChange={handleYearsChange}
                            />
                        </div>

                        {/* Rating Quick Select */}
                        <div className="relative">
                            <select
                                value={ratingFilter}
                                onChange={(e) => handleRatingChange(e.target.value)}
                                className="appearance-none bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-white text-xs px-3 py-1.5 pr-8 rounded-lg focus:outline-none focus:border-futuristic-yellow-500/50 focus:ring-1 focus:ring-futuristic-yellow-500/30 cursor-pointer hover:bg-futuristic-blue-700/80 transition-all"
                                style={{ 
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.5rem center',
                                    backgroundSize: '1rem'
                                }}
                            >
                                <option value="" className="bg-futuristic-blue-900 text-white">Rating</option>
                                <option value="9" className="bg-futuristic-blue-900 text-white">9+ ⭐</option>
                                <option value="8" className="bg-futuristic-blue-900 text-white">8+ ⭐</option>
                                <option value="7" className="bg-futuristic-blue-900 text-white">7+ ⭐</option>
                                <option value="6" className="bg-futuristic-blue-900 text-white">6+ ⭐</option>
                                <option value="5" className="bg-futuristic-blue-900 text-white">5+ ⭐</option>
                                <option value="lt5" className="bg-futuristic-blue-900 text-white">&lt;5 ⭐</option>
                            </select>
                        </div>

                        {/* Expand/Collapse Button */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="px-3 py-1.5 bg-futuristic-blue-800/60 text-white/90 hover:bg-futuristic-blue-700/60 border border-futuristic-blue-500/30 rounded-lg text-xs font-medium transition-all"
                        >
                            {isExpanded ? 'Less' : 'More'} Filters
                        </button>
                    </div>
                </div>

                {/* Expanded Filters */}
                {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-futuristic-blue-500/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Genre Filter */}
                            {genres.length > 0 && (
                                <div>
                                    <label className="block text-xs font-semibold text-futuristic-yellow-400/90 mb-2">Genres</label>
                                    <div className="max-h-32 overflow-y-auto futuristic-card p-2 bg-futuristic-blue-900/40 border border-futuristic-blue-500/20 rounded-lg">
                                        <div className="flex flex-wrap gap-1.5">
                                            {genres.map((genre) => (
                                                <button
                                                    key={genre.id}
                                                    onClick={() => handleGenreToggle(genre.id)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
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

                            {/* Date Filters */}
                            {showDateFilter && (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-futuristic-yellow-400/90 mb-2">Date Range</label>
                                        <select
                                            value={dateRangeFilter}
                                            onChange={(e) => handleDateRangeChange(e.target.value)}
                                            className="w-full appearance-none bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-white text-xs px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-futuristic-yellow-500/50 focus:ring-1 focus:ring-futuristic-yellow-500/30 cursor-pointer hover:bg-futuristic-blue-700/80 transition-all"
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

                                    <div>
                                        <label className="block text-xs font-semibold text-futuristic-yellow-400/90 mb-2">Released In</label>
                                        <select
                                            value={daysPastFilter}
                                            onChange={(e) => handleDaysPastChange(e.target.value)}
                                            className="w-full appearance-none bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-white text-xs px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-futuristic-yellow-500/50 focus:ring-1 focus:ring-futuristic-yellow-500/30 cursor-pointer hover:bg-futuristic-blue-700/80 transition-all"
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
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Active Filters Display */}
            {activeFiltersCount > 0 && (
                <div className="mb-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <button
                            onClick={clearFilters}
                            className="px-3 py-1.5 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 hover:bg-futuristic-yellow-500/30 border border-futuristic-yellow-500/40 rounded-lg text-xs font-medium transition-all"
                        >
                            Clear All ({activeFiltersCount})
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-futuristic-yellow-400/80">Active:</span>
                        {getSelectedGenreNames().map((genre) => (
                            <button
                                key={`genre-${genre.id}`}
                                onClick={() => removeFilter('genre', genre.id)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full text-xs font-medium hover:bg-futuristic-yellow-500/30 transition-colors border border-futuristic-yellow-500/30"
                            >
                                <span>{genre.name}</span>
                                <span className="text-futuristic-yellow-500 font-bold">×</span>
                            </button>
                        ))}
                        {filters.year && (
                            <>
                                {(Array.isArray(filters.year) ? filters.year : [filters.year]).map((year) => (
                                    <button
                                        key={year}
                                        onClick={() => removeFilter('year', year)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full text-xs font-medium hover:bg-futuristic-yellow-500/30 transition-colors border border-futuristic-yellow-500/30"
                                    >
                                        <span>Year: {year}</span>
                                        <span className="text-futuristic-yellow-500 font-bold">×</span>
                                    </button>
                                ))}
                            </>
                        )}
                        {ratingFilter && (
                            <button
                                onClick={() => removeFilter('rating')}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full text-xs font-medium hover:bg-futuristic-yellow-500/30 transition-colors border border-futuristic-yellow-500/30"
                            >
                                <span>Rating: {ratingFilter === 'lt5' ? '<5' : `${ratingFilter}+`}</span>
                                <span className="text-futuristic-yellow-500 font-bold">×</span>
                            </button>
                        )}
                        {dateRangeFilter && (
                            <button
                                onClick={() => removeFilter('dateRange')}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full text-xs font-medium hover:bg-futuristic-yellow-500/30 transition-colors border border-futuristic-yellow-500/30"
                            >
                                <span>
                                    {dateRangeFilter === 'upcoming' ? 'Upcoming' :
                                     dateRangeFilter === 'this_week' ? 'This Week' :
                                     dateRangeFilter === 'this_month' ? 'This Month' :
                                     dateRangeFilter === 'this_year' ? 'This Year' : dateRangeFilter}
                                </span>
                                <span className="text-futuristic-yellow-500 font-bold">×</span>
                            </button>
                        )}
                        {daysPastFilter && (
                            <button
                                onClick={() => removeFilter('daysPast')}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full text-xs font-medium hover:bg-futuristic-yellow-500/30 transition-colors border border-futuristic-yellow-500/30"
                            >
                                <span>
                                    {daysPastFilter === '7' ? 'Last 7 Days' :
                                     daysPastFilter === '30' ? 'Last 30 Days' :
                                     daysPastFilter === '60' ? 'Last 60 Days' :
                                     daysPastFilter === '90' ? 'Last 90 Days' :
                                     daysPastFilter === '180' ? 'Last 6 Months' :
                                     daysPastFilter === '365' ? 'Last Year' : `Last ${daysPastFilter} Days`}
                                </span>
                                <span className="text-futuristic-yellow-500 font-bold">×</span>
                            </button>
                        )}
                        {includeUpcoming && (
                            <button
                                onClick={() => removeFilter('includeUpcoming')}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full text-xs font-medium hover:bg-futuristic-yellow-500/30 transition-colors border border-futuristic-yellow-500/30"
                            >
                                <span>Include Upcoming</span>
                                <span className="text-futuristic-yellow-500 font-bold">×</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default SortFilter;
