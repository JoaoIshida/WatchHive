"use client";
import { useEffect, useRef } from 'react';

const TrailerPlayer = ({ trailerKey, title }) => {
    const iframeRef = useRef(null);
    const playerRef = useRef(null);

    useEffect(() => {
        if (!trailerKey) return;

        // Load YouTube IFrame API
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }

        const initPlayer = () => {
            if (iframeRef.current && !playerRef.current) {
                playerRef.current = new window.YT.Player(iframeRef.current, {
                    videoId: trailerKey,
                    playerVars: {
                        autoplay: 1,
                        mute: 1,
                        controls: 1,
                        modestbranding: 1,
                        rel: 0,
                        loop: 1,
                        playlist: trailerKey, // Required for looping to work
                    },
                });
            }
        };

        window.onYouTubeIframeAPIReady = initPlayer;

        // If API is already loaded
        if (window.YT && window.YT.Player) {
            initPlayer();
        }

        return () => {
            if (playerRef.current) {
                try {
                    playerRef.current.destroy();
                } catch (e) {
                    // Ignore destroy errors
                }
            }
        };
    }, [trailerKey]);

    // If no trailer, show message and search button
    if (!trailerKey) {
        const searchQuery = encodeURIComponent(title || '');
        const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;

    return (
            <div className="relative w-full futuristic-card overflow-hidden rounded-lg" style={{ paddingBottom: '56.25%' }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-futuristic-blue-900/80 p-6">
                    <p className="text-white text-lg font-semibold mb-4 text-center">No trailer available</p>
                    <a
                        href={youtubeSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="futuristic-button-yellow flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                        <span>Look for Trailer</span>
                    </a>
                        </div>
                    </div>
        );
    }

    return (
        <div className="relative w-full futuristic-card overflow-hidden rounded-lg" style={{ paddingBottom: '56.25%' }}>
            <div className="absolute top-0 left-0 w-full h-full pointer-events-auto">
                <div id={`youtube-player-${trailerKey}`} ref={iframeRef} className="w-full h-full"></div>
                </div>
        </div>
    );
};

export default TrailerPlayer;

