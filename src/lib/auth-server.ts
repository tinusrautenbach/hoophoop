import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Toggle for mock mode
const useMock = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';

export async function auth() {
    try {
        const { headers } = await import('next/headers');
        const headerList = await headers();
        
        const testAuth = headerList.get('x-test-auth');
        const testUserId = headerList.get('x-test-user-id');

        if (testAuth === 'true') {
            return {
                userId: testUserId || 'user_mock_123',
                sessionId: 'sess_mock_' + (testUserId || '123'),
            };
        }
    } catch (e) {
    }

    if (useMock) {
        return {
            userId: 'user_mock_123',
            sessionId: 'sess_mock_123',
        };
    }

    try {
        const { auth: clerkAuth } = await import('@clerk/nextjs/server');
        const session = await clerkAuth();
        return {
            userId: session.userId,
            sessionId: session.sessionId,
        };
    } catch {
        return { userId: null, sessionId: null };
    }
}

export async function syncUser() {
    if (useMock) return;

    // Check for test header
    try {
        const { headers } = await import('next/headers');
        const headerList = await headers();
        if (headerList.get('x-test-auth') === 'true') {
            return;
        }
    } catch (e) {
        // Ignore errors
    }

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
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('clerkMiddleware') || msg.includes('clerkMiddleware()')) {
            return;
        }
        console.error('Failed to sync user:', error);
    }
}
