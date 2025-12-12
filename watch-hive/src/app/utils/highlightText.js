/**
 * Highlights matching text in a string based on a search query
 * @param {string} text - The text to search in
 * @param {string} query - The search query to highlight
 * @returns {Array} Array of React elements with highlighted portions
 */
export const highlightText = (text, query) => {
    if (!query || !text) {
        return text;
    }

    // Escape special regex characters in the query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Split query into individual words for better matching
    const queryWords = escapedQuery.trim().split(/\s+/).filter(word => word.length > 0);
    
    if (queryWords.length === 0) {
        return text;
    }

    // Create a regex pattern that matches any of the query words (case-insensitive)
    const pattern = new RegExp(`(${queryWords.join('|')})`, 'gi');
    
    // Split text by matches while preserving the matches
    const parts = text.split(pattern);
    
    // Map parts to JSX elements
    return parts.map((part, index) => {
        // Check if this part matches any query word (case-insensitive)
        const isMatch = queryWords.some(word => {
            const wordPattern = new RegExp(`^${word}$`, 'i');
            return wordPattern.test(part);
        });
        
        if (isMatch && part.length > 0) {
            return (
                <mark 
                    key={index} 
                    className="bg-amber-500/30 text-amber-300 font-semibold px-0.5 rounded"
                >
                    {part}
                </mark>
            );
        }
        return <span key={index}>{part}</span>;
    });
};

/**
 * Highlights matching text and returns as a single JSX element
 * @param {string} text - The text to search in
 * @param {string} query - The search query to highlight
 * @returns {JSX.Element} React element with highlighted portions
 */
export const HighlightedText = ({ text, query, className = '' }) => {
    if (!query || !text) {
        return <span className={className}>{text}</span>;
    }
    
    const highlighted = highlightText(text, query);
    
    return <span className={className}>{highlighted}</span>;
};

