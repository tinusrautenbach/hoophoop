'use client';

import React from 'react';
import * as Clerk from '@clerk/nextjs';
import * as Mock from './mock-auth';

const useMock = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true' ||
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes('replace_me');

export function AuthProvider({ children }: { children: React.ReactNode }) {
    if (useMock) return <Mock.ClerkProvider>{children}</Mock.ClerkProvider>;
    return <Clerk.ClerkProvider>{children}</Clerk.ClerkProvider>;
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

export function useAuth() {
    // Hooks must be called unconditionally at the top level, 
    // but we can return different results based on the flag.
    const realAuth = Clerk.useAuth();
    const mockAuth = Mock.useAuth();
    
    return useMock ? mockAuth : realAuth;
}
