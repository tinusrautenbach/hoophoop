import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tournamentTeams, tournaments } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

// POST - Add team to tournament
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tournamentId } = await params;
    const body = await request.json();
    const { teamId, seed, poolId } = body;

    if (!teamId) {
        return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    try {
        // Check ownership of tournament
        const tournament = await db.query.tournaments.findFirst({
            where: and(eq(tournaments.id, tournamentId), eq(tournaments.ownerId, userId))
        });

        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found or unauthorized' }, { status: 404 });
        }

        // Check if team already in tournament
        const existing = await db.query.tournamentTeams.findFirst({
            where: and(
                eq(tournamentTeams.tournamentId, tournamentId),
                eq(tournamentTeams.teamId, teamId)
            )
        });

        if (existing) {
            return NextResponse.json({ error: 'Team already in tournament' }, { status: 400 });
        }

        const [newTournamentTeam] = await db.insert(tournamentTeams)
            .values({
                tournamentId,
                teamId,
                seed,
                poolId
            })
            .returning();

        return NextResponse.json(newTournamentTeam, { status: 201 });
    } catch (error) {
        console.error('Error adding team to tournament:', error);
        return NextResponse.json({ error: 'Failed to add team' }, { status: 500 });
    }
}

// GET - List teams in tournament
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: tournamentId } = await params;

    try {
        const teamsList = await db.query.tournamentTeams.findMany({
            where: eq(tournamentTeams.tournamentId, tournamentId),
            with: {
                team: true,
                pool: true
            }
        });

        return NextResponse.json(teamsList);
    } catch (error) {
        console.error('Error fetching tournament teams:', error);
        return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }
}
