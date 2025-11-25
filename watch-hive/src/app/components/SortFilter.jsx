"use client";
import { useState } from 'react';

const SortFilter = ({ onSortChange, onFilterChange, genres = [], showDateFilter = true }) => {
    const [sortBy, setSortBy] = useState('popularity');
    const [sortOrder, setSortOrder] = useState('desc');
    const [selectedGenres, setSelectedGenres] = useState([]);
    const [yearFilter, setYearFilter] = useState('');
    const [ratingFilter, setRatingFilter] = useState('');
    const [dateRangeFilter, setDateRangeFilter] = useState('');
    const [daysPastFilter, setDaysPastFilter] = useState('');

    const handleSortChange = (newSortBy) => {
        const newSortOrder = sortBy === newSortBy && sortOrder === 'desc' ? 'asc' : 'desc';
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
        onSortChange({ sortBy: newSortBy, sortOrder: newSortOrder });
    };

    const handleGenreToggle = (genreId) => {
        const newGenres = selectedGenres.includes(genreId)
            ? selectedGenres.filter(id => id !== genreId)
            : [...selectedGenres, genreId];
        setSelectedGenres(newGenres);
        onFilterChange({ genres: newGenres });
    };

    const handleYearChange = (year) => {
        setYearFilter(year);
        onFilterChange({ year });
    };

    const handleRatingChange = (rating) => {
        setRatingFilter(rating);
        onFilterChange({ minRating: rating });
    };

    const handleDateRangeChange = (range) => {
        setDateRangeFilter(range);
        onFilterChange({ dateRange: range });
    };

    const handleDaysPastChange = (days) => {
        setDaysPastFilter(days);
        onFilterChange({ daysPast: days });
    };

    const clearFilters = () => {
        setSelectedGenres([]);
        setYearFilter('');
        setRatingFilter('');
        setDateRangeFilter('');
        setDaysPastFilter('');
        setSortBy('popularity');
        setSortOrder('desc');
        onSortChange({ sortBy: 'popularity', sortOrder: 'desc' });
        onFilterChange({});
    };

    return (
        <div className="futuristic-card p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4 mb-4">
                <h3 className="text-lg font-bold text-futuristic-yellow-400">Sort & Filter</h3>
                <button
                    onClick={clearFilters}
                    className="futuristic-button text-sm px-3 py-1"
                >
                    Clear All
                </button>
            </div>

            {/* Sort Options */}
            <div className="mb-4">
                <label className="block text-sm font-semibold text-white mb-2">Sort By:</label>
                <div className="flex flex-wrap gap-2">
                    {['popularity', 'rating', 'release_date', 'title'].map((option) => (
                        <button
                            key={option}
                            onClick={() => handleSortChange(option)}
                            className={`futuristic-button text-sm px-3 py-1 ${
                                sortBy === option
                                    ? 'bg-futuristic-yellow-500 text-black'
                                    : ''
                            }`}
                        >
                            {option === 'release_date' ? 'Release Date' : 
                             option === 'title' ? 'Title (A-Z)' : 
                             option.charAt(0).toUpperCase() + option.slice(1)}
                            {sortBy === option && (
                                <span className="ml-1">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Genre Filter */}
            {genres.length > 0 && (
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-white mb-2">Genres:</label>
                    <div className="flex flex-wrap gap-2">
                        {genres.map((genre) => (
                            <button
                                key={genre.id}
                                onClick={() => handleGenreToggle(genre.id)}
                                className={`futuristic-tag ${
                                    selectedGenres.includes(genre.id)
                                        ? 'bg-futuristic-yellow-500 text-black'
                                        : ''
                                }`}
                            >
                                {genre.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Year Filter */}
            <div className="mb-4">
                <label className="block text-sm font-semibold text-white mb-2">Year:</label>
                <input
                    type="number"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    placeholder="Filter by year"
                    value={yearFilter}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="futuristic-input w-32"
                />
            </div>

            {/* Rating Filter */}
            <div className="mb-4">
                <label className="block text-sm font-semibold text-white mb-2">Minimum Rating:</label>
                <select
                    value={ratingFilter}
                    onChange={(e) => handleRatingChange(e.target.value)}
                    className="futuristic-input"
                >
                    <option value="">All Ratings</option>
                    <option value="9">9+</option>
                    <option value="8">8+</option>
                    <option value="7">7+</option>
                    <option value="6">6+</option>
                    <option value="5">5+</option>
                </select>
            </div>

            {/* Date Range Filter */}
            {showDateFilter && (
                <>
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-white mb-2">Release Date Range:</label>
                        <select
                            value={dateRangeFilter}
                            onChange={(e) => handleDateRangeChange(e.target.value)}
                            className="futuristic-input"
                        >
                            <option value="">All Dates</option>
                            <option value="upcoming">Upcoming</option>
                            <option value="this_week">This Week</option>
                            <option value="this_month">This Month</option>
                            <option value="this_year">This Year</option>
                        </select>
                    </div>

                    {/* Days Past Filter */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-white mb-2">Released in Last:</label>
                        <select
                            value={daysPastFilter}
                            onChange={(e) => handleDaysPastChange(e.target.value)}
                            className="futuristic-input"
                        >
                            <option value="">All Time</option>
                            <option value="7">Last 7 Days</option>
                            <option value="30">Last 30 Days</option>
                            <option value="60">Last 60 Days</option>
                            <option value="90">Last 90 Days</option>
                            <option value="180">Last 6 Months</option>
                            <option value="365">Last Year</option>
                        </select>
                    </div>
                </>
            )}
        </div>
    );
};

export default SortFilter;

