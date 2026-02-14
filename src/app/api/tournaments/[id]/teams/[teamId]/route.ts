import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tournamentTeams, tournaments } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

// PATCH - Update team (seed, pool)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; teamId: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tournamentId, teamId } = await params;
    const body = await request.json();
    const { seed, poolId } = body;

    try {
        // Check ownership of tournament
        const tournament = await db.query.tournaments.findFirst({
            where: and(eq(tournaments.id, tournamentId), eq(tournaments.ownerId, userId))
        });

        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found or unauthorized' }, { status: 404 });
        }

        // Find the tournament_team record
        const tournamentTeam = await db.query.tournamentTeams.findFirst({
            where: and(
                eq(tournamentTeams.tournamentId, tournamentId),
                eq(tournamentTeams.teamId, teamId)
            )
        });

        if (!tournamentTeam) {
            return NextResponse.json({ error: 'Team not found in tournament' }, { status: 404 });
        }

        const [updated] = await db.update(tournamentTeams)
            .set({
                seed: seed !== undefined ? seed : tournamentTeam.seed,
                poolId: poolId !== undefined ? poolId : tournamentTeam.poolId,
            })
            .where(eq(tournamentTeams.id, tournamentTeam.id))
            .returning();

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating tournament team:', error);
        return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    }
}

// DELETE - Remove team from tournament
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; teamId: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tournamentId, teamId } = await params;

    try {
        // Check ownership of tournament
        const tournament = await db.query.tournaments.findFirst({
            where: and(eq(tournaments.id, tournamentId), eq(tournaments.ownerId, userId))
        });

        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found or unauthorized' }, { status: 404 });
        }

        // Delete the tournament_team record
        await db.delete(tournamentTeams)
            .where(
                and(
                    eq(tournamentTeams.tournamentId, tournamentId),
                    eq(tournamentTeams.teamId, teamId)
                )
            );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing team from tournament:', error);
        return NextResponse.json({ error: 'Failed to remove team' }, { status: 500 });
    }
}
