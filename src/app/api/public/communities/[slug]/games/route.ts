import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, communities } from '@/db/schema';
import { eq, or, and, desc, lte, gte, SQL, isNull } from 'drizzle-orm';

// GET /api/public/communities/[slug]/games - Returns games for a specific community
// Query params:
//   - status: 'live' | 'final' | 'all' (default: 'all')
//   - search: search by team name
//   - dateFrom: filter games from this date (ISO format)
//   - dateTo: filter games to this date (ISO format)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'all';
        const search = searchParams.get('search');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');

        // Find community by slug
        const community = await db.query.communities.findFirst({
            where: eq(communities.slug, slug),
            columns: {
                id: true,
                name: true,
                slug: true,
                type: true,
            }
        });

        if (!community) {
            return NextResponse.json(
                { error: 'Community not found' },
                { status: 404 }
            );
        }

        // Build visibility conditions for this community
        // Both public_general AND public_community games are visible
        const visibilityConditions = or(
            eq(games.visibility, 'public_general'),
            eq(games.visibility, 'public_community')
        );

        // Must belong to this community
        const communityCondition = eq(games.communityId, community.id);

        // Build status condition
        let statusCondition = undefined;
        if (status === 'live') {
            statusCondition = eq(games.status, 'live');
        } else if (status === 'final') {
            statusCondition = eq(games.status, 'final');
        }

        // Build date conditions
        const dateConditions: SQL[] = [];
        if (dateFrom) {
            dateConditions.push(gte(games.scheduledDate, new Date(dateFrom)));
        }
        if (dateTo) {
            dateConditions.push(lte(games.scheduledDate, new Date(dateTo)));
        }

        // Combine all conditions - always exclude deleted games
        const whereConditions: (SQL | undefined)[] = [
            visibilityConditions, 
            communityCondition,
            isNull(games.deletedAt)
        ];
        if (statusCondition) whereConditions.push(statusCondition);
        if (dateConditions.length > 0) {
            whereConditions.push(and(...dateConditions));
        }

        // Fetch community games
        const communityGames = await db.query.games.findMany({
            where: and(...whereConditions),
            orderBy: [desc(games.createdAt)],
            with: {
                homeTeam: {
                    columns: {
                        id: true,
                        name: true,
                        shortCode: true,
                        color: true,
                    }
                },
                guestTeam: {
                    columns: {
                        id: true,
                        name: true,
                        shortCode: true,
                        color: true,
                    }
                },
            }
        });

        // Apply search filter if provided
        let filteredGames = communityGames;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredGames = communityGames.filter(game => 
                game.homeTeamName.toLowerCase().includes(searchLower) ||
                game.guestTeamName.toLowerCase().includes(searchLower) ||
                (game.homeTeam?.name?.toLowerCase().includes(searchLower)) ||
                (game.guestTeam?.name?.toLowerCase().includes(searchLower))
            );
        }

        return NextResponse.json({
            community,
            games: filteredGames,
            total: filteredGames.length,
        });
    } catch (error) {
        console.error('Error fetching community games:', error);
        return NextResponse.json(
            { error: 'Failed to fetch community games' },
            { status: 500 }
        );
    }
}
