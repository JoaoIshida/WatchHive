"use client";
import { useMemo } from 'react';
import { formatRuntime } from '../utils/runtimeFormatter';

const ActiveFilters = ({ filters, genres, onFilterChange, onSortChange, sortConfig, watchProviders = [] }) => {
    const getSelectedGenreNames = () => {
        if (!filters.genres || !Array.isArray(filters.genres)) return [];
        return filters.genres.map(id => {
            const genre = genres.find(g => g.id === id);
            return genre ? { id, name: genre.name } : null;
        }).filter(Boolean);
    };

    const getSelectedProviderInfo = (providerId) => {
        const provider = watchProviders.find(p => p.provider_id === parseInt(providerId, 10));
        return provider ? { id: provider.provider_id, name: provider.provider_name, logo_path: provider.logo_path } : null;
    };

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (filters.genres && filters.genres.length > 0) count += filters.genres.length;
        if (filters.certification) {
            count += Array.isArray(filters.certification) ? filters.certification.length : 1;
        }
        if (filters.year) {
            count += Array.isArray(filters.year) ? filters.year.length : 1;
        }
        if (filters.minRating || filters.maxRating) count++;
        if (filters.runtimeMin || filters.runtimeMax) count++;
        if (filters.dateRange) count++;
        if (filters.daysPast) count++;
        if (filters.inTheaters) count++;
        if (filters.seasonsMin || filters.seasonsMax) count++;
        if (filters.watchProviders) {
            count += Array.isArray(filters.watchProviders) ? filters.watchProviders.length : 1;
        }
        if (filters.keywords && filters.keywords.length > 0) count += filters.keywords.length;
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
                // Handle both array and string
                if (Array.isArray(newFilters.year)) {
                    newFilters.year = newFilters.year.filter(y => y !== value);
                    if (newFilters.year.length === 0) delete newFilters.year;
                } else {
                    delete newFilters.year;
                }
                break;
            case 'rating':
                delete newFilters.minRating;
                delete newFilters.maxRating;
                break;
            case 'runtime':
                delete newFilters.runtimeMin;
                delete newFilters.runtimeMax;
                break;
            case 'certification':
                // Handle both array and string
                if (Array.isArray(newFilters.certification)) {
                    newFilters.certification = newFilters.certification.filter(c => c !== value);
                    if (newFilters.certification.length === 0) delete newFilters.certification;
                } else {
                    delete newFilters.certification;
                }
                break;
            case 'dateRange':
                delete newFilters.dateRange;
                break;
            case 'daysPast':
                delete newFilters.daysPast;
                break;
            case 'inTheaters':
                delete newFilters.inTheaters;
                break;
            case 'includeUpcoming':
                delete newFilters.includeUpcoming;
                break;
            case 'seasons':
                delete newFilters.seasonsMin;
                delete newFilters.seasonsMax;
                break;
            case 'watchProviders':
                // Handle both array and string
                if (Array.isArray(newFilters.watchProviders)) {
                    newFilters.watchProviders = newFilters.watchProviders.filter(p => p !== value);
                    if (newFilters.watchProviders.length === 0) delete newFilters.watchProviders;
                } else {
                    delete newFilters.watchProviders;
                }
                break;
            case 'keyword':
                // Keywords are stored as array of objects with id and name
                if (Array.isArray(newFilters.keywords)) {
                    newFilters.keywords = newFilters.keywords.filter(k => k.id !== value);
                    if (newFilters.keywords.length === 0) delete newFilters.keywords;
                }
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
                    className="px-3 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-xs font-medium transition-all"
                >
                    Clear All ({activeFiltersCount})
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-amber-400/80">Active:</span>
                {getSelectedGenreNames().map((genre) => (
                    <button
                        key={`genre-${genre.id}`}
                        onClick={() => removeFilter('genre', genre.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                    >
                        <span>{genre.name}</span>
                        <span className="text-amber-500 font-bold">×</span>
                    </button>
                ))}
                {filters.year && (
                    <>
                        {(Array.isArray(filters.year) ? filters.year : [filters.year]).map((year) => (
                            <button
                                key={year}
                                onClick={() => removeFilter('year', year)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                            >
                                <span>Year: {year}</span>
                                <span className="text-amber-500 font-bold">×</span>
                            </button>
                        ))}
                    </>
                )}
                {(filters.minRating || filters.maxRating) && (
                    <button
                        onClick={() => removeFilter('rating')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                    >
                        <span>
                            Rating: {filters.maxRating === '5' ? '<5' : `${filters.minRating || filters.maxRating}+`}
                        </span>
                        <span className="text-amber-500 font-bold">×</span>
                    </button>
                )}
                {(filters.runtimeMin || filters.runtimeMax) && (
                    <button
                        onClick={() => removeFilter('runtime')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                    >
                        <span>
                            Runtime: {filters.runtimeMin && filters.runtimeMax 
                                ? `${formatRuntime(parseInt(filters.runtimeMin))} - ${formatRuntime(parseInt(filters.runtimeMax))}`
                                : filters.runtimeMin 
                                    ? `${formatRuntime(parseInt(filters.runtimeMin))}+`
                                    : `Up to ${formatRuntime(parseInt(filters.runtimeMax))}`
                            }
                        </span>
                        <span className="text-amber-500 font-bold">×</span>
                    </button>
                )}
                {filters.certification && (
                    <>
                        {(Array.isArray(filters.certification) ? filters.certification : [filters.certification]).map((cert) => (
                            <button
                                key={cert}
                                onClick={() => removeFilter('certification', cert)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                            >
                                <span>Age Certification: {cert}</span>
                                <span className="text-amber-500 font-bold">×</span>
                            </button>
                        ))}
                    </>
                )}
                {filters.dateRange && (
                    <button
                        onClick={() => removeFilter('dateRange')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                    >
                        <span>
                            {filters.dateRange === 'upcoming' ? 'Upcoming' :
                             filters.dateRange === 'this_week' ? 'This Week' :
                             filters.dateRange === 'this_month' ? 'This Month' :
                             filters.dateRange === 'this_year' ? 'This Year' : filters.dateRange}
                        </span>
                        <span className="text-amber-500 font-bold">×</span>
                    </button>
                )}
                {filters.daysPast && (
                    <button
                        onClick={() => removeFilter('daysPast')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                    >
                        <span>
                            {filters.daysPast === '7' ? 'Last 7 Days' :
                             filters.daysPast === '30' ? 'Last 30 Days' :
                             filters.daysPast === '60' ? 'Last 60 Days' :
                             filters.daysPast === '90' ? 'Last 90 Days' :
                             filters.daysPast === '180' ? 'Last 6 Months' :
                             filters.daysPast === '365' ? 'Last Year' : `Last ${filters.daysPast} Days`}
                        </span>
                        <span className="text-amber-500 font-bold">×</span>
                    </button>
                )}
                {filters.inTheaters && (
                    <button
                        onClick={() => removeFilter('inTheaters')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                    >
                        <span>In Theaters</span>
                        <span className="text-amber-500 font-bold">×</span>
                    </button>
                )}
                {filters.includeUpcoming && (
                    <button
                        onClick={() => removeFilter('includeUpcoming')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                    >
                        <span>Include Upcoming</span>
                        <span className="text-amber-500 font-bold">×</span>
                    </button>
                )}
                {(filters.seasonsMin || filters.seasonsMax || filters.seasonNumber) && (
                    <button
                        onClick={() => removeFilter('seasons')}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                    >
                        <span>
                            Seasons: {filters.seasonsMin && filters.seasonsMax 
                                ? `${filters.seasonsMin} - ${filters.seasonsMax}`
                                : filters.seasonsMin 
                                    ? `${filters.seasonsMin}+`
                                    : `Up to ${filters.seasonsMax}`
                            }
                        </span>
                        <span className="text-amber-500 font-bold">×</span>
                    </button>
                )}
                {filters.watchProviders && (
                    <>
                        {(Array.isArray(filters.watchProviders) ? filters.watchProviders : [filters.watchProviders]).map((providerId) => {
                            const providerInfo = getSelectedProviderInfo(providerId);
                            return (
                                <button
                                    key={providerId}
                                    onClick={() => removeFilter('watchProviders', providerId)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                                >
                                    {providerInfo && providerInfo.logo_path ? (
                                        <>
                                            <img
                                                src={`https://image.tmdb.org/t/p/w45${providerInfo.logo_path}`}
                                                alt={providerInfo.name}
                                                className="w-5 h-5 object-contain"
                                                loading="lazy"
                                            />
                                            <span>{providerInfo.name}</span>
                                        </>
                                    ) : (
                                        <span>Provider: {providerInfo?.name || providerId}</span>
                                    )}
                                    <span className="text-amber-500 font-bold">×</span>
                                </button>
                            );
                        })}
                    </>
                )}
                {filters.keywords && filters.keywords.length > 0 && (
                    <>
                        {filters.keywords.map((keyword) => (
                            <button
                                key={keyword.id}
                                onClick={() => removeFilter('keyword', keyword.id)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                            >
                                <span>Keyword: {keyword.name}</span>
                                <span className="text-amber-500 font-bold">×</span>
                            </button>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};

export default ActiveFilters;

