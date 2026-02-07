'use client';

import React from 'react';

export const SignedIn = ({ children }: { children: React.ReactNode }) => {
    // In demo mode, we're always signed in
    return <>{children}</>;
};

export const SignedOut = ({ children }: { children: React.ReactNode }) => {
    return null;
};

export const UserButton = () => {
    return (
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">
            JD
        </div>
    );
};

export const SignInButton = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

export const ClerkProvider = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

export const useAuth = () => {
    return {
        isLoaded: true,
        userId: 'user_mock_123',
        sessionId: 'sess_mock_123',
        getToken: async () => 'mock_token',
    };
};

export const useUser = () => {
    return {
        isLoaded: true,
        isSignedIn: true,
        user: {
            id: 'user_mock_123',
            firstName: 'John',
            lastName: 'Doe',
            imageUrl: 'https://github.com/shadcn.png',
        },
    };
};
