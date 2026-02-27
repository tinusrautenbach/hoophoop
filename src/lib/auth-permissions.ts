import { db } from '@/db';
import { games, communities, communityMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { isWorldAdmin } from '@/lib/auth-admin';

/**
 * Returns true if the given userId has permission to manage (score, edit, delete
 * events for) the specified game.
 *
 * Permission hierarchy (any one of these grants access):
 * 1. World Admin
 * 2. Game owner (games.ownerId === userId)
 * 3. Community owner (communities.ownerId === userId, when game has communityId)
 * 4. Community admin  (communityMembers.role === 'admin')
 * 5. Community member with canManageGames === true
 */
export async function canManageGame(userId: string, gameId: string): Promise<boolean> {
    // World Admin bypasses all checks
    const adminCheck = await isWorldAdmin();
    if (adminCheck) return true;

    const game = await db.query.games.findFirst({
        where: eq(games.id, gameId),
        columns: { id: true, ownerId: true, communityId: true },
    });

    if (!game) return false;

    // Game owner
    if (game.ownerId === userId) return true;

    // No community attached — only owner (or world admin) can manage
    if (!game.communityId) return false;

    // Community-level checks
    const community = await db.query.communities.findFirst({
        where: eq(communities.id, game.communityId),
        columns: { id: true, ownerId: true },
    });

    if (!community) return false;

    // Community owner
    if (community.ownerId === userId) return true;

    // Community member role check
    const membership = await db.query.communityMembers.findFirst({
        where: and(
            eq(communityMembers.communityId, game.communityId),
            eq(communityMembers.userId, userId)
        ),
        columns: { role: true, canManageGames: true },
    });

    if (!membership) return false;

    // Community admin or member with canManageGames flag
    return membership.role === 'admin' || membership.canManageGames === true;
}
