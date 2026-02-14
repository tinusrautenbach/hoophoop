import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tournaments } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { logActivity } from '@/lib/activity-logger';

// GET - List tournaments
export async function GET(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    try {
        const userTournaments = await db.query.tournaments.findMany({
            where: (tournaments, { eq, and }) => {
                const conditions = [];
                if (communityId) {
                    conditions.push(eq(tournaments.communityId, communityId));
                }
                // For now, return tournaments the user owns or community tournaments they might have access to
                // We'll refine this later with community member checks
                return conditions.length > 0 ? and(...conditions) : eq(tournaments.ownerId, userId);
            },
            with: {
                community: true,
                teams: {
                    with: {
                        team: true
                    }
                }
            },
            orderBy: (tournaments, { desc }) => [desc(tournaments.createdAt)]
        });

        return NextResponse.json(userTournaments);
    } catch (error) {
        console.error('Error fetching tournaments:', error);
        return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
    }
}

// POST - Create a new tournament
export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
        name, 
        type = 'round_robin', 
        startDate, 
        endDate, 
        communityId, 
        description 
    } = body;

    if (!name || !startDate || !endDate || !communityId) {
        return NextResponse.json({ 
            error: 'Name, startDate, endDate, and communityId are required' 
        }, { status: 400 });
    }

    try {
        const [newTournament] = await db.insert(tournaments)
            .values({
                name,
                type,
                startDate: new Date(startDate).toISOString().split('T')[0],
                endDate: new Date(endDate).toISOString().split('T')[0],
                communityId,
                ownerId: userId,
                description,
                status: 'scheduled'
            })
            .returning();

        // Log activity
        await logActivity({
            userId,
            action: 'TOURNAMENT_CREATED',
            resourceType: 'tournament',
            resourceId: newTournament.id,
            details: { name, type, communityId }
        });

        return NextResponse.json(newTournament, { status: 201 });
    } catch (error) {
        console.error('Error creating tournament:', error);
        return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
    }
}
