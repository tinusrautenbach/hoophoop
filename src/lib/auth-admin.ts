import { db } from '@/db';
import { users } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq } from 'drizzle-orm';

/**
 * Checks if the current authenticated user is a World Admin.
 * Returns true if admin, false otherwise.
 */
export async function isWorldAdmin(): Promise<boolean> {
    const { userId } = await auth();
    if (!userId) return false;

    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { isWorldAdmin: true }
        });

        return !!user?.isWorldAdmin;
    } catch (error) {
        console.error('Failed to verify admin status:', error);
        return false;
    }
}

/**
 * Requires World Admin status or throws an error.
 * Useful for server actions or API routes.
 */
export async function requireWorldAdmin() {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        throw new Error('Unauthorized: World Admin access required');
    }
}
