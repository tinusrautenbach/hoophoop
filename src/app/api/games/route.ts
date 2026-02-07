import { NextResponse } from 'next/server';
import { db } from '@/db';
import { games } from '@/db/schema';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: Request) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { homeTeamName, guestTeamName } = body;

        const [newGame] = await db.insert(games).values({
            ownerId: userId,
            homeTeamName: homeTeamName || 'Home',
            guestTeamName: guestTeamName || 'Guest',
            status: 'scheduled',
        }).returning();

        return NextResponse.json(newGame);
    } catch (error) {
        console.error('Error creating game:', error);
        return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
    }
}
