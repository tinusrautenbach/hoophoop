import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, communityMembers } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    const { id: communityId } = await params;

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const membership = await db.query.communityMembers.findFirst({
            where: and(
                eq(communityMembers.communityId, communityId),
                eq(communityMembers.userId, userId)
            ),
        });

        if (!membership) {
            return NextResponse.json({ error: 'Not a community member' }, { status: 403 });
        }

        const communityTeams = await db.query.teams.findMany({
            where: eq(teams.communityId, communityId),
            orderBy: (teams, { desc }) => [desc(teams.createdAt)],
        });

        return NextResponse.json(communityTeams);
    } catch (error) {
        console.error('Error fetching community teams:', error);
        return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    const { id: communityId } = await params;

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const membership = await db.query.communityMembers.findFirst({
            where: and(
                eq(communityMembers.communityId, communityId),
                eq(communityMembers.userId, userId)
            ),
        });

        if (!membership) {
            return NextResponse.json({ error: 'Not a community member' }, { status: 403 });
        }

        if (membership.role !== 'admin' && !membership.canManageGames) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        const body = await request.json();
        const { name, shortCode, color } = body;

        if (!name) {
            return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
        }

        const [newTeam] = await db.insert(teams).values({
            ownerId: userId,
            communityId,
            name,
            shortCode,
            color,
        }).returning();

        return NextResponse.json(newTeam);
    } catch (error) {
        console.error('Error creating team:', error);
        return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
    }
}
