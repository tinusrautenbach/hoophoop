import { NextResponse } from 'next/server';
import { db } from '@/db';
import { athletes } from '@/db/schema';
import { auth } from '@clerk/nextjs/server';
import { eq, ilike, and } from 'drizzle-orm';

export async function GET(request: Request) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    try {
        const results = await db.query.athletes.findMany({
            where: query
                ? and(eq(athletes.ownerId, userId), ilike(athletes.name, `%${query}%`))
                : eq(athletes.ownerId, userId),
            limit: 20,
        });

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error fetching athletes:', error);
        return NextResponse.json({ error: 'Failed to fetch athletes' }, { status: 500 });
    }
}
