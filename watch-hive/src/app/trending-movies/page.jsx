"use client";
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const TrendingMoviesPage = () => {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true); // Loading state
    const [error, setError] = useState(null); // Error state
    const searchParams = useSearchParams();
    const language = searchParams.get('language') || 'en-US'; // Default language

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
                setMovies(data);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTrendingMovies();
    }, [language]); // Fetch movies when language changes

    if (loading) return <div className="text-center py-6">Loading...</div>;
    if (error) return <div className="text-center py-6 text-red-600">{`Error: ${error}`}</div>;

    return (
        <div className="mx-auto px-4">
            <h1 className="text-2xl font-bold mb-6">Trending Movies of the Week</h1>

            {
                movies.length === 0 ? (
                    <div className="text-center py-6">No trending movies available</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {movies.map((movie) => (
                            <a href={`/movies/${movie.id}`} key={movie.id} className="block">
                                <div className="flex flex-col items-center">
                                    <img
                                        src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                                        alt={movie.title}
                                        className="object-cover rounded-lg w-full h-auto"
                                    />
                                    <h2 className="text-lg font-semibold mt-2 text-center w-full">
                                        {movie.title}
                                    </h2>
                                </div>
                            </a>
                        ))}
                    </div>
                )
            }
        </div >
    );
};

export default TrendingMoviesPage;
