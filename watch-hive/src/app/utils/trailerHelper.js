/**
 * Get the best available trailer/video from TMDB videos results
 * Priority: Official Trailer > Trailer > Teaser > Clip > Behind the Scenes > Featurette > Any video
 */
export function getBestTrailer(videos) {
    if (!videos || !videos.results || videos.results.length === 0) {
        return null;
    }

    const videoResults = videos.results.filter(v => v.site === 'YouTube' && v.key);

    if (videoResults.length === 0) {
        return null;
    }

    // Priority order for video types
    const typePriority = {
        'Trailer': 1,
        'Teaser': 2,
        'Clip': 3,
        'Behind the Scenes': 4,
        'Featurette': 5,
        'Bloopers': 6,
        'Opening Credits': 7,
    };

    // First, try to find official trailer
    let bestVideo = videoResults.find(
        v => v.type === 'Trailer' && 
        (v.name.toLowerCase().includes('official') || v.official === true)
    );

    if (bestVideo) {
        return bestVideo;
    }

    // Then try any trailer
    bestVideo = videoResults.find(v => v.type === 'Trailer');
    if (bestVideo) {
        return bestVideo;
    }

    // Then try other video types in priority order
    for (const [type, priority] of Object.entries(typePriority)) {
        if (type === 'Trailer') continue; // Already checked
        bestVideo = videoResults.find(v => v.type === type);
        if (bestVideo) {
            return bestVideo;
        }
    }

    // Fallback: return first available YouTube video
    return videoResults[0] || null;
}

