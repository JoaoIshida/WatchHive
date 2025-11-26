"use client";
import { useMemo } from 'react';

const ActiveFilters = ({ filters, genres, onFilterChange, onSortChange, sortConfig }) => {
    const getSelectedGenreNames = () => {
        if (!filters.genres || !Array.isArray(filters.genres)) return [];
        return filters.genres.map(id => {
            const genre = genres.find(g => g.id === id);
            return genre ? { id, name: genre.name } : null;
        }).filter(Boolean);
    };

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (filters.genres && filters.genres.length > 0) count += filters.genres.length;
        if (filters.year) count++;
        if (filters.minRating || filters.maxRating) count++;
        if (filters.dateRange) count++;
        if (filters.daysPast) count++;
        if (filters.includeUpcoming) count++;
        return count;
    }, [filters]);

    const removeFilter = (type, value = null) => {
        const newFilters = { ...filters };
        
        switch (type) {
            case 'genre':
                newFilters.genres = (newFilters.genres || []).filter(id => id !== value);
                if (newFilters.genres.length === 0) delete newFilters.genres;
                break;
            case 'year':
                delete newFilters.year;
                break;
            case 'rating':
                delete newFilters.minRating;
                delete newFilters.maxRating;
                break;
            case 'dateRange':
                delete newFilters.dateRange;
                break;
            case 'daysPast':
                delete newFilters.daysPast;
                break;
            case 'includeUpcoming':
                delete newFilters.includeUpcoming;
                break;
        }
        onFilterChange(newFilters);
    };

    const clearAllFilters = () => {
        onFilterChange({});
        onSortChange({ sortBy: 'popularity', sortOrder: 'desc' });
    };

    if (activeFiltersCount === 0) return null;

    return (
        <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
                <button
                    onClick={clearAllFilters}
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
                    <button
                        onClick={() => removeFilter('year')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full text-xs font-medium hover:bg-futuristic-yellow-500/30 transition-colors border border-futuristic-yellow-500/30"
                    >
                        <span>Year: {filters.year}</span>
                        <span className="text-futuristic-yellow-500 font-bold">×</span>
                    </button>
                )}
                {(filters.minRating || filters.maxRating) && (
                    <button
                        onClick={() => removeFilter('rating')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full text-xs font-medium hover:bg-futuristic-yellow-500/30 transition-colors border border-futuristic-yellow-500/30"
                    >
                        <span>
                            Rating: {filters.maxRating === '5' ? '<5' : `${filters.minRating || filters.maxRating}+`}
                        </span>
                        <span className="text-futuristic-yellow-500 font-bold">×</span>
                    </button>
                )}
                {filters.dateRange && (
                    <button
                        onClick={() => removeFilter('dateRange')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full text-xs font-medium hover:bg-futuristic-yellow-500/30 transition-colors border border-futuristic-yellow-500/30"
                    >
                        <span>
                            {filters.dateRange === 'upcoming' ? 'Upcoming' :
                             filters.dateRange === 'this_week' ? 'This Week' :
                             filters.dateRange === 'this_month' ? 'This Month' :
                             filters.dateRange === 'this_year' ? 'This Year' : filters.dateRange}
                        </span>
                        <span className="text-futuristic-yellow-500 font-bold">×</span>
                    </button>
                )}
                {filters.daysPast && (
                    <button
                        onClick={() => removeFilter('daysPast')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full text-xs font-medium hover:bg-futuristic-yellow-500/30 transition-colors border border-futuristic-yellow-500/30"
                    >
                        <span>
                            {filters.daysPast === '7' ? 'Last 7 Days' :
                             filters.daysPast === '30' ? 'Last 30 Days' :
                             filters.daysPast === '60' ? 'Last 60 Days' :
                             filters.daysPast === '90' ? 'Last 90 Days' :
                             filters.daysPast === '180' ? 'Last 6 Months' :
                             filters.daysPast === '365' ? 'Last Year' : `Last ${filters.daysPast} Days`}
                        </span>
                        <span className="text-futuristic-yellow-500 font-bold">×</span>
                    </button>
                )}
                {filters.includeUpcoming && (
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
    );
};

export default ActiveFilters;

