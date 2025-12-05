import { fetchTMDB } from '../api/utils';

/**
 * Extract base title from a title (e.g., "Zootopia 2" -> "Zootopia")
 */
function extractBaseTitle(title) {
    if (!title) return '';
    
    // Remove common suffixes/sequels
    const cleaned = title
        .replace(/\s+(2|3|4|5|II|III|IV|V|Part\s+\d+|Chapter\s+\d+)$/i, '')
        .replace(/\s*:\s*.*$/, '') // Remove subtitle after colon
        .trim();
    
    return cleaned;
}

/**
 * Calculate similarity between two titles
 */
function calculateSimilarity(title1, title2) {
    if (!title1 || !title2) return 0;
    
    const t1 = title1.toLowerCase().trim();
    const t2 = title2.toLowerCase().trim();
    
    // Exact match
    if (t1 === t2) return 1.0;
    
    // One contains the other
    if (t1.includes(t2) || t2.includes(t1)) return 0.8;
    
    // Base title match
    const base1 = extractBaseTitle(t1);
    const base2 = extractBaseTitle(t2);
    if (base1 && base2 && (base1 === base2 || base1.includes(base2) || base2.includes(base1))) {
        return 0.7;
    }
    
    // Word overlap
    const words1 = t1.split(/\s+/);
    const words2 = t2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w) && w.length > 2);
    if (commonWords.length > 0) {
        return 0.5 + (commonWords.length / Math.max(words1.length, words2.length)) * 0.2;
    }
    
    return 0;
}

/**
 * Find similar titles by searching TMDB
 */
export async function findSimilarTitles(title, mediaType = 'both', limit = 10) {
    if (!title) return [];
    
    try {
        const baseTitle = extractBaseTitle(title);
        const searchQueries = [title, baseTitle].filter(Boolean);
        
        const allResults = [];
        const seenIds = new Set();
        
        // Search for each query
        for (const query of searchQueries) {
            try {
                const searchType = mediaType === 'movie' ? 'movie' : 
                                  mediaType === 'tv' ? 'tv' : 
                                  'multi';
                
                const searchData = await fetchTMDB(`/search/${searchType}`, {
                    query: query,
                    language: 'en-CA',
                    page: 1,
                });
                
                if (searchData?.results) {
                    searchData.results.forEach(item => {
                        const itemTitle = item.title || item.name;
                        if (itemTitle && !seenIds.has(item.id)) {
                            const similarity = calculateSimilarity(title, itemTitle);
                            if (similarity > 0.3) { // Only include if similarity > 30%
                                seenIds.add(item.id);
                                allResults.push({
                                    ...item,
                                    media_type: item.media_type || (mediaType === 'movie' ? 'movie' : 'tv'),
                                    similarity: similarity,
                                });
                            }
                        }
                    });
                }
            } catch (error) {
                console.error(`Error searching for "${query}":`, error);
            }
        }
        
        // Sort by similarity score, then by popularity
        allResults.sort((a, b) => {
            if (b.similarity !== a.similarity) {
                return b.similarity - a.similarity;
            }
            return (b.popularity || 0) - (a.popularity || 0);
        });
        
        // Remove the original title if it's in results
        const filtered = allResults.filter(item => {
            const itemTitle = (item.title || item.name || '').toLowerCase();
            const originalTitle = title.toLowerCase();
            return itemTitle !== originalTitle;
        });
        
        return filtered.slice(0, limit);
    } catch (error) {
        console.error('Error finding similar titles:', error);
        return [];
    }
}

