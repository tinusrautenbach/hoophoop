import { NextResponse } from 'next/server';
import { db } from '@/db';
import { communities, games, users } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, or, desc, inArray, isNull } from 'drizzle-orm';

// GET - Get single community details
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const community = await db.query.communities.findFirst({
            where: eq(communities.id, id),
            with: {
                members: true,
                teams: true,
            }
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        // Check access rights
        const isOwner = community.ownerId === userId;
        const isMember = community.members.some(m => m.userId === userId);

        if (!isOwner && !isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch games associated with this community (direct or via teams), excluding deleted games
        const communityGames = await db.query.games.findMany({
            where: and(
                eq(games.communityId, id),
                isNull(games.deletedAt)
            ),
            orderBy: [desc(games.createdAt)],
            limit: 10,
        });

        // Get team IDs that belong to this community
        const communityTeamIds = community.teams?.map((t: { id: string }) => t.id) || [];

        // Fetch games where home or guest team belongs to community, excluding deleted games
        let teamGames: typeof communityGames = [];
        if (communityTeamIds.length > 0) {
            teamGames = await db.query.games.findMany({
                where: and(
                    or(
                        inArray(games.homeTeamId, communityTeamIds),
                        inArray(games.guestTeamId, communityTeamIds)
                    ),
                    isNull(games.deletedAt)
                ),
                orderBy: [desc(games.createdAt)],
                limit: 10,
            });
        }

        // Merge and deduplicate games
        const allGames = [...communityGames, ...teamGames];
        const uniqueGames = Array.from(new Map(allGames.map(g => [g.id, g])).values());
        uniqueGames.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const finalGames = uniqueGames.slice(0, 10);

        // Get unique member user IDs to fetch their details
        const memberUserIds = [...new Set(community.members.map((m: any) => m.userId))];
        const memberUsers = await db.query.users.findMany({
            where: inArray(users.id, memberUserIds),
        });
        const memberUserMap = new Map(memberUsers.map(u => [u.id, { 
            firstName: u.firstName, 
            lastName: u.lastName,
            email: u.email 
        }]));

        // Enrich members with user details
        const membersWithUserDetails = community.members.map((member: any) => {
            const user = memberUserMap.get(member.userId);
            const displayName = user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email || member.userId;
            
            return {
                ...member,
                userEmail: user?.email || null,
                userFirstName: user?.firstName || null,
                userLastName: user?.lastName || null,
                displayName,
            };
        });

        return NextResponse.json({
            ...community,
            members: membersWithUserDetails,
            games: finalGames,
        });
    } catch (error) {
        console.error('Error fetching community:', error);
        return NextResponse.json({ error: 'Failed to fetch community' }, { status: 500 });
    }
}

// PATCH - Update community details
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    try {
        const community = await db.query.communities.findFirst({
            where: eq(communities.id, id),
            with: {
                members: true
            }
        });

        if (!community) {
            return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        }

        // Only admins can update
        const isOwner = community.ownerId === userId;
        const memberRecord = community.members.find(m => m.userId === userId);
        const isAdmin = memberRecord?.role === 'admin';

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { name, type } = body;
        
        await db.update(communities)
            .set({ name, type })
            .where(eq(communities.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating community:', error);
        return NextResponse.json({ error: 'Failed to update community' }, { status: 500 });
    }
}
