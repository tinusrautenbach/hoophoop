import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teamMemberships } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq } from 'drizzle-orm';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; memberId: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { memberId } = await params;

    try {
        await db.delete(teamMemberships).where(eq(teamMemberships.id, memberId));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting team member:', error);
        return NextResponse.json({ error: 'Failed to delete team member' }, { status: 500 });
    }
}
