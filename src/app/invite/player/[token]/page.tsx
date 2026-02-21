'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, SignInButton, SignUpButton } from '@clerk/nextjs';
import { Check, X, Loader2, User, Trophy } from 'lucide-react';
import Link from 'next/link';

type Invitation = {
  athlete: {
    name: string;
  } | null;
  email: string;
  expiresAt: string;
};

type InvitationResponse = {
  error?: string;
  athlete?: {
    name: string;
  };
  email?: string;
  expiresAt?: string;
};

export default function PlayerInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
    const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch invitation details
    fetch(`/api/players/invitations/${token}`)
      .then(res => res.json())
      .then((data: InvitationResponse) => {
        if (data.error) {
          setError(data.error);
        } else if (data.email && data.expiresAt) {
          setInvitation({
            athlete: data.athlete || null,
            email: data.email,
            expiresAt: data.expiresAt
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load invitation');
        setLoading(false);
      });
  }, [token]);

  const handleAccept = async () => {
    if (!isSignedIn) return;
    
    setAccepting(true);
    try {
      const res = await fetch(`/api/players/invitations/${token}/accept`, {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/profile');
        }, 2000);
      } else {
        setError(data.error || 'Failed to accept invitation');
      }
    } catch {
      setError('Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Invitation Error</h1>
          <p className="text-[var(--muted-foreground)] mb-6">{error}</p>
          <Link href="/">
            <button className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3 rounded-xl transition-all">
              Go Home
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Profile Claimed!</h1>
          <p className="text-[var(--muted-foreground)] mb-6">
            Your player profile has been successfully linked to your account.
          </p>
          <Link href="/profile">
            <button className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3 rounded-xl transition-all">
              View Profile
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight mb-2">
            Claim Your Profile
          </h1>
          <p className="text-[var(--muted-foreground)]">
            You&apos;ve been invited to link your player profile to your Hoophoop account.
          </p>
        </div>

        {invitation?.athlete && (
          <div className="bg-[var(--muted)] rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <div className="font-bold text-lg">{invitation.athlete.name}</div>
                <div className="text-sm text-[var(--muted-foreground)]">Player Profile</div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-500 text-sm">
            {error}
          </div>
        )}

        {!isSignedIn ? (
          <div className="space-y-4">
            <p className="text-center text-[var(--muted-foreground)] text-sm mb-4">
              Sign in or create an account to claim your profile
            </p>
            <SignInButton mode="modal">
              <button className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl transition-all">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="w-full bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] font-bold py-4 rounded-xl transition-all">
                Create Account
              </button>
            </SignUpButton>
          </div>
        ) : (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {accepting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Claiming...
              </>
            ) : (
              'Claim Profile'
            )}
          </button>
        )}

        <div className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
          <p>This invitation was sent to: {invitation?.email}</p>
          <p className="mt-1">Expires: {invitation?.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString() : 'Unknown'}</p>
        </div>
      </div>
    </div>
  );
}
