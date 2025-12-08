import { fetchTMDB } from '../../utils';

/**
 * GET /api/tv/[id]
 * Get TV series details with properly filtered seasons
 * Filters seasons by season_number (excludes invalid seasons)
 */
export async function GET(req, { params }) {
    const { id } = await params;

    if (!id) {
        return new Response(JSON.stringify({ error: 'Series ID is required' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    try {
        const data = await fetchTMDB(`/tv/${id}`, {
            language: 'en-CA',
            append_to_response: 'content_ratings',
        });

        // Filter seasons by season_number
        // According to TMDB: season_number >= 0 (0 is for specials, 1+ are regular seasons)
        if (data.seasons && Array.isArray(data.seasons)) {
            data.seasons = data.seasons.filter(season => {
                // Filter out seasons without season_number or with invalid season_number
                return season.season_number !== null && 
                       season.season_number !== undefined && 
                       typeof season.season_number === 'number' &&
                       season.season_number >= 0;
            });
            
            // Sort seasons by season_number
            data.seasons.sort((a, b) => a.season_number - b.season_number);
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching TV series details:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch TV series details' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
