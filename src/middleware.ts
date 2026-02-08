import { NextResponse } from 'next/server';

const useMock = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';

export default async function middleware(request: any, event: any) {
    if (useMock) {
        return NextResponse.next();
    }
    
    // Dynamically import Clerk to avoid key validation on load
    const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');
    
    const isPublicRoute = createRouteMatcher([
        '/',
        '/game/(.*)', 
        '/api/games/(.*)/events',
        '/api/games/(.*)',
        '/api/socket',
        '/sign-in(.*)',
        '/sign-up(.*)',
    ]);

    return clerkMiddleware(async (auth, request) => {
        if (!isPublicRoute(request)) {
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
