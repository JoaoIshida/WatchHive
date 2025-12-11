const Footer = () => {
    return (
        <footer className="bg-charcoal-950/90 backdrop-blur-md border-t border-charcoal-700 mt-auto">
            <div className="container mx-auto px-4 py-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-white text-sm">
                        © 2025 WatchHive. All rights reserved.
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-white text-sm">Powered by</span>
                        <a
                            href="https://www.themoviedb.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                            <img
                                src="/tmdb-logo.png"
                                alt="TMDB Logo"
                                className="h-6 w-auto"
                            />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

