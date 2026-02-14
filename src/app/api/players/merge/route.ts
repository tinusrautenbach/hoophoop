import { NextResponse } from 'next/server';
import { db } from '@/db';
import { athletes, teamMemberships, gameRosters, playerHistory } from '@/db/schema';
import { isWorldAdmin } from '@/lib/auth-admin';
import { eq, inArray } from 'drizzle-orm';

export async function POST(request: Request) {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { primaryId, duplicateIds } = body;

        if (!primaryId || !duplicateIds || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
            return NextResponse.json({ error: 'Invalid merge request' }, { status: 400 });
        }

        // Verify primary player exists
        const primaryPlayer = await db.query.athletes.findFirst({
            where: eq(athletes.id, primaryId)
        });

        if (!primaryPlayer) {
            return NextResponse.json({ error: 'Primary player not found' }, { status: 404 });
        }

        // Perform Merge (Transaction would be ideal, but Drizzle's transaction API varies by driver)
        // We'll execute sequentially for now.

        // 1. Reassign Team Memberships
        // Need to be careful about unique constraints (player+team). 
        // If primary is already on the team, we can't just update the duplicate's membership.
        // We might need to handle those cases manually or let them fail/warn.
        // For MVP, simplistic update:
        
        await db.update(teamMemberships)
            .set({ athleteId: primaryId })
            .where(inArray(teamMemberships.athleteId, duplicateIds));

        // 2. Reassign Game Rosters (History)
        await db.update(gameRosters)
            .set({ athleteId: primaryId })
            .where(inArray(gameRosters.athleteId, duplicateIds));

        // 3. Reassign Player History Logs
        await db.update(playerHistory)
            .set({ athleteId: primaryId })
            .where(inArray(playerHistory.athleteId, duplicateIds));

        // 4. Mark Duplicates as Merged
        await db.update(athletes)
            .set({ 
                status: 'merged', 
                mergedIntoId: primaryId,
                // Append note to name to avoid search confusion? Optional.
                name: `[MERGED] ${primaryPlayer.name}` 
            })
            .where(inArray(athletes.id, duplicateIds));

        return NextResponse.json({ success: true, mergedCount: duplicateIds.length });

    } catch (error) {
        console.error('Merge failed:', error);
        return NextResponse.json({ error: 'Merge operation failed' }, { status: 500 });
    }
}
