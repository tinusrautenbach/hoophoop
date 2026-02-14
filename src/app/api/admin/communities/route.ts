import { NextResponse } from 'next/server';
import { db } from '@/db';
import { communities } from '@/db/schema';
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
                ilike(communities.name, `%${search}%`),
                ilike(communities.slug, `%${search}%`)
            ) : undefined;

        // Get total count
        const totalResult = await db.select({ count: count() })
            .from(communities)
            .where(whereClause);
        const total = totalResult[0].count;

        // Get communities with member count
        const communitiesList = await db.query.communities.findMany({
            where: whereClause,
            limit: limit,
            offset: offset,
            orderBy: [desc(communities.createdAt)],
            with: {
                members: true,
                owner: true
            }
        });

        return NextResponse.json({
            communities: communitiesList.map(c => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                type: c.type,
                ownerId: c.ownerId,
                owner: c.owner ? {
                    id: c.owner.id,
                    email: c.owner.email,
                    firstName: c.owner.firstName,
                    lastName: c.owner.lastName,
                } : null,
                memberCount: c.members.length,
                createdAt: c.createdAt,
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching communities:', error);
        return NextResponse.json({ error: 'Failed to fetch communities' }, { status: 500 });
    }
}
