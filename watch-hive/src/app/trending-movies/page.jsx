"use client";
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import LoadingSpinner from '../components/LoadingSpinner';
import LoadingCard from '../components/LoadingCard';
import SortFilter from '../components/SortFilter';
import ContentCard from '../components/ContentCard';

const TrendingMoviesPage = () => {
    const [movies, setMovies] = useState([]);
    const [allMovies, setAllMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [genres, setGenres] = useState([]);
    const [sortConfig, setSortConfig] = useState({ sortBy: 'popularity', sortOrder: 'desc' });
    const [filters, setFilters] = useState({});
    const searchParams = useSearchParams();
    const language = searchParams.get('language') || 'en-US';

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
        const fetchTrendingMovies = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/trending/movies?language=${language}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch trending movies');
                }
                const data = await response.json();
                setAllMovies(data);
                setMovies(data);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTrendingMovies();
    }, [language]);

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
                <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">Trending Movies of the Week</h1>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <LoadingCard count={12} />
                </div>
            </div>
        );
    }
    if (error) return <div className="text-center py-6 text-red-400">{`Error: ${error}`}</div>;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">Trending Movies of the Week</h1>
            
            <SortFilter
                onSortChange={setSortConfig}
                onFilterChange={setFilters}
                genres={genres}
                showDateFilter={true}
            />

            {
                movies.length === 0 ? (
                    <div className="text-center py-6 text-white">No trending movies available</div>
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
        </div >
    );
};

export default TrendingMoviesPage;
