import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { AuthProvider, SignedIn, SignedOut, UserButton, SignInButton } from '@/components/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggleIcon } from '@/components/theme-toggle'
import Link from 'next/link'
import { syncUser } from "@/lib/auth-server";
import { auth } from "@/lib/auth-server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "HoopHoop",
  description: "Double the game. Live the score.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
};

async function getUserTheme(): Promise<'light' | 'dark' | null> {
  try {
    const { userId } = await auth();
    if (!userId) return null;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { theme: true }
    });

    return user?.theme ?? null;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Sync user info with database on every layout load if authenticated
  await syncUser();
  
  // Fetch user's theme preference
  const userTheme = await getUserTheme();

  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ThemeProvider userTheme={userTheme}>
            <header className="border-b border-[var(--border)] p-4 flex justify-between items-center bg-[var(--card)]/50 backdrop-blur-md sticky top-0 z-50">
              <Link href="/" className="flex items-center gap-2">
                <div className="relative w-8 h-8">
                  <img src="/logo.svg" alt="HoopHoop Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent italic">
                  HOOPHOOP
                </span>
              </Link>
              <nav className="flex items-center gap-6">
                <SignedIn>
                  <Link href="/teams" className="text-sm font-medium hover:text-[var(--accent)] transition-colors text-[var(--foreground)]">Teams</Link>
                  <Link href="/games" className="text-sm font-medium hover:text-[var(--accent)] transition-colors text-[var(--foreground)]">Games</Link>
                  <Link href="/communities" className="text-sm font-medium hover:text-[var(--accent)] transition-colors text-[var(--foreground)]">Communities</Link>
                  <Link href="/profile" className="text-sm font-medium hover:text-[var(--accent)] transition-colors text-[var(--foreground)]">Profile</Link>
                  <ThemeToggleIcon />
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <ThemeToggleIcon />
                  <SignInButton mode="modal">
                    <button className="text-sm font-medium bg-orange-600 px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-white">Sign In</button>
                  </SignInButton>
                </SignedOut>
              </nav>
            </header>
            <main className="flex-1">
              {children}
            </main>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
