import { NextResponse } from 'next/server';
import { db } from '@/db';
import { athletes } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, isNull, and } from 'drizzle-orm';

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
        // Find the player profile
        const player = await db.query.athletes.findFirst({
            where: eq(athletes.id, playerId),
        });

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        // Check if already claimed
        if (player.userId) {
            return NextResponse.json({ error: 'Player profile already claimed' }, { status: 400 });
        }

        // Check if current user already has a linked profile
        const existingProfile = await db.query.athletes.findFirst({
            where: eq(athletes.userId, userId),
        });

        if (existingProfile) {
            return NextResponse.json({ error: 'You already have a linked player profile' }, { status: 400 });
        }

        // Optional: Verification logic could go here (e.g. email check)
        // For MVP, we'll allow claiming if it's unclaimed

        await db.update(athletes)
            .set({ 
                userId,
                updatedAt: new Date(),
            } as any)
            .where(eq(athletes.id, playerId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error claiming player profile:', error);
        return NextResponse.json({ error: 'Failed to claim player profile' }, { status: 500 });
    }
}
