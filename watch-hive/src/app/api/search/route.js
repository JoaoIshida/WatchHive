import { fetchTMDB } from '../utils';
import {
    normalizeSearchQueryInput,
    tmdbItemTitleMatchesSubstring,
} from '../../utils/searchQueryNormalize';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const query = searchParams.get('query');
    const language = searchParams.get('language') || 'en-CA';

    if (!query || !query.trim()) {
        return new Response(JSON.stringify({ error: 'Query parameter is required' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    try {
        const workingQuery = normalizeSearchQueryInput(query);

        if (!workingQuery.trim()) {
            return new Response(JSON.stringify({ error: 'Query parameter is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const tmdbQuery = workingQuery.trim();

        const maxPages = 5;
        const firstPage = await fetchTMDB('/search/multi', {
            query: tmdbQuery,
            include_adult: false,
            language: language,
            page: 1,
        });

        const totalPages = Math.min(firstPage.total_pages || 1, maxPages);
        const pagePromises = [];
        for (let p = 2; p <= totalPages; p++) {
            pagePromises.push(
                fetchTMDB('/search/multi', {
                    query: tmdbQuery,
                    include_adult: false,
                    language: language,
                    page: p,
                }),
            );
        }
        const extraPages = await Promise.all(pagePromises);
        const merged = [firstPage, ...extraPages].flatMap((d) => d.results || []);

        const seen = new Set();
        const uniqueResults = merged.filter((item) => {
            const key = `${item.media_type}-${item.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const filteredResults = uniqueResults.filter(
            (item) => item.media_type === 'movie' || item.media_type === 'tv',
        );

        const normalizedQuery = workingQuery.toLowerCase();
        const strictResults = filteredResults.filter((item) =>
            tmdbItemTitleMatchesSubstring(item, normalizedQuery),
        );

        return new Response(JSON.stringify(strictResults), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching search results:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch search results' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
