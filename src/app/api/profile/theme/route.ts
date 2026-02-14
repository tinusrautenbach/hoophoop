import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const themeSchema = z.object({
    theme: z.enum(['light', 'dark'])
});

export async function PATCH(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const result = themeSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: 'Invalid theme value. Must be "light" or "dark"' },
                { status: 400 }
            );
        }

        const { theme } = result.data;

        // Update user's theme preference
        await db.update(users)
            .set({
                theme,
                updatedAt: new Date()
            })
            .where(eq(users.id, userId));

        return NextResponse.json({ success: true, theme });
    } catch (error) {
        console.error('Failed to update theme:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
