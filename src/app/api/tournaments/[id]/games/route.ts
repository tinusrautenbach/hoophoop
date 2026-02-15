import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tournamentGames, tournaments, games, teams } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and } from 'drizzle-orm';

// POST - Add game to tournament
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
    const { 
        gameId, 
        round, 
        poolId, 
        bracketPosition, 
        isPoolGame = false,
        // Optional: create new game params
        homeTeamId,
        guestTeamId,
        scheduledDate
    } = body;

    try {
        // Check ownership of tournament
        const tournament = await db.query.tournaments.findFirst({
            where: and(eq(tournaments.id, tournamentId), eq(tournaments.ownerId, userId))
        });

        if (!tournament) {
            return NextResponse.json({ error: 'Tournament not found or unauthorized' }, { status: 404 });
        }

        let finalGameId = gameId;

        // If no gameId provided, create a new game
        if (!finalGameId) {
            if (!homeTeamId || !guestTeamId) {
                return NextResponse.json({ error: 'Home and Guest team IDs are required to create a game' }, { status: 400 });
            }

            // Look up team names from the database
            const homeTeam = await db.query.teams.findFirst({
                where: eq(teams.id, homeTeamId)
            });
            const guestTeam = await db.query.teams.findFirst({
                where: eq(teams.id, guestTeamId)
            });

            if (!homeTeam || !guestTeam) {
                return NextResponse.json({ error: 'One or both teams not found' }, { status: 404 });
            }

            const [newGame] = await db.insert(games)
                .values({
                    ownerId: userId,
                    communityId: tournament.communityId,
                    homeTeamId,
                    guestTeamId,
                    homeTeamName: homeTeam.name,
                    guestTeamName: guestTeam.name,
                    scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
                    status: 'scheduled'
                })
                .returning();
            
            finalGameId = newGame.id;
        }

        // Link game to tournament
        const [newTournamentGame] = await db.insert(tournamentGames)
            .values({
                tournamentId,
                gameId: finalGameId,
                round,
                poolId,
                bracketPosition,
                isPoolGame
            })
            .returning();

        return NextResponse.json(newTournamentGame, { status: 201 });
    } catch (error: unknown) {
        console.error('Error adding game to tournament:', error);
        return NextResponse.json({ error: 'Failed to add game' }, { status: 500 });
    }
}

// GET - List games in tournament
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: tournamentId } = await params;

    try {
        const gamesList = await db.query.tournamentGames.findMany({
            where: eq(tournamentGames.tournamentId, tournamentId),
            with: {
                game: true,
                pool: true
            }
        });

        return NextResponse.json(gamesList);
    } catch (error: unknown) {
        console.error('Error fetching tournament games:', error);
        return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
    }
}
