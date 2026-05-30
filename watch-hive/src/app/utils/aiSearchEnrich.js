import { fetchTMDB } from '../api/utils';

function pickBestMatch(results, { title, year, mediaType }) {
    if (!results?.length) return null;

    const normalizedTitle = title.toLowerCase().trim();

    const scored = results.map((item) => {
        const itemTitle = (item.title || item.name || '').toLowerCase().trim();
        const itemYear = (item.release_date || item.first_air_date || '').slice(0, 4);
        let score = 0;

        if (itemTitle === normalizedTitle) score += 10;
        else if (itemTitle.includes(normalizedTitle) || normalizedTitle.includes(itemTitle)) score += 5;

        if (year && itemYear === String(year)) score += 8;
        else if (year && itemYear && Math.abs(Number(itemYear) - Number(year)) <= 1) score += 3;

        return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0 ? scored[0].item : results[0];
}

async function searchTMDBForSuggestion(suggestion) {
    const endpoint = suggestion.media_type === 'tv' ? '/search/tv' : '/search/movie';
    const data = await fetchTMDB(endpoint, {
        query: suggestion.title,
        include_adult: false,
        language: 'en-US',
        page: 1,
    });

    const match = pickBestMatch(data.results || [], {
        title: suggestion.title,
        year: suggestion.year,
        mediaType: suggestion.media_type,
    });

    if (!match) return null;

    return {
        id: match.id,
        title: match.title || match.name,
        overview: match.overview,
        poster_path: match.poster_path,
        backdrop_path: match.backdrop_path,
        release_date: match.release_date || match.first_air_date,
        vote_average: match.vote_average,
        media_type: suggestion.media_type,
        reason: suggestion.reason,
        match_score: suggestion.match_score,
        match_note: suggestion.match_note,
        gemini_title: suggestion.title,
        gemini_year: suggestion.year,
    };
}

export async function enrichSuggestionsWithTMDB(suggestions, { excludeIds = [] } = {}) {
    const excludeSet = new Set(excludeIds.map((id) => Number(id)));

    const results = await Promise.all(
        suggestions.map((suggestion) =>
            searchTMDBForSuggestion(suggestion).catch((err) => {
                console.error('TMDB enrich failed for', suggestion.title, err.message);
                return null;
            })
        )
    );

    const seen = new Set();
    return results.filter((item) => {
        if (!item?.id) return false;
        if (excludeSet.has(item.id)) return false;
        const key = `${item.media_type}-${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
