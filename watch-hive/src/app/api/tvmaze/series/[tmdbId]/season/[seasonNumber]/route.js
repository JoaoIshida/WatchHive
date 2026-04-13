import { resolveTvmazeShowIdFromTmdb, tvmazeFetchUrl, TVMAZE_HEADERS } from '../../../../../../lib/tvmazeResolveShow';

/**
 * Proxies TVMaze schedule data for a season (airstamp, airdate) keyed by TMDB TV id.
 * Display timezone is chosen in the app from notification preferences.
 * @see https://www.tvmaze.com/api
 */
export async function GET(_req, { params }) {
    const { tmdbId, seasonNumber } = await params;
    const tmdb = String(tmdbId || '').trim();
    const seasonNum = parseInt(seasonNumber, 10);

    if (!tmdb || Number.isNaN(seasonNum)) {
        return Response.json({ error: 'tmdbId and numeric seasonNumber are required' }, { status: 400 });
    }

    const cache = { next: { revalidate: 1800 } };

    try {
        const mazeShowId = await resolveTvmazeShowIdFromTmdb(tmdb, cache);
        if (!mazeShowId) {
            return Response.json(
                { episodes: [], tvmazeMapped: false, mazeShowId: null },
                {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120',
                    },
                }
            );
        }

        const seasonsRes = await fetch(tvmazeFetchUrl(`/shows/${mazeShowId}/seasons`), {
            ...cache,
            headers: TVMAZE_HEADERS,
        });
        if (!seasonsRes.ok) {
            return Response.json(
                { episodes: [], tvmazeMapped: true, mazeShowId },
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const seasons = await seasonsRes.json();
        const seasonMeta = Array.isArray(seasons)
            ? seasons.find((s) => s.number === seasonNum)
            : null;

        if (!seasonMeta?.id) {
            return Response.json(
                { episodes: [], tvmazeMapped: true, mazeShowId },
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const epRes = await fetch(tvmazeFetchUrl(`/seasons/${seasonMeta.id}/episodes`), {
            ...cache,
            headers: TVMAZE_HEADERS,
        });
        if (!epRes.ok) {
            return Response.json(
                { episodes: [], tvmazeMapped: true, mazeShowId },
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const raw = await epRes.json();
        const episodes = (Array.isArray(raw) ? raw : []).map((e) => ({
            id: e.id != null ? Number(e.id) : null,
            number: e.number,
            name: e.name || null,
            airdate: e.airdate || null,
            airtime: e.airtime || null,
            airstamp: e.airstamp || null,
            runtime: e.runtime ?? null,
        }));

        return Response.json(
            { episodes, tvmazeMapped: true, mazeShowId },
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=120',
                },
            }
        );
    } catch (e) {
        console.error('TVMaze proxy error:', e);
        return Response.json({ error: 'Failed to load TVMaze data' }, { status: 500 });
    }
}
