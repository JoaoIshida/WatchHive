"use client";
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';

const MovieDetailPage = ({ movieId }) => {
    const [movie, setMovie] = useState(null);
    const [error, setError] = useState(null);
    const { movieID } = useParams();

    useEffect(() => {
        const fetchMovieDetails = async () => {
            try {
                const response = await axios.get(`https://api.themoviedb.org/3/movie/{movieId}`, {
                    params: {
                        language: 'en-US',
                    },
                    headers: {
                        accept: 'application/json',
                        Authorization: `Bearer ${process.env.AUTH_TOKEN}`, // Use environment variable for API key
                    },
                });

                setMovie(response.data);
            } catch (error) {
                console.error('Error fetching movie details:', error);
                setError('Failed to fetch movie details');
            }
        };

        fetchMovieDetails();
    }, [movieId]);

    if (error) return <div>{error}</div>;
    if (!movie) return <div>Loading...</div>;

    return (
        <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold mb-4">{movie.title}</h1>
            <div className="flex flex-col md:flex-row gap-6">
                <img
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="w-full md:w-1/3 rounded-lg"
                />
                <div className="md:w-2/3">
                    <p className="text-lg font-semibold mb-2">Overview:</p>
                    <p className="mb-4">{movie.overview}</p>
                    <p className="font-semibold">Release Date:</p>
                    <p>{movie.release_date}</p>
                    <p className="font-semibold">Rating:</p>
                    <p>{movie.vote_average} / 10</p>
                    <p className="font-semibold">Genres:</p>
                    <ul>
                        {movie.genres.map((genre) => (
                            <li key={genre.id}>{genre.name}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default MovieDetailPage;
