import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Toggle for mock mode
const useMock = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';

export async function auth() {
    if (useMock) {
        return {
            userId: 'user_mock_123',
            sessionId: 'sess_mock_123',
        };
    }
    
    // Dynamically import to avoid initialization errors when mocking
    const { auth: clerkAuth } = await import('@clerk/nextjs/server');
    const session = await clerkAuth();
    return {
        userId: session.userId,
        sessionId: session.sessionId,
    };
}

export async function syncUser() {
    if (useMock) return;

    try {
        const { currentUser } = await import('@clerk/nextjs/server');
        const user = await currentUser();
        if (!user) return;

        const existing = await db.query.users.findFirst({
            where: eq(users.id, user.id)
        });

        if (!existing) {
            await db.insert(users).values({
                id: user.id,
                email: user.emailAddresses[0]?.emailAddress || '',
                firstName: user.firstName,
                lastName: user.lastName,
                imageUrl: user.imageUrl,
            });
        } else {
            // Optional: Update user info if it changed
            await db.update(users)
                .set({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    imageUrl: user.imageUrl,
                    updatedAt: new Date(),
                })
                .where(eq(users.id, user.id));
        }
    } catch (error) {
        console.error('Failed to sync user:', error);
    }
}
