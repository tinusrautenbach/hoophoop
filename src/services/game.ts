import { db } from '@/db';
import { games, gameEvents, gameRosters } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { graphqlRequest } from '@/lib/hasura/client';

export type GameState = {
    id: string;
    ownerId: string;
    homeTeamName: string;
    guestTeamName: string;
    status: 'scheduled' | 'live' | 'final';
    currentPeriod: number;
    clockSeconds: number;
    homeScore: number;
    guestScore: number;
    homeFouls: number;
    guestFouls: number;
    possession?: 'home' | 'guest';
    createdAt: Date;
    updatedAt: Date;
};

export const calculateScore = (
    currentState: Partial<GameState>,
    team: 'home' | 'guest',
    points: number
): Partial<GameState> => {
    if (team === 'home') {
        return { ...currentState, homeScore: (currentState.homeScore || 0) + points };
    } else {
        return { ...currentState, guestScore: (currentState.guestScore || 0) + points };
    }
};

export type RecalculationResult = {
    corrected: boolean;
    oldValues: {
        homeScore: number;
        guestScore: number;
        homeFouls: number;
        guestFouls: number;
    };
    newValues: {
        homeScore: number;
        guestScore: number;
        homeFouls: number;
        guestFouls: number;
    };
    rosterChanges: Array<{
        name: string;
        team: string;
        oldPoints: number;
        newPoints: number;
        oldFouls: number;
        newFouls: number;
    }>;
    trigger: string;
    gameId: string;
    timestamp: string;
};

const UPSERT_GAME_STATE_MUTATION = `
  mutation UpsertGameStateAfterRecalculate(
    $gameId: uuid!
    $homeScore: Int!
    $guestScore: Int!
    $homeFouls: Int!
    $guestFouls: Int!
    $updatedAt: timestamptz!
  ) {
    updateGameStates(
      where: { gameId: { _eq: $gameId } }
      _set: {
        homeScore: $homeScore
        guestScore: $guestScore
        homeFouls: $homeFouls
        guestFouls: $guestFouls
        updatedAt: $updatedAt
      }
      _inc: { version: 1 }
    ) {
      affected_rows
    }
  }
`;

/**
 * Recalculates game totals by summing all game events.
 * If totals differ from stored values, updates both the games table and Hasura.
 * Logs discrepancy details when corrected=true.
 */
