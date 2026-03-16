'use client';

import React, { createContext, useContext } from 'react';
import * as Clerk from '@clerk/nextjs';
import * as Mock from './mock-auth';

const useMock = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true' ||
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '').includes('replace_me');

interface AuthContextValue {
    isLoaded: boolean;
    userId: string | null;
    sessionId: string | null;
    getToken: (options?: { template?: string }) => Promise<string | null>;
}

interface UserContextValue {
    isLoaded: boolean;
    isSignedIn: boolean;
    user: { id: string; firstName: string | null; lastName: string | null; imageUrl: string } | null;
}

const AuthContext = createContext<AuthContextValue>({
    isLoaded: true,
    userId: null,
    sessionId: null,
    getToken: async () => null,
});

const UserContext = createContext<UserContextValue>({
    isLoaded: true,
    isSignedIn: false,
    user: null,
});

function MockAuthProvider({ children }: { children: React.ReactNode }) {
    const auth = Mock.useAuth();
    const user = Mock.useUser();
    const userValue: UserContextValue = {
        isLoaded: user.isLoaded,
        isSignedIn: user.isSignedIn,
        user: user.user ? {
            id: user.user.id,
            firstName: user.user.firstName,
            lastName: user.user.lastName,
            imageUrl: user.user.imageUrl,
        } : null,
    };
    return (
        <AuthContext.Provider value={auth}>
            <UserContext.Provider value={userValue}>
                {children}
            </UserContext.Provider>
        </AuthContext.Provider>
    );
}

function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
    const auth = Clerk.useAuth();
    const user = Clerk.useUser();
    const authValue: AuthContextValue = {
        isLoaded: auth.isLoaded,
        userId: auth.userId ?? null,
        sessionId: auth.sessionId ?? null,
        getToken: async (options) => auth.getToken(options),
    };
    const userValue: UserContextValue = {
        isLoaded: user.isLoaded,
        isSignedIn: !!user.isSignedIn,
        user: user.user ? {
            id: user.user.id,
            firstName: user.user.firstName,
            lastName: user.user.lastName,
            imageUrl: user.user.imageUrl,
        } : null,
    };
    return (
        <AuthContext.Provider value={authValue}>
            <UserContext.Provider value={userValue}>
                {children}
            </UserContext.Provider>
        </AuthContext.Provider>
    );
}

function InnerProvider({ children }: { children: React.ReactNode }) {
    if (useMock) {
        return (
            <Mock.ClerkProvider>
                <MockAuthProvider>{children}</MockAuthProvider>
            </Mock.ClerkProvider>
        );
    }
    return (
        <Clerk.ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
            <ClerkAuthProvider>{children}</ClerkAuthProvider>
        </Clerk.ClerkProvider>
    );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    return <InnerProvider>{children}</InnerProvider>;
}

export function SignedIn({ children }: { children: React.ReactNode }) {
    if (useMock) return <Mock.SignedIn>{children}</Mock.SignedIn>;
    return <Clerk.SignedIn>{children}</Clerk.SignedIn>;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
    if (useMock) return <Mock.SignedOut>{children}</Mock.SignedOut>;
    return <Clerk.SignedOut>{children}</Clerk.SignedOut>;
}

export function UserButton() {
    if (useMock) return <Mock.UserButton />;
    return <Clerk.UserButton />;
}

export function SignInButton({ children, mode }: { children: React.ReactNode, mode?: "modal" | "redirect" }) {
    if (useMock) return <Mock.SignInButton>{children}</Mock.SignInButton>;
    return <Clerk.SignInButton mode={mode}>{children}</Clerk.SignInButton>;
}

export function SignOutButton({ children }: { children: React.ReactNode }) {
    if (useMock) return <Mock.SignOutButton>{children}</Mock.SignOutButton>;
    return <Clerk.SignOutButton>{children}</Clerk.SignOutButton>;
}

export function SignUpButton({ children, mode }: { children: React.ReactNode, mode?: "modal" | "redirect" }) {
    if (useMock) return <Mock.SignUpButton>{children}</Mock.SignUpButton>;
    return <Clerk.SignUpButton mode={mode}>{children}</Clerk.SignUpButton>;
}

export function useAuth() {
    return useContext(AuthContext);
}

export function useUser() {
    return useContext(UserContext);
}
