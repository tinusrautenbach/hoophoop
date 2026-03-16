'use client';

import React from 'react';

export const SignedIn = ({ children }: { children: React.ReactNode }) => {
    // In demo mode, we're always signed in
    return <div suppressHydrationWarning>{children}</div>;
};

export const SignedOut = ({ children }: { children: React.ReactNode }) => {
    return <div suppressHydrationWarning style={{ display: 'none' }}>{children}</div>;
};

export const UserButton = () => {
    return (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
            JD
        </div>
    );
};

export const SignInButton = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

export const SignOutButton = ({ children }: { children: React.ReactNode }) => {
    return <button type="button" onClick={() => alert('Mock: Signed Out')}>{children}</button>;
};

export const SignUpButton = ({ children }: { children: React.ReactNode }) => {
    return <div>{children}</div>;
};

export const ClerkProvider = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

function getMockUserId(): string {
    if (typeof window !== 'undefined') {
        const mockId = (window as unknown as { __mockUserId?: string }).__mockUserId;
        if (mockId) {
            return mockId;
        }
        const match = document.cookie.match(/__mock_user_id=([^;]+)/);
        if (match) return match[1];
    }
    return 'user_mock_123';
}

function base64UrlEncode(str: string): string {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createMockToken(userId: string): string {
    const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const payload = base64UrlEncode(JSON.stringify({
        sub: userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        'https://hasura.io/jwt/claims': {
            'x-hasura-user-id': userId,
            'x-hasura-default-role': 'user',
            'x-hasura-allowed-roles': ['user'],
        },
    }));
    return `${header}.${payload}.`;
}

export const useAuth = () => {
    const userId = getMockUserId();
    return {
        isLoaded: true,
        userId,
        sessionId: `sess_${userId}`,
        getToken: async (_options?: { template?: string }) => {
            const mockToken = (window as unknown as { __mockAuthToken?: string }).__mockAuthToken;
            if (mockToken) return mockToken;
            return createMockToken(userId);
        },
    };
};

export const useUser = () => {
    const userId = getMockUserId();
    return {
        isLoaded: true,
        isSignedIn: true,
        user: {
            id: userId,
            firstName: 'Test',
            lastName: 'User',
            imageUrl: 'https://github.com/shadcn.png',
        },
    };
};
