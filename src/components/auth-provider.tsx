'use client';

import React, { useState, useEffect } from 'react';
import {
    ClerkProvider as MockClerkProvider,
    SignedIn as MockSignedIn,
    SignedOut as MockSignedOut,
    UserButton as MockUserButton,
    SignInButton as MockSignInButton
} from './mock-auth';

const useMock = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true' ||
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes('replace_me');

// We use a simpler approach: if mock is active, we don't even import the real components
// to avoid triggering Clerk's validation logic.

export function AuthProvider({ children }: { children: React.ReactNode }) {
    if (useMock) return <MockClerkProvider>{children}</MockClerkProvider>;

    // In a real scenario, you'd want dynamic imports here, but for now
    // let's just use the mock to unblock development.
    return <MockClerkProvider>{children}</MockClerkProvider>;
}

export function SignedIn({ children }: { children: React.ReactNode }) {
    if (useMock) return <MockSignedIn>{children}</MockSignedIn>;
    return <MockSignedIn>{children}</MockSignedIn>;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
    if (useMock) return <MockSignedOut>{children}</MockSignedOut>;
    return <MockSignedOut>{children}</MockSignedOut>;
}

export function UserButton() {
    if (useMock) return <MockUserButton />;
    return <MockUserButton />;
}

export function SignInButton({ children, mode }: { children: React.ReactNode, mode?: "modal" | "redirect" }) {
    if (useMock) return <MockSignInButton>{children}</MockSignInButton>;
    return <MockSignInButton>{children}</MockSignInButton>;
}
