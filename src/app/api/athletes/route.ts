import { NextResponse } from 'next/server';
import { db } from '@/db';
import { athletes } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, ilike, and, or } from 'drizzle-orm';

export async function GET(request: Request) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    try {
        let whereCondition;

        if (query) {
            const searchTerm = `%${query}%`;
            whereCondition = and(
                eq(athletes.ownerId, userId),
                or(
                    ilike(athletes.firstName, searchTerm),
                    ilike(athletes.surname, searchTerm),
                    ilike(athletes.name, searchTerm),
                )
            );
        } else {
            whereCondition = eq(athletes.ownerId, userId);
        }

        const results = await db.query.athletes.findMany({
            where: whereCondition,
            limit: 20,
        });

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error fetching athletes:', error);
        return NextResponse.json({ error: 'Failed to fetch athletes' }, { status: 500 });
    }
}
