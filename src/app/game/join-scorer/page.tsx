'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { CheckCircle, AlertCircle } from 'lucide-react';

function JoinScorerContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const { userId } = useAuth();

    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [error, setError] = useState('');
    const [gameId, setGameId] = useState<string | null>(null);

    // If not logged in, redirect to sign-up preserving the token
    useEffect(() => {
        if (userId === undefined) return; // auth not yet resolved
        if (!token) return;

        if (!userId) {
            // Force sign-up (or sign-in) first, then come back here
            const redirectUrl = encodeURIComponent(`/game/join-scorer?token=${token}`);
            router.push(`/sign-up?redirect_url=${redirectUrl}`);
        }
    }, [userId, token, router]);

    // Once logged in and token present, accept the invite
    useEffect(() => {
        if (!token || !userId) return;

        fetch(`/api/games/scorer-invite/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
            .then(async (res) => {
                const data = await res.json();
                if (res.ok) {
                    setGameId(data.gameId);
                    setStatus('success');
                    setTimeout(() => router.push(`/game/${data.gameId}/scorer`), 2000);
                } else {
                    setError(data.error || 'Failed to accept invite');
                    setStatus('error');
                }
            })
            .catch(() => {
                setError('Network error. Please try again.');
                setStatus('error');
            });
    }, [token, userId, router]);

    if (!token) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle size={32} className="text-red-500" />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Invalid Invite Link</h1>
                <p className="text-slate-500">This invite link is missing a token.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
            {status === 'verifying' && (
                <>
                    <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-6" />
                    <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Joining as Scorer...</h1>
                    <p className="text-slate-500">Verifying your invite token.</p>
                </>
            )}

            {status === 'success' && (
                <>
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
                        <CheckCircle size={32} className="text-green-500" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight mb-2">You&apos;re In!</h1>
                    <p className="text-slate-500">You&apos;ve been added as a scorer for this game.</p>
                    <p className="text-xs text-slate-600 mt-4 uppercase font-bold tracking-widest">Redirecting to scorer panel...</p>
                </>
            )}

            {status === 'error' && (
                <>
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                        <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Unable to Join</h1>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <div className="flex gap-3">
                        {gameId && (
                            <button
                                onClick={() => router.push(`/game/${gameId}/scorer`)}
                                className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl font-bold transition-colors"
                            >
                                Go to Game
                            </button>
                        )}
                        <button
                            onClick={() => router.push('/')}
                            className="bg-card hover:bg-muted text-white px-6 py-3 rounded-xl font-bold transition-colors"
                        >
                            Home
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

function Loading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin mb-6" />
            <p className="text-slate-500">Loading...</p>
        </div>
    );
}

export default function JoinScorerPage() {
    return (
        <Suspense fallback={<Loading />}>
            <JoinScorerContent />
        </Suspense>
    );
}
