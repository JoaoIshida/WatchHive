import { getGeminiSuggestions, GeminiApiError } from '../../utils/gemini';
import { enrichSuggestionsWithTMDB } from '../../utils/aiSearchEnrich';
import { getServerUser } from '../../lib/supabase-server';

const AI_SEARCH_TIMEOUT_MS = 30_000;

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT')), ms);
        }),
    ]);
}

export async function POST(req) {
    try {
        const user = await getServerUser();
        if (!user) {
            return jsonResponse({ error: 'Sign in to use AI Search.' }, 401);
        }

        const body = await req.json();
        const query = typeof body.query === 'string' ? body.query.trim() : '';
        const mediaType = body.mediaType === 'movie' || body.mediaType === 'tv' ? body.mediaType : 'both';
        const loadMore = body.loadMore === true;
        const excludeTitles = Array.isArray(body.excludeTitles)
            ? body.excludeTitles.filter((t) => typeof t === 'string' && t.trim()).slice(0, 40)
            : [];
        const excludeIds = Array.isArray(body.excludeIds)
            ? body.excludeIds.map(Number).filter((id) => id > 0).slice(0, 40)
            : [];
        const batchSize = loadMore ? 8 : 16;

        if (!query) {
            return jsonResponse({ error: 'Query is required' }, 400);
        }

        if (query.length > 200) {
            return jsonResponse({ error: 'Query is too long (max 200 characters)' }, 400);
        }

        if (!process.env.GEMINI_API_KEY) {
            return jsonResponse({ error: 'AI search is not configured' }, 503);
        }

        const { suggestions, results } = await withTimeout(
            (async () => {
                const nextSuggestions = await getGeminiSuggestions(query, mediaType, {
                    excludeTitles,
                    count: batchSize,
                });

                if (!nextSuggestions.length) {
                    return { suggestions: [], results: [] };
                }

                const nextResults = await enrichSuggestionsWithTMDB(nextSuggestions, { excludeIds });
                return { suggestions: nextSuggestions, results: nextResults };
            })(),
            AI_SEARCH_TIMEOUT_MS
        );

        if (!suggestions.length) {
            return jsonResponse({
                results: [],
                query,
                hasMore: false,
                message: loadMore
                    ? 'No more suggestions found.'
                    : 'No suggestions found. Try rephrasing your search.',
            });
        }

        return jsonResponse({
            results,
            query,
            hasMore: loadMore ? results.length > 0 : results.length >= Math.min(batchSize, 12),
        });
    } catch (error) {
        console.error('AI search error:', error);

        if (error.message === 'TIMEOUT') {
            return jsonResponse(
                { error: 'Search timed out after 30 seconds. Please try again.' },
                504
            );
        }

        if (error instanceof GeminiApiError) {
            if (error.status === 429) {
                const retryHint = error.retryAfterSeconds
                    ? ` Try again in about ${error.retryAfterSeconds} seconds.`
                    : ' Try again in a minute.';
                return jsonResponse(
                    {
                        error: `AI search rate limit reached.${retryHint} Free-tier Gemini quotas reset daily.`,
                    },
                    429
                );
            }

            if (error.status === 503) {
                return jsonResponse({ error: error.message }, 503);
            }
        }

        return jsonResponse({ error: 'Failed to process AI search' }, 500);
    }
}
