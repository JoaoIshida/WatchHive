"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import LoadingSpinner from '../components/LoadingSpinner';
import LoadingCard from '../components/LoadingCard';
import SortFilter from '../components/SortFilter';
import ContentCard from '../components/ContentCard';

const PopularMoviesPage = () => {
    const [movies, setMovies] = useState([]);
    const [allMovies, setAllMovies] = useState([]); // Store original unfiltered movies
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [genres, setGenres] = useState([]);
    const [sortConfig, setSortConfig] = useState({ sortBy: 'popularity', sortOrder: 'desc' });
    const [filters, setFilters] = useState({});
    const searchParams = useSearchParams();
    const queryPage = searchParams.get('page');

    // Fetch genres
    useEffect(() => {
        const fetchGenres = async () => {
            try {
                const response = await fetch('/api/genres?type=movie');
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

    useEffect(() => {
        if (queryPage) {
            setPage(Number(queryPage));
        }
    }, [queryPage]);

    useEffect(() => {
        const fetchPopularMovies = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/popularMovies?page=${page}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch popular movies');
                }
                const data = await response.json();
                setAllMovies(data.results);
                setMovies(data.results);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPopularMovies();
    }, [page]);

    // Apply sorting and filtering
    useEffect(() => {
        let filtered = [...allMovies];

        // Apply filters
        if (filters.genres && filters.genres.length > 0) {
            filtered = filtered.filter(movie =>
                movie.genre_ids && movie.genre_ids.some(genreId => filters.genres.includes(genreId))
            );
        }

        if (filters.year) {
            const year = parseInt(filters.year);
            filtered = filtered.filter(movie => {
                if (!movie.release_date) return false;
                return new Date(movie.release_date).getFullYear() === year;
            });
        }

        if (filters.minRating) {
            const minRating = parseFloat(filters.minRating);
            filtered = filtered.filter(movie => movie.vote_average >= minRating);
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

        if (filters.dateRange) {
            const now = new Date();
            const thisWeek = new Date(now);
            thisWeek.setDate(now.getDate() - now.getDay());
            const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const thisYear = new Date(now.getFullYear(), 0, 1);

            filtered = filtered.filter(movie => {
                if (!movie.release_date) return false;
                const releaseDate = new Date(movie.release_date);
                
                switch (filters.dateRange) {
                    case 'upcoming':
                        return releaseDate > now;
                    case 'this_week':
                        return releaseDate >= thisWeek && releaseDate <= now;
                    case 'this_month':
                        return releaseDate >= thisMonth && releaseDate <= now;
                    case 'this_year':
                        return releaseDate >= thisYear && releaseDate <= now;
                    default:
                        return true;
                }
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

        setMovies(filtered);
    }, [allMovies, sortConfig, filters]);

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">Popular Movies</h1>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <LoadingCard count={12} />
                </div>
            </div>
        );
    }
    if (error) return <div className="text-center py-6 text-red-400">{`Error: ${error}`}</div>;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">Popular Movies</h1>
            
            <SortFilter
                onSortChange={setSortConfig}
                onFilterChange={setFilters}
                genres={genres}
                showDateFilter={true}
            />
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
                movies.length === 0 ? (
                    <div className="text-center py-6 text-white">No popular movies available</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {movies.map((movie) => (
                            <ContentCard
                                key={movie.id}
                                item={movie}
                                mediaType="movie"
                                href={`/movies/${movie.id}`}
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
    );
};

export default PopularMoviesPage;
