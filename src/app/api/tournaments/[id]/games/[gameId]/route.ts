import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tournamentGames, tournaments, games } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

// DELETE - Remove game from tournament
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; gameId: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tournamentId, gameId } = await params;

    try {
        // Check ownership of tournament
        const tournament = await db.query.tournaments.findFirst({
            where: and(eq(tournaments.id, tournamentId), eq(tournaments.ownerId, userId))
        });

        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found or unauthorized' }, { status: 404 });
        }

        // Delete the tournament_game record
        await db.delete(tournamentGames)
            .where(
                and(
                    eq(tournamentGames.tournamentId, tournamentId),
                    eq(tournamentGames.gameId, gameId)
                )
            );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing game from tournament:', error);
        return NextResponse.json({ error: 'Failed to remove game' }, { status: 500 });
    }
}

// PATCH - Manual score entry for tournament game
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; gameId: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tournamentId, gameId } = await params;
    const body = await request.json();
    const { 
        homeScore, 
        guestScore,
        homeFouls,
        guestFouls,
        playerOfTheMatchId,
        playerOfTheMatchName,
        home3Pointers,
        guest3Pointers,
        homeFreeThrows,
        guestFreeThrows
    } = body;

    try {
        // Check ownership of tournament
        const tournament = await db.query.tournaments.findFirst({
            where: and(eq(tournaments.id, tournamentId), eq(tournaments.ownerId, userId))
        });

        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found or unauthorized' }, { status: 404 });
        }

        // Verify game is in tournament
        const tournamentGame = await db.query.tournamentGames.findFirst({
            where: and(
                eq(tournamentGames.tournamentId, tournamentId),
                eq(tournamentGames.gameId, gameId)
            )
        });

        if (!tournamentGame) {
            return NextResponse.json({ error: 'Game not found in tournament' }, { status: 404 });
        }

        // Build update objects
        const gameUpdate: Record<string, unknown> = {};
        const tournamentGameUpdate: Record<string, unknown> = {};

        // Update scores if provided
        if (homeScore !== undefined) gameUpdate.homeScore = homeScore;
        if (guestScore !== undefined) gameUpdate.guestScore = guestScore;
        if (homeScore !== undefined && guestScore !== undefined) gameUpdate.status = 'final';

        // Update optional tournament game stats
        if (homeFouls !== undefined) tournamentGameUpdate.homeFouls = homeFouls;
        if (guestFouls !== undefined) tournamentGameUpdate.guestFouls = guestFouls;
        if (playerOfTheMatchId !== undefined) tournamentGameUpdate.playerOfTheMatchId = playerOfTheMatchId;
        if (playerOfTheMatchName !== undefined) tournamentGameUpdate.playerOfTheMatchName = playerOfTheMatchName;
        if (home3Pointers !== undefined) tournamentGameUpdate.home3Pointers = home3Pointers;
        if (guest3Pointers !== undefined) tournamentGameUpdate.guest3Pointers = guest3Pointers;
        if (homeFreeThrows !== undefined) tournamentGameUpdate.homeFreeThrows = homeFreeThrows;
        if (guestFreeThrows !== undefined) tournamentGameUpdate.guestFreeThrows = guestFreeThrows;

        // Update the game
        let updatedGame = null;
        if (Object.keys(gameUpdate).length > 0) {
            [updatedGame] = await db.update(games)
                .set(gameUpdate)
                .where(eq(games.id, gameId))
                .returning();
        }

        // Update the tournament game record
        let updatedTournamentGame = null;
        if (Object.keys(tournamentGameUpdate).length > 0) {
            [updatedTournamentGame] = await db.update(tournamentGames)
                .set(tournamentGameUpdate)
                .where(eq(tournamentGames.id, tournamentGame.id))
                .returning();
        }

        // Fetch the updated game if not already fetched
        const finalGame = updatedGame || await db.query.games.findFirst({
            where: eq(games.id, gameId)
        });

        return NextResponse.json({ 
            game: finalGame,
            tournamentGame: updatedTournamentGame || tournamentGame 
        });
    } catch (error) {
        console.error('Error updating game:', error);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
    }
}
