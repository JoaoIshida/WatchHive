// This route will be used when Supabase is integrated
// For now, it returns mock data structure

export async function GET(req) {
    // In the future, this will fetch from Supabase
    // For now, return structure that matches what we'll need
    return new Response(JSON.stringify({
        watchedCount: 0,
        wishlistCount: 0,
        seriesInProgress: 0,
        completedSeries: 0,
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

