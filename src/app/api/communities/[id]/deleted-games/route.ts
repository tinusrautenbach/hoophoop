import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, users, communities, teams } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, desc, inArray, isNotNull, or } from 'drizzle-orm';

// GET /api/communities/[id]/deleted-games - List deleted games for a community
// Accessible by: community owner, community admin, or world admin
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: communityId } = await params;

    try {
        // Check permissions
        const currentUser = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        const community = await db.query.communities.findFirst({
            where: eq(communities.id, communityId),
            with: {
                members: true,
            }
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        // Check if user has permission (world admin, community owner, or community admin)
        const isWorldAdmin = currentUser?.isWorldAdmin;
        const isCommunityOwner = community.ownerId === userId;
        const isCommunityAdmin = community.members?.some(
            m => m.userId === userId && m.role === 'admin'
        );

        if (!isWorldAdmin && !isCommunityOwner && !isCommunityAdmin) {
            return NextResponse.json({ error: 'Forbidden - Community admin or owner required' }, { status: 403 });
        }

        // Get teams belonging to this community
        const communityTeams = await db.query.teams.findMany({
            where: eq(teams.communityId, communityId),
        });
        const communityTeamIds = communityTeams.map(t => t.id);

        // Fetch deleted games for this community (direct or via teams)
        let whereClause;
        if (communityTeamIds.length > 0) {
            whereClause = and(
                isNotNull(games.deletedAt),
                or(
                    eq(games.communityId, communityId),
                    inArray(games.homeTeamId, communityTeamIds),
                    inArray(games.guestTeamId, communityTeamIds)
                )
            );
        } else {
            whereClause = and(
                isNotNull(games.deletedAt),
                eq(games.communityId, communityId)
            );
        }

        const deletedGames = await db.query.games.findMany({
            where: whereClause,
            orderBy: [desc(games.deletedAt)],
            with: {
                rosters: true,
            }
        });

        // Get unique owner IDs to fetch their names
        const ownerIds = [...new Set(deletedGames.map(g => g.ownerId))];
        const owners = await db.query.users.findMany({
            where: inArray(users.id, ownerIds),
        });
        const ownerMap = new Map(owners.map(u => [u.id, { 
            firstName: u.firstName, 
            lastName: u.lastName,
            email: u.email 
        }]));

        // Enrich games with owner name
        const gamesWithOwner = deletedGames.map(game => {
            const owner = ownerMap.get(game.ownerId);
            const ownerName = owner?.firstName && owner?.lastName
                ? `${owner.firstName} ${owner.lastName}`
                : owner?.email || 'Unknown';
            
            return {
                ...game,
                ownerName,
            };
        });

        return NextResponse.json(gamesWithOwner);
    } catch (error) {
        console.error('Error fetching community deleted games:', error);
        return NextResponse.json({ error: 'Failed to fetch deleted games' }, { status: 500 });
    }
}
