import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games, users } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, desc, inArray, isNotNull } from 'drizzle-orm';

// GET /api/games/deleted - List all deleted games (World Admin only)
export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Check if user is world admin
        const currentUser = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        if (!currentUser?.isWorldAdmin) {
            return NextResponse.json({ error: 'Forbidden - World admin only' }, { status: 403 });
        }

        // Fetch all deleted games
        const deletedGames = await db.query.games.findMany({
            where: isNotNull(games.deletedAt),
            orderBy: [desc(games.deletedAt)],
            with: {
                community: true,
                rosters: true,
            }
        });

        // Get unique owner IDs to fetch their names
        const ownerIds = [...new Set(deletedGames.map(g => g.ownerId))];
        const owners = await db.query.users.findMany({
            where: inArray(users.id, ownerIds),
        });
        const ownerMap = new Map(owners.map(u => [u.id, { 
            firstName: u.firstName, 
            lastName: u.lastName,
            email: u.email 
        }]));

        // Enrich games with owner name
        const gamesWithOwner = deletedGames.map(game => {
            const owner = ownerMap.get(game.ownerId);
            const ownerName = owner?.firstName && owner?.lastName
                ? `${owner.firstName} ${owner.lastName}`
                : owner?.email || 'Unknown';
            
            return {
                ...game,
                ownerName,
            };
        });

        return NextResponse.json(gamesWithOwner);
    } catch (error) {
        console.error('Error fetching deleted games:', error);
        return NextResponse.json({ error: 'Failed to fetch deleted games' }, { status: 500 });
    }
}
