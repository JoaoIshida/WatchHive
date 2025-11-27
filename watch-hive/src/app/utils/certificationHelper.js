/**
 * Extract certification/rating from movie data
 * Movies: Uses release_dates (prefers Brazilian, falls back to US)
 * TV: Uses content_ratings (prefers Brazilian, falls back to US)
 */
export function getCertification(item, mediaType = 'movie') {
    if (!item) return null;
    
    if (mediaType === 'movie' || item.media_type === 'movie') {
        // For movies, check release_dates (prefer Brazilian certifications)
        if (item.release_dates && item.release_dates.results) {
            // Try Brazilian first
            const brRelease = item.release_dates.results.find(r => r.iso_3166_1 === 'BR');
            if (brRelease && brRelease.release_dates && brRelease.release_dates.length > 0) {
                const cert = brRelease.release_dates.find(rd => rd.certification);
                if (cert && cert.certification) {
                    return cert.certification;
                }
            }
            // Fallback to US
            const usRelease = item.release_dates.results.find(r => r.iso_3166_1 === 'US');
            if (usRelease && usRelease.release_dates && usRelease.release_dates.length > 0) {
                const cert = usRelease.release_dates.find(rd => rd.certification);
                if (cert && cert.certification) {
                    return cert.certification;
                }
            }
        }
        // Fallback: check if certification is directly on the item
        if (item.certification) {
            return item.certification;
        }
    } else {
        // For TV, check content_ratings (prefer Brazilian)
        if (item.content_ratings && item.content_ratings.results) {
            // Try Brazilian first
            const brRating = item.content_ratings.results.find(r => r.iso_3166_1 === 'BR');
            if (brRating && brRating.rating) {
                return brRating.rating;
            }
            // Fallback to US
            const usRating = item.content_ratings.results.find(r => r.iso_3166_1 === 'US');
            if (usRating && usRating.rating) {
                return usRating.rating;
            }
        }
        // Fallback: check if rating is directly on the item
        if (item.certification || item.rating) {
            return item.certification || item.rating;
        }
    }
    
    return null;
}

