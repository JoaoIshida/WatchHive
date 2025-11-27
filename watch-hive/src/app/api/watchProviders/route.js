import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const mediaType = searchParams.get('mediaType') || 'movie';
        
        const url = `https://api.themoviedb.org/3/watch/providers/${mediaType}?watch_region=CA&language=en-US`;
        
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
            },
        });

        if (!res.ok) {
            throw new Error('Failed to fetch watch providers');
        }

        const data = await res.json();
        
        // Filter to only include providers with logos and sort by display_priority
        const providers = (data.results || [])
            .filter(provider => provider.logo_path)
            .sort((a, b) => (a.display_priority || 999) - (b.display_priority || 999));

        return NextResponse.json({ providers });
    } catch (error) {
        console.error('Error fetching watch providers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch watch providers' },
            { status: 500 }
        );
    }
}

