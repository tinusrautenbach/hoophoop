import { NextResponse } from 'next/server';
import { db } from '@/db';
import { communities, seasons } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    try {
        const community = await db.query.communities.findFirst({
            where: eq(communities.slug, slug),
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        const communitySeasons = await db.query.seasons.findMany({
            where: eq(seasons.communityId, community.id),
            orderBy: [desc(seasons.startDate)],
        });

        return NextResponse.json({
            community,
            seasons: communitySeasons,
        });
    } catch (error) {
        console.error('Error fetching public community seasons:', error);
        return NextResponse.json({ error: 'Failed to fetch community seasons' }, { status: 500 });
    }
}
