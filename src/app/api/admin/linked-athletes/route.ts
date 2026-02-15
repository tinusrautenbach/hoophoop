import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, athletes } from '@/db/schema';
import { isWorldAdmin } from '@/lib/auth-admin';
import { desc, eq, ilike, or, not, isNull, and } from 'drizzle-orm';

export async function GET(request: Request) {
    const isAdmin = await isWorldAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // all, linked, unlinked
    const offset = (page - 1) * limit;

    try {
        let whereClause;
        
        if (search) {
            const searchClause = or(
                ilike(users.firstName, `%${search}%`),
                ilike(users.lastName, `%${search}%`),
                ilike(users.email, `%${search}%`),
                ilike(athletes.name, `%${search}%`)
            );
            
            if (filter === 'linked') {
                whereClause = and(searchClause, not(isNull(athletes.userId)));
            } else if (filter === 'unlinked') {
                whereClause = and(searchClause, isNull(athletes.userId));
            } else {
                whereClause = searchClause;
            }
        } else {
            if (filter === 'linked') {
                whereClause = not(isNull(athletes.userId));
            } else if (filter === 'unlinked') {
                whereClause = isNull(athletes.userId);
            }
        }

        // Get athletes with user info
        const linkedAthletes = await db.select({
            id: athletes.id,
            name: athletes.name,
            firstName: athletes.firstName,
            surname: athletes.surname,
            status: athletes.status,
            communityId: athletes.communityId,
            createdAt: athletes.createdAt,
            userId: athletes.userId,
            userFirstName: users.firstName,
            userLastName: users.lastName,
            userEmail: users.email,
            userCreatedAt: users.createdAt,
        })
        .from(athletes)
        .leftJoin(users, eq(athletes.userId, users.id))
        .where(whereClause)
        .orderBy(desc(athletes.createdAt))
        .limit(limit)
        .offset(offset);

        // Get total count
        const totalResult = await db.select({ count: users.id })
            .from(athletes)
            .leftJoin(users, eq(athletes.userId, users.id))
            .where(whereClause);
        
        const total = totalResult.length;

        return NextResponse.json({
            linkedAthletes: linkedAthletes.map(a => ({
                id: a.id,
                name: a.name,
                firstName: a.firstName,
                surname: a.surname,
                status: a.status,
                communityId: a.communityId,
                createdAt: a.createdAt,
                user: a.userId ? {
                    id: a.userId,
                    firstName: a.userFirstName,
                    lastName: a.userLastName,
                    email: a.userEmail,
                    createdAt: a.userCreatedAt,
                } : null,
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching linked athletes:', error);
        return NextResponse.json({ error: 'Failed to fetch linked athletes' }, { status: 500 });
    }
}
