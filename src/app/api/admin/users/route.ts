import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { isWorldAdmin } from '@/lib/auth-admin';
import { desc, count, ilike, or } from 'drizzle-orm';

export async function GET(request: Request) {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    try {
        const whereClause = search ? 
            or(
                ilike(users.firstName, `%${search}%`),
                ilike(users.lastName, `%${search}%`),
                ilike(users.email, `%${search}%`)
            ) : undefined;

        // Get total count
        const totalResult = await db.select({ count: count() })
            .from(users)
            .where(whereClause);
        const total = totalResult[0].count;

        // Get users
        const usersList = await db.query.users.findMany({
            where: whereClause,
            limit: limit,
            offset: offset,
            orderBy: [desc(users.createdAt)],
        });

        return NextResponse.json({
            users: usersList,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}
