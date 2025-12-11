"use client";
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LoadingSpinner from '../components/LoadingSpinner';
import LoadingCard from '../components/LoadingCard';
import ContentCard from '../components/ContentCard';

const UpcomingSeriesContent = () => {
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const searchParams = useSearchParams();
    const queryPage = searchParams.get('page');

    useEffect(() => {
        if (queryPage) {
            setPage(Number(queryPage));
        }
    }, [queryPage]);

    useEffect(() => {
        const fetchUpcomingSeries = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/upcoming/series?page=${page}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch upcoming series');
                }
                const data = await response.json();
                setSeries(data.results || []);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchUpcomingSeries();
    }, [page]);

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-6 text-amber-500">Upcoming Series</h1>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <LoadingCard count={12} />
                </div>
            </div>
        );
    }
    if (error) return <div className="text-center py-6 text-red-400">{`Error: ${error}`}</div>;

    // Filter to only show upcoming series (first_air_date in future)
    // API already filters, but we do it here as well for safety
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = series.filter(serie => {
        if (!serie.first_air_date) return false;
        const airDate = new Date(serie.first_air_date);
        airDate.setHours(0, 0, 0, 0);
        return airDate >= today;
    });

    // Group by air date week
    const groupedByWeek = upcoming.reduce((acc, serie) => {
        if (!serie.first_air_date) return acc;
        const airDate = new Date(serie.first_air_date);
        const weekStart = new Date(airDate);
        weekStart.setDate(airDate.getDate() - airDate.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!acc[weekKey]) {
            acc[weekKey] = {
                weekStart,
                series: []
            };
        }
        acc[weekKey].series.push(serie);
        return acc;
    }, {});

    const sortedWeeks = Object.keys(groupedByWeek).sort();

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-6 text-amber-500">Upcoming Series</h1>
            
            <div className="flex items-center justify-center my-6 gap-2">
                <button
                    onClick={() => setPage((prevPage) => Math.max(prevPage - 1, 1))}
                    className="futuristic-button disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={page === 1}
                >
                    Prev
                </button>
                <span className="bg-charcoal-800/80 border border-amber-500/50 text-amber-500 font-bold p-2 px-4 rounded-lg">{page}</span>
                <button
                    onClick={() => setPage((prevPage) => prevPage + 1)}
                    className="futuristic-button"
                >
                    Next
                </button>
            </div>

            {sortedWeeks.length === 0 ? (
                <div className="text-center py-6 text-white">No upcoming series available</div>
            ) : (
                <div className="space-y-8">
                    {sortedWeeks.map(weekKey => {
                        const week = groupedByWeek[weekKey];
                        const weekEnd = new Date(week.weekStart);
                        weekEnd.setDate(weekEnd.getDate() + 6);
                        
                        return (
                            <div key={weekKey}>
                                <h2 className="text-2xl font-bold mb-4 text-amber-500">
                                    Week of {week.weekStart.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })} - {weekEnd.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {week.series.map((serie) => (
                                        <ContentCard
                                            key={serie.id}
                                            item={serie}
                                            mediaType="tv"
                                            href={`/series/${serie.id}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const UpcomingSeriesPage = () => {
    return (
        <Suspense fallback={
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-6 text-amber-500">Upcoming Series</h1>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <LoadingCard count={12} />
                </div>
            </div>
        }>
            <UpcomingSeriesContent />
        </Suspense>
    );
};

export default UpcomingSeriesPage;

