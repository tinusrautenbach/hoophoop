import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, teamMemberships, gameRosters } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, desc } from 'drizzle-orm';
import { logActivity } from '@/lib/activity-logger';

export async function GET() {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userGames = await db.query.games.findMany({
            where: eq(games.ownerId, userId),
            orderBy: [desc(games.createdAt)],
            with: {
                rosters: true,
            }
        });

        return NextResponse.json(userGames);
    } catch (error) {
        console.error('Error fetching games:', error);
        return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        console.log('Create game body:', JSON.stringify(body, null, 2));
        
        const { homeTeamId, guestTeamId, homeTeamName, guestTeamName, mode, periodSeconds, totalPeriods, totalTimeouts, name, scheduledDate } = body;

        // Ensure team IDs are proper UUIDs or null (not 'adhoc' string)
        const safeHomeTeamId = homeTeamId && homeTeamId !== 'adhoc' ? homeTeamId : null;
        const safeGuestTeamId = guestTeamId && guestTeamId !== 'adhoc' ? guestTeamId : null;

        const [newGame] = await db.insert(games).values({
            ownerId: userId,
            homeTeamId: safeHomeTeamId,
            guestTeamId: safeGuestTeamId,
            homeTeamName: homeTeamName || 'Home',
            guestTeamName: guestTeamName || 'Guest',
            name: name || null,
            scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
            status: 'scheduled',
            mode: mode || 'simple',
            periodSeconds: periodSeconds || 600,
            clockSeconds: periodSeconds || 600,
            totalPeriods: totalPeriods || 4,
            totalTimeouts: totalTimeouts || 3,
            homeTimeouts: totalTimeouts || 3,
            guestTimeouts: totalTimeouts || 3,
        }).returning();

        // Populate rosters for both teams if team IDs are provided
        if (homeTeamId && homeTeamId !== 'adhoc') {
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

        if (guestTeamId && guestTeamId !== 'adhoc') {
            const members = await db.query.teamMemberships.findMany({
                where: eq(teamMemberships.teamId, guestTeamId),
                with: { athlete: true }
            });

            if (members.length > 0) {
                await db.insert(gameRosters).values(
                    members.map(m => ({
                        gameId: newGame.id,
                        team: 'guest' as const,
                        athleteId: m.athleteId,
                        name: m.athlete.name,
                        number: m.number || '00',
                    }))
                );
            }
        }

        // Fetch the complete game with rosters to return
        const completeGame = await db.query.games.findFirst({
            where: eq(games.id, newGame.id),
            with: {
                rosters: true,
            }
        });

        // Log activity
        await logActivity({
            userId,
            action: 'GAME_CREATED',
            resourceType: 'game',
            resourceId: newGame.id,
            details: { home: homeTeamName, guest: guestTeamName }
        });

        return NextResponse.json(completeGame);
    } catch (error) {
        console.error('Error creating game:', error);
        return NextResponse.json({ error: 'Failed to create game', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
