import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, communityMembers, communities, games } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, isNull } from 'drizzle-orm';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: teamId } = await params;

    try {
        const team = await db.query.teams.findFirst({
            where: eq(teams.id, teamId),
            with: {
                community: true,
                homeGames: { 
                    where: isNull(games.deletedAt),
                    orderBy: (games, { desc }) => [desc(games.createdAt)], 
                    limit: 20 
                },
                guestGames: { 
                    where: isNull(games.deletedAt),
                    orderBy: (games, { desc }) => [desc(games.createdAt)], 
                    limit: 20 
                },
                teamSeasons: {
                    with: {
                        season: true,
                    },
                },
            },
        });

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        return NextResponse.json(team);
    } catch (error) {
        console.error('Error fetching team:', error);
        return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: teamId } = await params;

    try {
        const team = await db.query.teams.findFirst({
            where: eq(teams.id, teamId),
        });

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        const body = await request.json();
        const { name, shortCode, color, communityId } = body;

        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (shortCode !== undefined) updates.shortCode = shortCode;
        if (color !== undefined) updates.color = color;

        if (communityId !== undefined) {
            if (communityId === null) {
                updates.communityId = null;
            } else {
                const community = await db.query.communities.findFirst({
                    where: eq(communities.id, communityId),
                });

                if (!community) {
                    return NextResponse.json({ error: 'Community not found' }, { status: 404 });
                }

                const membership = await db.query.communityMembers.findFirst({
                    where: and(
                        eq(communityMembers.communityId, communityId),
                        eq(communityMembers.userId, userId),
                        eq(communityMembers.role, 'admin')
                    ),
                });

                if (!membership) {
                    return NextResponse.json({ error: 'You must be a community admin to assign teams' }, { status: 403 });
                }

                updates.communityId = communityId;
            }
        }

        const [updatedTeam] = await db.update(teams)
            .set(updates)
            .where(eq(teams.id, teamId))
            .returning();

        return NextResponse.json(updatedTeam);
    } catch (error) {
        console.error('Error updating team:', error);
        return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    }
}
