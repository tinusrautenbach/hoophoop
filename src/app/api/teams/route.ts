import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq } from 'drizzle-orm';

export async function GET() {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userTeams = await db.query.teams.findMany({
            where: eq(teams.ownerId, userId),
            orderBy: (teams, { desc }) => [desc(teams.createdAt)],
            columns: {
                id: true,
                ownerId: true,
                name: true,
                shortCode: true,
                color: true,
                createdAt: true,
                communityId: true,
            },
        });

        return NextResponse.json(userTeams);
    } catch (error) {
        console.error('Error fetching teams:', error);
        return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, shortCode, color, communityId } = body;

        if (!name) {
            return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
        }

        const [newTeam] = await db.insert(teams).values({
            ownerId: userId,
            communityId: communityId || null,
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
