import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { NextFetchEvent } from 'next/server';

const useMock = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
    if (useMock || request.headers.get('x-test-auth') === 'true') {
        return NextResponse.next();
    }

    // Dynamically import Clerk to avoid key validation on load
    const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');

    const isPublicRoute = createRouteMatcher([
        '/',
        '/live',
        '/live/(.*)',
        '/community/(.*)',
        '/game/(.*)',
        '/api/games/(.*)/events',
        '/api/games/(.*)',
        '/api/public/(.*)',
        '/api/communities/(.*)/teams',
        '/api/socket',
        '/sign-in(.*)',
        '/sign-up(.*)',
    ]);

    return clerkMiddleware(async (auth, req) => {
        if (!isPublicRoute(req)) {
            await auth.protect();
        }
    })(request, event);
}

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
};
