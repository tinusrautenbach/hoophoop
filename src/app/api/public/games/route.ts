import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games } from '@/db/schema';
import { eq, or, desc, and, gte, lte, SQL, isNull } from 'drizzle-orm';

// GET /api/public/games - Returns live + historical public games
// Query params:
//   - status: 'live' | 'final' | 'all' (default: 'all')
//   - communityId: filter by specific community
//   - search: search by team name
//   - dateFrom: filter games from this date (ISO format)
//   - dateTo: filter games to this date (ISO format)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'all';
        const communityId = searchParams.get('communityId');
        const search = searchParams.get('search');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');

        // Build visibility conditions - public_general OR public_community
        const visibilityConditions = or(
            eq(games.visibility, 'public_general'),
            eq(games.visibility, 'public_community')
        );

        // Build status condition
        let statusCondition = undefined;
        if (status === 'live') {
            statusCondition = eq(games.status, 'live');
        } else if (status === 'final') {
            statusCondition = eq(games.status, 'final');
        }

        // Build community condition
        const communityCondition = communityId 
            ? eq(games.communityId, communityId) 
            : undefined;

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
            isNull(games.deletedAt)
        ];
        if (statusCondition) whereConditions.push(statusCondition);
        if (communityCondition) whereConditions.push(communityCondition);
        if (dateConditions.length > 0) {
            whereConditions.push(and(...dateConditions));
        }

        // Fetch public games
        const publicGames = await db.query.games.findMany({
            where: and(...whereConditions),
            orderBy: [desc(games.createdAt)],
            with: {
                community: {
                    columns: {
                        id: true,
                        name: true,
                        slug: true,
                    }
                },
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

        // Apply search filter if provided (client-side filtering for team names)
        let filteredGames = publicGames;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredGames = publicGames.filter(game => 
                game.homeTeamName.toLowerCase().includes(searchLower) ||
                game.guestTeamName.toLowerCase().includes(searchLower) ||
                (game.homeTeam?.name?.toLowerCase().includes(searchLower)) ||
                (game.guestTeam?.name?.toLowerCase().includes(searchLower))
            );
        }

        // Group games by community
        interface CommunityGroup {
            community: {
                name: string;
                slug: string;
                id: string | undefined;
            };
            games: typeof filteredGames;
        }
        
        const groupedGames = filteredGames.reduce<Record<string, CommunityGroup>>((acc, game) => {
            const communityName = game.community?.name || 'Independent';
            const communitySlug = game.community?.slug || 'independent';
            
            if (!acc[communityName]) {
                acc[communityName] = {
                    community: {
                        name: communityName,
                        slug: communitySlug,
                        id: game.community?.id,
                    },
                    games: []
                };
            }
            
            acc[communityName].games.push(game);
            return acc;
        }, {});

        return NextResponse.json({
            games: filteredGames,
            groupedByCommunity: Object.values(groupedGames),
            total: filteredGames.length,
        });
    } catch (error) {
        console.error('Error fetching public games:', error);
        return NextResponse.json(
            { error: 'Failed to fetch public games' }, 
            { status: 500 }
        );
    }
}
