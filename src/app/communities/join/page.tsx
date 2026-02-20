'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { CheckCircle, AlertCircle } from 'lucide-react';

function JoinContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const { userId } = useAuth();
    
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [error, setError] = useState('');


    useEffect(() => {
        if (!token || !userId) return;

        fetch('/api/communities/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        })
        .then(async (res) => {
            if (res.ok) {
                const data = await res.json();
                setStatus('success');
                setTimeout(() => router.push(`/communities/${data.communityId}`), 2000);
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to join community');
                setStatus('error');
            }
        })
        .catch(() => {
            setError('Network error');
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
                    <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Joining Community...</h1>
                    <p className="text-slate-500">Verifying your invite token.</p>
                </>
            )}

            {status === 'success' && (
                <>
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
                        <CheckCircle size={32} className="text-green-500" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Welcome Aboard!</h1>
                    <p className="text-slate-500">You successfully joined the community.</p>
                    <p className="text-xs text-slate-600 mt-4 uppercase font-bold tracking-widest">Redirecting...</p>
                </>
            )}

            {status === 'error' && (
                <>
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                        <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Unable to Join</h1>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <button 
                        onClick={() => router.push('/communities')}
                        className="bg-card hover:bg-muted text-white px-6 py-3 rounded-xl font-bold transition-colors"
                    >
                        Back to Communities
                    </button>
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

export default function JoinCommunityPage() {
    return (
        <Suspense fallback={<Loading />}>
            <JoinContent />
        </Suspense>
    );
}