export async function recalculateGameTotals(
    gameId: string,
    trigger: 'manual' | 'delete' | 'patch' | 'period_change' | 'reconnection' | 'finalization'
): Promise<RecalculationResult> {
    const timestamp = new Date().toISOString();

    // Get current stored totals
    const game = await db.query.games.findFirst({
        where: eq(games.id, gameId),
        columns: {
            homeScore: true,
            guestScore: true,
            homeFouls: true,
            guestFouls: true,
        },
    });

    if (!game) {
        throw new Error(`Game ${gameId} not found`);
    }

    const oldValues = {
        homeScore: game.homeScore,
        guestScore: game.guestScore,
        homeFouls: game.homeFouls,
        guestFouls: game.guestFouls,
    };

    // SUM score events per team
    const scoreEvents = await db
        .select({
            team: gameEvents.team,
            total: sql<number>`COALESCE(SUM(${gameEvents.value}), 0)`.mapWith(Number),
        })
        .from(gameEvents)
        .where(and(eq(gameEvents.gameId, gameId), eq(gameEvents.type, 'score')))
        .groupBy(gameEvents.team);

    const homeScoredTrue = scoreEvents.find(r => r.team === 'home')?.total ?? 0;
    const guestScoredTrue = scoreEvents.find(r => r.team === 'guest')?.total ?? 0;

    // COUNT foul events per team
    const foulEvents = await db
        .select({
            team: gameEvents.team,
            total: sql<number>`COUNT(*)`.mapWith(Number),
        })
        .from(gameEvents)
        .where(and(eq(gameEvents.gameId, gameId), eq(gameEvents.type, 'foul')))
        .groupBy(gameEvents.team);

    const homeFoulsTrue = foulEvents.find(r => r.team === 'home')?.total ?? 0;
    const guestFoulsTrue = foulEvents.find(r => r.team === 'guest')?.total ?? 0;

    const newValues = {
        homeScore: homeScoredTrue,
        guestScore: guestScoredTrue,
        homeFouls: homeFoulsTrue,
        guestFouls: guestFoulsTrue,
    };

    const corrected =
        oldValues.homeScore !== newValues.homeScore ||
        oldValues.guestScore !== newValues.guestScore ||
        oldValues.homeFouls !== newValues.homeFouls ||
        oldValues.guestFouls !== newValues.guestFouls;

    if (corrected) {
        console.log(`[recalculateGameTotals] Game ${gameId} corrected via trigger="${trigger}":`, {
            oldValues,
            newValues,
        });

        // Update games table with correct totals
        await db.update(games)
            .set({
                homeScore: newValues.homeScore,
                guestScore: newValues.guestScore,
                homeFouls: newValues.homeFouls,
                guestFouls: newValues.guestFouls,
                updatedAt: new Date(),
            })
            .where(eq(games.id, gameId));

        // Sync to Hasura (non-fatal)
        try {
            await graphqlRequest(UPSERT_GAME_STATE_MUTATION, {
                gameId,
                homeScore: newValues.homeScore,
                guestScore: newValues.guestScore,
                homeFouls: newValues.homeFouls,
                guestFouls: newValues.guestFouls,
                updatedAt: timestamp,
            });
        } catch (hasuraError) {
            console.error('[recalculateGameTotals] Hasura sync failed (non-fatal):', hasuraError);
        }
    }

    // Recalculate roster stats (non-fatal) — sum player score events and foul events
    const rosterChanges: RecalculationResult['rosterChanges'] = [];
    if (corrected) {
        try {
            const rosterEntries = await db.query.gameRosters.findMany({
                where: eq(gameRosters.gameId, gameId),
                columns: { id: true, name: true, team: true, points: true, fouls: true },
            });

            for (const roster of rosterEntries) {
                const [scoreRow] = await db
                    .select({ total: sql<number>`COALESCE(SUM(${gameEvents.value}), 0)`.mapWith(Number) })
                    .from(gameEvents)
                    .where(and(
                        eq(gameEvents.gameId, gameId),
                        eq(gameEvents.type, 'score'),
                        eq(gameEvents.player, roster.name),
                        eq(gameEvents.team, roster.team),
                    ));

                const [foulRow] = await db
                    .select({ total: sql<number>`COUNT(*)`.mapWith(Number) })
                    .from(gameEvents)
                    .where(and(
                        eq(gameEvents.gameId, gameId),
                        eq(gameEvents.type, 'foul'),
                        eq(gameEvents.player, roster.name),
                        eq(gameEvents.team, roster.team),
                    ));

                const truePoints = scoreRow?.total ?? 0;
                const trueFouls = foulRow?.total ?? 0;

                if (roster.points !== truePoints || roster.fouls !== trueFouls) {
                    await db.update(gameRosters)
                        .set({ points: truePoints, fouls: trueFouls })
                        .where(eq(gameRosters.id, roster.id));

                    rosterChanges.push({
                        name: roster.name,
                        team: roster.team,
                        oldPoints: roster.points,
                        newPoints: truePoints,
                        oldFouls: roster.fouls,
                        newFouls: trueFouls,
                    });
                }
            }
        } catch (rosterError) {
            console.error('[recalculateGameTotals] Roster recalculation failed (non-fatal):', rosterError);
        }
    }

    return {
        corrected,
        oldValues,
        newValues,
        rosterChanges,
        trigger,
        gameId,
        timestamp,
    };
}
