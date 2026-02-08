import { NextResponse } from 'next/server';
import { db } from '@/db';
import { athletes, playerHistory, teams, teamMemberships } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, ilike, desc, and, isNull } from 'drizzle-orm';

export async function GET(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const includeInactive = searchParams.get('includeInactive') === 'true';

        let whereCondition;
        
        if (query) {
            whereCondition = query.length >= 2 
                ? ilike(athletes.name, `%${query}%`)
                : undefined;
        }

        const statusFilter = includeInactive ? undefined : eq(athletes.status, 'active');

        const playerList = await db.query.athletes.findMany({
            where: whereCondition ? and(whereCondition, statusFilter) : statusFilter,
            orderBy: [desc(athletes.createdAt)],
            limit: 50,
        });

        return NextResponse.json(playerList);
    } catch (error) {
        console.error('Error searching players:', error);
        return NextResponse.json({ error: 'Failed to search players' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, email, birthDate } = body;

        if (!name) {
            return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
        }

        const [newPlayer] = await db.insert(athletes).values({
            ownerId: userId,
            name,
            email: email || null,
            birthDate: birthDate || null,
            status: 'active',
        }).returning();

        return NextResponse.json(newPlayer);
    } catch (error) {
        console.error('Error creating player:', error);
        return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
    }
}
