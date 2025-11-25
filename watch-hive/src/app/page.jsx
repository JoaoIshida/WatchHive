"use client";
import QuickSearch from './components/QuickSearch';

const Home = () => {
    return (
        <div className="container mx-auto px-4 py-16">
            <div className="text-center mb-12">
                <h1 className="text-6xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">
                    Welcome to WatchHive
                </h1>
                <p className="text-2xl text-white mb-8">
                    Discover, Track, and Share Your Favorite Movies & Series
                </p>
                
                {/* Quick Search */}
                <div className="max-w-2xl mx-auto mb-8">
                    <QuickSearch />
                </div>

                <div className="flex gap-4 justify-center">
                    <a href="/movies" className="futuristic-button-yellow text-lg px-8 py-4">
                        Explore Movies
                    </a>
                    <a href="/series" className="futuristic-button text-lg px-8 py-4">
                        Explore Series
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Home;