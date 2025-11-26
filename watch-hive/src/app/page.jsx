"use client";
import { useState, useEffect, useRef } from 'react';
import QuickSearch from './components/QuickSearch';
import ContentCard from './components/ContentCard';
import LoadingCard from './components/LoadingCard';

// Icon Components
const FlameIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
    </svg>
);

const ClapperboardIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
    </svg>
);

const FilmIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h2v2H7V5zm4 0h2v2h-2V5zm-4 4h2v2H7V9zm4 0h2v2h-2V9zm-4 4h2v2H7v-2zm4 0h2v2h-2v-2z" clipRule="evenodd" />
    </svg>
);

const TvIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
    </svg>
);

const Home = () => {
    const [trendingMovies, setTrendingMovies] = useState([]);
    const [trendingSeries, setTrendingSeries] = useState([]);
    const [popularMovies, setPopularMovies] = useState([]);
    const [popularSeries, setPopularSeries] = useState([]);
    const [nowPlaying, setNowPlaying] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const sections = [
        { id: 'trending-movies', label: 'Trending Movies', icon: 'flame' },
        { id: 'trending-series', label: 'Trending Series', icon: 'flame' },
        { id: 'in-theaters', label: 'In Theaters', icon: 'clapperboard' },
        { id: 'popular-movies', label: 'Popular Movies', icon: 'film' },
        { id: 'popular-series', label: 'Popular Series', icon: 'tv' },
    ];

    const renderIcon = (iconType, className = "w-5 h-5") => {
        switch (iconType) {
            case 'flame':
                return <FlameIcon className={className} />;
            case 'clapperboard':
                return <ClapperboardIcon className={className} />;
            case 'film':
                return <FilmIcon className={className} />;
            case 'tv':
                return <TvIcon className={className} />;
            default:
                return null;
        }
    };

    useEffect(() => {
        const fetchHomeData = async () => {
            setLoading(true);
            try {
                // Fetch all data in parallel
                const [trendingMoviesRes, trendingSeriesRes, popularMoviesRes, popularSeriesRes, nowPlayingRes] = await Promise.all([
                    fetch('/api/trending/movies'),
                    fetch('/api/trending/series'),
                    fetch('/api/popularMovies?page=1'),
                    fetch('/api/popularSeries?page=1'),
                    fetch('/api/now-playing?page=1'),
                ]);

                if (trendingMoviesRes.ok) {
                    const data = await trendingMoviesRes.json();
                    setTrendingMovies(data.slice(0, 10));
                }
                if (trendingSeriesRes.ok) {
                    const data = await trendingSeriesRes.json();
                    setTrendingSeries(data.slice(0, 10));
                }
                if (popularMoviesRes.ok) {
                    const data = await popularMoviesRes.json();
                    setPopularMovies(data.results?.slice(0, 10) || []);
                }
                if (popularSeriesRes.ok) {
                    const data = await popularSeriesRes.json();
                    setPopularSeries(data.results?.slice(0, 10) || []);
                }
                if (nowPlayingRes.ok) {
                    const data = await nowPlayingRes.json();
                    setNowPlaying(data.results?.slice(0, 10) || []);
                }
            } catch (error) {
                console.error('Error fetching home data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHomeData();
    }, []);

    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            const offset = 100; // Offset for sticky nav
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    const ContentSection = ({ id, title, titleIcon, items, mediaType, href, loading: sectionLoading }) => {
        if (sectionLoading) {
            return (
                <div id={id} className="mb-12 scroll-mt-24">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl md:text-3xl font-bold text-futuristic-yellow-400 futuristic-text-glow-yellow flex items-center gap-2">
                            {titleIcon && <span className="text-futuristic-yellow-400">{renderIcon(titleIcon, "w-6 h-6 md:w-7 md:h-7")}</span>}
                            <span>{title}</span>
                        </h2>
                        {href && (
                            <a 
                                href={href}
                                className="text-futuristic-yellow-400 hover:text-futuristic-yellow-300 text-sm md:text-base transition-colors"
                            >
                                View all →
                            </a>
                        )}
                    </div>
                    <div className="overflow-x-auto pb-4 scrollbar-hide">
                        <div className="flex gap-4 min-w-max">
                            <LoadingCard count={6} />
                        </div>
                    </div>
                </div>
            );
        }

        if (items.length === 0) {
            return null;
        }

        return (
            <div id={id} className="mb-12 scroll-mt-24">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl md:text-3xl font-bold text-futuristic-yellow-400 futuristic-text-glow-yellow flex items-center gap-2">
                        {titleIcon && <span className="text-futuristic-yellow-400">{renderIcon(titleIcon, "w-6 h-6 md:w-7 md:h-7")}</span>}
                        <span>{title}</span>
                    </h2>
                    {href && (
                        <a 
                            href={href}
                            className="text-futuristic-yellow-400 hover:text-futuristic-yellow-300 text-sm md:text-base transition-colors"
                        >
                            View all →
                        </a>
                    )}
                </div>
                <div className="overflow-x-auto pb-4 scrollbar-hide">
                    <div className="flex gap-4 min-w-max">
                        {items.map((item) => (
                            <div key={item.id} className="flex-shrink-0 w-32 md:w-40 lg:w-48">
                                <ContentCard
                                    item={item}
                                    mediaType={mediaType}
                                    href={`/${mediaType === 'tv' ? 'series' : 'movies'}/${item.id}`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Hero Section with Search */}
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-6xl font-bold mb-4 text-futuristic-yellow-400 futuristic-text-glow-yellow">
                    Welcome to WatchHive
                </h1>
                <p className="text-xl md:text-2xl text-white mb-8">
                    Discover, Track, and Share Your Favorite Movies & Series
                </p>
                
                {/* Quick Search */}
                <div className="max-w-2xl mx-auto mb-8">
                    <QuickSearch />
                </div>
            </div>

            {/* Quick Navigation Menu */}
            <div className="sticky top-24 z-40 mb-8 pt-4">
                <div className="overflow-x-auto scrollbar-hide pb-2">
                    <div className="flex gap-2 min-w-max">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => scrollToSection(section.id)}
                                className="px-4 py-2 rounded-lg bg-futuristic-blue-800/90 hover:bg-futuristic-blue-700 text-white text-sm font-medium transition-all border border-futuristic-blue-500/50 hover:border-futuristic-yellow-500/70 whitespace-nowrap flex items-center gap-2 shadow-md"
                            >
                                <span className="text-futuristic-yellow-400">{renderIcon(section.icon, "w-4 h-4")}</span>
                                <span>{section.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Sections */}
            <div className="space-y-8">
                {/* Trending Movies */}
                <ContentSection
                    id="trending-movies"
                    title="Trending Movies"
                    titleIcon="flame"
                    items={trendingMovies}
                    mediaType="movie"
                    href="/trending-movies"
                    loading={loading}
                />

                {/* Trending Series */}
                <ContentSection
                    id="trending-series"
                    title="Trending Series"
                    titleIcon="flame"
                    items={trendingSeries}
                    mediaType="tv"
                    href="/trending-series"
                    loading={loading}
                />

                {/* Now Playing / In Theaters */}
                <ContentSection
                    id="in-theaters"
                    title="In Theaters"
                    titleIcon="clapperboard"
                    items={nowPlaying}
                    mediaType="movie"
                    href="/movies"
                    loading={loading}
                />

                {/* Popular Movies */}
                <ContentSection
                    id="popular-movies"
                    title="Popular Movies"
                    titleIcon="film"
                    items={popularMovies}
                    mediaType="movie"
                    href="/movies"
                    loading={loading}
                />

                {/* Popular Series */}
                <ContentSection
                    id="popular-series"
                    title="Popular Series"
                    titleIcon="tv"
                    items={popularSeries}
                    mediaType="tv"
                    href="/series"
                    loading={loading}
                />
            </div>
        </div>
    );
};

export default Home;
