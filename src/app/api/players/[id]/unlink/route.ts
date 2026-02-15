import { NextResponse } from 'next/server';
import { db } from '@/db';
import { athletes } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq } from 'drizzle-orm';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: playerId } = await params;

    try {
        const player = await db.query.athletes.findFirst({
            where: eq(athletes.id, playerId),
        });

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        if (!player.userId) {
            return NextResponse.json({ error: 'Player profile is not linked to any user' }, { status: 400 });
        }

        if (player.userId !== userId) {
            return NextResponse.json({ error: 'You can only unlink your own profile' }, { status: 403 });
        }

        await db.update(athletes)
            .set({ 
                userId: null,
                invitedBy: null,
                invitedAt: null
            })
            .where(eq(athletes.id, playerId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error unlinking player profile:', error);
        return NextResponse.json({ error: 'Failed to unlink player profile' }, { status: 500 });
    }
}
