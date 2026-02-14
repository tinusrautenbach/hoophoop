import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { isWorldAdmin } from '@/lib/auth-admin';
import { eq } from 'drizzle-orm';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isWorldAdmin: newAdminStatus } = body;

    try {
        const [updatedUser] = await db.update(users)
            .set({ isWorldAdmin: newAdminStatus })
            .where(eq(users.id, id))
            .returning();

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    try {
        // Check if user exists
        const user = await db.query.users.findFirst({
            where: eq(users.id, id)
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Prevent deleting yourself
        const { userId: currentUserId } = await import('@/lib/auth-server').then(m => m.auth());
        if (currentUserId === id) {
            return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
        }

        // Delete user - cascades will handle related records
        await db.delete(users).where(eq(users.id, id));

        return NextResponse.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
