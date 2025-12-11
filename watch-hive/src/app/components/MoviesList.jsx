"use client";
import { useEffect, useState } from 'react';
import ContentCard from './ContentCard';
import LoadingCard from './LoadingCard';

const MoviesList = ({ page, filters, sortConfig, onPageChange }) => {
    const [movies, setMovies] = useState([]);
    const [allMovies, setAllMovies] = useState([]); // For trending client-side filtering
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        const fetchMovies = async () => {
            setLoading(true);
            setError(null);
            try {
                // Handle trending mode - fetch array and do client-side filtering
                if (filters.trending === true) {
                    const response = await fetch('/api/trending/movies');
                    if (!response.ok) {
                        throw new Error('Failed to fetch trending movies');
                    }
                    const data = await response.json();
                    setAllMovies(data);
                    return; // Client-side filtering will handle the rest
                }
                
                // Handle upcoming mode
                if (filters.upcoming === true) {
                    const queryParams = new URLSearchParams();
                    queryParams.set('page', page.toString());
                    
                    const response = await fetch(`/api/upcoming/movies?${queryParams.toString()}`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch upcoming movies');
                    }
                    const data = await response.json();
                    setMovies(data.results || []);
                    setTotalPages(data.total_pages || 1);
                    return;
                }
                
                // Default: popular movies with server-side filtering
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
                if (filters.runtimeMin) {
                    queryParams.set('runtimeMin', filters.runtimeMin);
                }
                if (filters.runtimeMax) {
                    queryParams.set('runtimeMax', filters.runtimeMax);
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
                if (filters.dateRange) {
                    queryParams.set('dateRange', filters.dateRange);
                }
                if (filters.daysPast) {
                    queryParams.set('daysPast', filters.daysPast);
                }
                if (filters.inTheaters === true) {
                    queryParams.set('inTheaters', 'true');
                }
                // Always send includeUpcoming parameter so API knows whether to filter
                if (filters.includeUpcoming !== undefined) {
                    queryParams.set('includeUpcoming', filters.includeUpcoming.toString());
                }
                
                // Add sorting
                const sortByValue = sortConfig.sortBy === 'popularity' ? 'popularity' :
                                   sortConfig.sortBy === 'rating' ? 'vote_average' :
                                   sortConfig.sortBy === 'release_date' ? 'primary_release_date' :
                                   'title';
                const sortOrder = sortConfig.sortOrder === 'asc' ? 'asc' : 'desc';
                queryParams.set('sortBy', `${sortByValue}.${sortOrder}`);

                const response = await fetch(`/api/popularMovies?${queryParams.toString()}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch popular movies');
                }
                const data = await response.json();
                setMovies(data.results);
                setTotalPages(data.total_pages || 1);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchMovies();
    }, [page, filters, sortConfig]);

    // Client-side filtering and sorting for trending movies
    useEffect(() => {
        if (filters.trending === true && allMovies.length > 0) {
            let filtered = [...allMovies];

            // Apply filters
            if (filters.genres && filters.genres.length > 0) {
                filtered = filtered.filter(movie =>
                    movie.genre_ids && movie.genre_ids.some(genreId => filters.genres.includes(genreId))
                );
            }

            if (filters.year) {
                const year = parseInt(Array.isArray(filters.year) ? filters.year[0] : filters.year);
                filtered = filtered.filter(movie => {
                    if (!movie.release_date) return false;
                    return new Date(movie.release_date).getFullYear() === year;
                });
            }

            if (filters.minRating) {
                const minRating = parseFloat(filters.minRating);
                filtered = filtered.filter(movie => movie.vote_average >= minRating);
            }

            if (filters.maxRating) {
                const maxRating = parseFloat(filters.maxRating);
                filtered = filtered.filter(movie => movie.vote_average <= maxRating);
            }

            if (filters.daysPast) {
                const days = parseInt(filters.daysPast);
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - days);
                filtered = filtered.filter(movie => {
                    if (!movie.release_date) return false;
                    const releaseDate = new Date(movie.release_date);
                    return releaseDate >= cutoffDate && releaseDate <= new Date();
                });
            }

            // Apply sorting
            filtered.sort((a, b) => {
                let aValue, bValue;
                
                switch (sortConfig.sortBy) {
                    case 'rating':
                        aValue = a.vote_average || 0;
                        bValue = b.vote_average || 0;
                        break;
                    case 'release_date':
                        aValue = a.release_date ? new Date(a.release_date).getTime() : 0;
                        bValue = b.release_date ? new Date(b.release_date).getTime() : 0;
                        break;
                    case 'title':
                        aValue = (a.title || '').toLowerCase();
                        bValue = (b.title || '').toLowerCase();
                        break;
                    case 'popularity':
                    default:
                        aValue = a.popularity || 0;
                        bValue = b.popularity || 0;
                        break;
                }

                if (sortConfig.sortBy === 'title') {
                    return sortConfig.sortOrder === 'asc' 
                        ? aValue.localeCompare(bValue)
                        : bValue.localeCompare(aValue);
                } else {
                    return sortConfig.sortOrder === 'desc' 
                        ? bValue - aValue 
                        : aValue - bValue;
                }
            });

            // Client-side pagination
            const itemsPerPage = 20;
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedResults = filtered.slice(startIndex, endIndex);
            
            setMovies(paginatedResults);
            setTotalPages(Math.ceil(filtered.length / itemsPerPage));
        }
    }, [allMovies, filters, sortConfig, page]);

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
                <span className="bg-charcoal-800/80 border border-amber-500/50 text-amber-500 font-bold p-2 px-4 rounded-lg">{page}</span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    className="futuristic-button disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={page >= totalPages}
                >
                    Next
                </button>
            </div>
            {movies.length === 0 ? (
                <div className="text-center py-6 text-white">No popular movies available</div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {movies.map((movie) => (
                        <ContentCard
                            key={movie.id}
                            item={movie}
                            mediaType="movie"
                            href={`/movies/${movie.id}`}
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
                <span className="bg-charcoal-800/80 border border-amber-500/50 text-amber-500 font-bold p-2 px-4 rounded-lg">{page}</span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    className="futuristic-button disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={page >= totalPages}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default MoviesList;

