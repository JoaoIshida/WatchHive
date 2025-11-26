"use client";
import { useState, useMemo, useEffect } from 'react';

const FilterSidebar = ({ onSortChange, onFilterChange, genres = [], showDateFilter = true, sortConfig = { sortBy: 'popularity', sortOrder: 'desc' }, filters = {} }) => {
    const [sortBy, setSortBy] = useState(sortConfig.sortBy || 'popularity');
    const [sortOrder, setSortOrder] = useState(sortConfig.sortOrder || 'desc');
    const [selectedGenres, setSelectedGenres] = useState([]);
    const [yearFilter, setYearFilter] = useState('');
    const [ratingFilter, setRatingFilter] = useState('');
    const [dateRangeFilter, setDateRangeFilter] = useState('');
    const [daysPastFilter, setDaysPastFilter] = useState('');
    const [includeUpcoming, setIncludeUpcoming] = useState(false);

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
        setYearFilter(filters.year || '');
        if (filters.minRating) {
            setRatingFilter(filters.minRating);
        } else if (filters.maxRating) {
            setRatingFilter('lt5');
        } else {
            setRatingFilter('');
        }
        setDateRangeFilter(filters.dateRange || '');
        setDaysPastFilter(filters.daysPast || '');
        setIncludeUpcoming(filters.includeUpcoming || false);
    }, [JSON.stringify(filters)]);

    // Generate year options
    const currentYear = new Date().getFullYear();
    const yearOptions = useMemo(() => {
        const years = [];
        for (let year = currentYear + 1; year >= 1900; year--) {
            years.push(year);
        }
        return years;
    }, [currentYear]);

    const handleSortChange = (newSortBy) => {
        const currentSortBy = sortConfig.sortBy || sortBy;
        const currentSortOrder = sortConfig.sortOrder || sortOrder;
        const newSortOrder = currentSortBy === newSortBy && currentSortOrder === 'desc' ? 'asc' : 'desc';
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
        onSortChange({ sortBy: newSortBy, sortOrder: newSortOrder });
    };

    const buildFilterObject = (updates = {}) => {
        const filterObj = {};
        const genres = updates.genres !== undefined ? updates.genres : selectedGenres;
        const year = updates.year !== undefined ? updates.year : yearFilter;
        const rating = updates.rating !== undefined ? updates.rating : ratingFilter;
        const dateRange = updates.dateRange !== undefined ? updates.dateRange : dateRangeFilter;
        const daysPast = updates.daysPast !== undefined ? updates.daysPast : daysPastFilter;
        const includeUpcomingValue = updates.includeUpcoming !== undefined ? updates.includeUpcoming : includeUpcoming;
        
        if (genres.length > 0) filterObj.genres = genres;
        if (year) filterObj.year = year;
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

    const handleYearChange = (year) => {
        setYearFilter(year);
        onFilterChange(buildFilterObject({ year }));
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
        setYearFilter('');
        setRatingFilter('');
        setDateRangeFilter('');
        setDaysPastFilter('');
        setIncludeUpcoming(false);
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
        if (yearFilter) count++;
        if (ratingFilter) count++;
        if (dateRangeFilter) count++;
        if (daysPastFilter) count++;
        if (includeUpcoming) count++;
        return count;
    }, [selectedGenres.length, yearFilter, ratingFilter, dateRangeFilter, daysPastFilter, includeUpcoming]);

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
                    <div className="space-y-2">
                        {['popularity', 'rating', 'release_date', 'title'].map((option) => (
                            <button
                                key={option}
                                onClick={() => handleSortChange(option)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                    sortBy === option
                                        ? 'bg-futuristic-yellow-500 text-black shadow-glow-yellow'
                                        : 'bg-futuristic-blue-800/60 text-white/90 hover:bg-futuristic-blue-700/60 border border-futuristic-blue-500/30'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{getSortLabel(option)}</span>
                                    {sortBy === option && (
                                        <span className="text-xs">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
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

                {/* Year Filter */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-futuristic-yellow-400/90 mb-3">Year</h3>
                    <select
                        value={yearFilter}
                        onChange={(e) => handleYearChange(e.target.value)}
                        className="w-full appearance-none bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-white text-sm px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-futuristic-yellow-500/50 focus:ring-1 focus:ring-futuristic-yellow-500/30 cursor-pointer hover:bg-futuristic-blue-700/80 transition-all"
                        style={{ 
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fef08a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.5rem center',
                            backgroundSize: '1rem'
                        }}
                    >
                        <option value="" className="bg-futuristic-blue-900 text-white">All Years</option>
                        {yearOptions.map((year) => (
                            <option key={year} value={year} className="bg-futuristic-blue-900 text-white">
                                {year}
                            </option>
                        ))}
                    </select>
                </div>

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

                {/* Date Filters */}
                {showDateFilter && (
                    <>
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
                    </>
                )}
            </div>
        </div>
    );
};

export default FilterSidebar;

