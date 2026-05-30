const DEFAULT_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

export class GeminiApiError extends Error {
    constructor(message, status, retryAfterSeconds) {
        super(message);
        this.name = 'GeminiApiError';
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

function getModelCandidates() {
    const configured = process.env.GEMINI_MODEL?.trim();
    if (configured) {
        return [configured, ...DEFAULT_MODELS.filter((m) => m !== configured)];
    }
    return DEFAULT_MODELS;
}

function buildPrompt(query, mediaType, { excludeTitles = [], count = 8 } = {}) {
    const typeHint =
        mediaType === 'movie'
            ? 'Only suggest movies.'
            : mediaType === 'tv'
              ? 'Only suggest TV series.'
              : 'Suggest movies and/or TV series as appropriate.';

    const isLoadMore = excludeTitles.length > 0;

    const excludeBlock = isLoadMore
        ? `\nThe user already saw these titles — do NOT repeat any of them:\n${excludeTitles.map((t) => `- ${t}`).join('\n')}\n\nSuggest ${count} MORE different titles that still fit the query. Include deeper cuts, cult favorites, or international picks if needed.\n`
        : '';

    const countLabel = isLoadMore ? `${count} additional different` : 'up to 16';

    return `You are a film and TV recommendation assistant for WatchHive.

The user is searching in natural language for something to watch. ${typeHint}

User query: "${query}"
${excludeBlock}
Return ${countLabel} real, well-known titles that match what they want. Prefer widely available titles with accurate names and release years.

For each title, rate how well it matches the user's query:
- match_score: integer 1–100 (100 = perfect fit for everything they asked for)
- match_note: one very short phrase (max 12 words) on what matched or what is only partial, e.g. "Strong horror-comedy blend" or "Horror yes, comedy is subtle"

Respond with JSON only, no markdown, using this exact shape:
{
  "suggestions": [
    {
      "title": "Exact official title",
      "year": 2004,
      "media_type": "movie",
      "match_score": 92,
      "match_note": "Strong horror-comedy blend",
      "reason": "One short sentence explaining why it fits the query"
    }
  ]
}

Rules:
- media_type must be "movie" or "tv"
- year must be a number (release year)
- match_score must be an integer from 1 to 100
- Sort suggestions by match_score descending (best matches first)
- Use the most common English title
- Do not invent titles
${isLoadMore ? '- Every title must be different from the exclusion list above' : ''}`;
}

function extractJson(text) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1].trim() : trimmed;
    return JSON.parse(candidate);
}

function parseRetryAfterSeconds(errorBody) {
    try {
        const parsed = JSON.parse(errorBody);
        const retryInfo = parsed?.error?.details?.find(
            (d) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
        );
        if (retryInfo?.retryDelay) {
            const match = String(retryInfo.retryDelay).match(/([\d.]+)s/);
            if (match) return Math.ceil(Number(match[1]));
        }
        const message = parsed?.error?.message || '';
        const msgMatch = message.match(/retry in ([\d.]+)s/i);
        if (msgMatch) return Math.ceil(Number(msgMatch[1]));
    } catch {
        // ignore parse errors
    }
    return null;
}

async function callGeminiModel(apiKey, model, query, mediaType, options = {}) {
    const { excludeTitles = [], count = 8 } = options;
    const isLoadMore = excludeTitles.length > 0;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(query, mediaType, { excludeTitles, count }) }] }],
            generationConfig: {
                temperature: isLoadMore ? 0.85 : 0.7,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const retryAfterSeconds = response.status === 429 ? parseRetryAfterSeconds(errorBody) : null;
        throw new GeminiApiError(
            `Gemini API error (${model}): ${response.status}`,
            response.status,
            retryAfterSeconds
        );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new GeminiApiError(`Gemini returned an empty response (${model})`, 502);
    }

    const parsed = extractJson(text);
    const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

    return suggestions
        .filter((item) => item?.title && (item.media_type === 'movie' || item.media_type === 'tv'))
        .map((item) => ({
            ...item,
            match_score: Math.min(100, Math.max(1, Math.round(Number(item.match_score) || 70))),
        }))
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, count);
}

export async function getGeminiSuggestions(query, mediaType = 'both', options = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new GeminiApiError('GEMINI_API_KEY is not configured', 503);
    }

    const models = getModelCandidates();
    let lastRateLimitError = null;

    for (const model of models) {
        try {
            return await callGeminiModel(apiKey, model, query, mediaType, options);
        } catch (error) {
            if (error instanceof GeminiApiError && error.status === 429) {
                lastRateLimitError = error;
                continue;
            }
            throw error;
        }
    }

    if (lastRateLimitError) {
        throw lastRateLimitError;
    }

    throw new GeminiApiError('No Gemini models available', 503);
}
