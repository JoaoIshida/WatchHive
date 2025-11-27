/**
 * Determines the content type for a movie
 * @param {Object} movie - Movie object from TMDB
 * @returns {string} Content type: 'Movie', 'Documentary', 'Short', etc.
 */
export function getMovieType(movie) {
    if (!movie) return 'Movie';
    
    // Check if it's a documentary (genre ID 99 or genre name)
    const genres = movie.genres || movie.genre_ids || [];
    const isDocumentary = Array.isArray(genres) && (
        genres.some(genre => {
            if (typeof genre === 'number') {
                return genre === 99; // Documentary genre ID
            }
            return genre.id === 99 || genre.name?.toLowerCase() === 'documentary';
        })
    );
    
    // Check if it's a short film (runtime < 40 minutes or video field)
    const runtime = movie.runtime || 0;
    const isShort = runtime > 0 && runtime < 40;
    const isVideo = movie.video === true;
    
    if (isDocumentary) {
        return 'Documentary';
    }
    
    if (isShort || isVideo) {
        return 'Short';
    }
    
    return 'Movie';
}

/**
 * Determines the content type for a TV series
 * @param {Object} series - Series object from TMDB
 * @returns {string} Content type: 'Series', 'Miniseries', 'Documentary', etc.
 */
export function getSeriesType(series) {
    if (!series) return 'Series';
    
    // Check the type field from TMDB
    const type = series.type;
    if (type) {
        // Map TMDB types to our labels
        const typeMap = {
            'Scripted': 'Series',
            'Documentary': 'Documentary',
            'Reality': 'Reality',
            'Talk Show': 'Talk Show',
            'News': 'News',
            'Miniseries': 'Miniseries',
            'Variety': 'Variety',
            'Awards Show': 'Awards Show',
            'Sports': 'Sports',
            'Game Show': 'Game Show',
            'Panel Show': 'Panel Show',
            'Docuseries': 'Documentary',
        };
        
        if (typeMap[type]) {
            return typeMap[type];
        }
    }
    
    // Fallback: Check if it's a miniseries based on structure
    // Miniseries typically have 1 season with limited episodes (2-13)
    const seasons = series.number_of_seasons || 0;
    const episodes = series.number_of_episodes || 0;
    
    if (seasons === 1 && episodes > 0 && episodes <= 13) {
        return 'Miniseries';
    }
    
    // Check if it's a documentary series (genre ID 99)
    const genres = series.genres || series.genre_ids || [];
    const isDocumentary = Array.isArray(genres) && (
        genres.some(genre => {
            if (typeof genre === 'number') {
                return genre === 99; // Documentary genre ID
            }
            return genre.id === 99 || genre.name?.toLowerCase() === 'documentary';
        })
    );
    if (isDocumentary) {
        return 'Documentary';
    }
    
    return 'Series';
}

/**
 * Gets the content type for any media item
 * @param {Object} item - Movie or series object from TMDB
 * @param {string} mediaType - 'movie' or 'tv'
 * @returns {string} Content type label
 */
export function getContentType(item, mediaType = 'movie') {
    if (!item) return mediaType === 'tv' ? 'Series' : 'Movie';
    
    if (mediaType === 'tv' || item.media_type === 'tv') {
        return getSeriesType(item);
    } else {
        return getMovieType(item);
    }
}

