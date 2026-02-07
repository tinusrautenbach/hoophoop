import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, teamMemberships, gameRosters } from '@/db/schema';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { homeTeamId, guestTeamId, homeTeamName, guestTeamName } = body;

        const [newGame] = await db.insert(games).values({
            ownerId: userId,
            homeTeamId: homeTeamId || null,
            guestTeamId: guestTeamId || null,
            homeTeamName: homeTeamName || 'Home',
            guestTeamName: guestTeamName || 'Guest',
            status: 'scheduled',
        }).returning();

        // If homeTeamId is provided, seed the roster
        if (homeTeamId) {
            const members = await db.query.teamMemberships.findMany({
                where: eq(teamMemberships.teamId, homeTeamId),
                with: { athlete: true }
            });

            if (members.length > 0) {
                await db.insert(gameRosters).values(
                    members.map(m => ({
                        gameId: newGame.id,
                        team: 'home' as const,
                        athleteId: m.athleteId,
                        name: m.athlete.name,
                        number: m.number || '00',
                    }))
                );
            }
        }

        return NextResponse.json(newGame);
    } catch (error) {
        console.error('Error creating game:', error);
        return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
    }
}
