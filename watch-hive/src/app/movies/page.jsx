"use client";
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const PopularMoviesPage = () => {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1); // Add page state
    const searchParams = useSearchParams();
    const queryPage = searchParams.get('page');

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
                setMovies(data.results);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPopularMovies();
    }, [page]);

    if (loading) return <div className="text-center py-6">Loading...</div>;
    if (error) return <div className="text-center py-6 text-red-600">{`Error: ${error}`}</div>;

    return (
        <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold mb-6">Popular Movies</h1>
            <div className="flex items-center justify-center my-6">
                <button
                    onClick={() => setPage((prevPage) => Math.max(prevPage - 1, 1))}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-l"
                    disabled={page === 1}
                >
                    Prev
                </button>
                <span className="bg-gray-300 p-2">{page}</span>
                <button
                    onClick={() => setPage((prevPage) => prevPage + 1)}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-r"
                >
                    Next
                </button>
            </div>
            {
                movies.length === 0 ? (
                    <div className="text-center py-6">No popular movies available</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {movies.map((movie) => (
                            <a href={`/movies/${movie.id}`} key={movie.id} className="block">
                                <div className="flex flex-col items-center hover:opacity-90 hover:scale-105">
                                    <img
                                        src={`https://image.tmdb.org/t/p/w500${movie.backdrop_path}`}
                                        alt={movie.title}
                                        className="object-cover rounded-lg w-full h-32"
                                    />
                                    <h2 className="text-lg font-semibold">{movie.title}</h2>
                                    <p >{movie.release_date}</p>
                                    <p >{movie.vote_average} / 10</p>
                                </div>
                            </a>
                        ))}
                    </div>
                )
            }
            <div className="flex items-center justify-center my-6">
                <button
                    onClick={() => setPage((prevPage) => Math.max(prevPage - 1, 1))}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-l"
                    disabled={page === 1}
                >
                    Prev
                </button>
                <span className="bg-gray-300 p-2">{page}</span>
                <button
                    onClick={() => setPage((prevPage) => prevPage + 1)}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-r"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default PopularMoviesPage;
