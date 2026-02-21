'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Trophy, User, ArrowLeft, Shield } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type ClaimRequest = {
    id: string;
    athleteId: string;
    userId: string;
    status: string;
    requestedAt: string;
    athlete: {
        id: string;
        name: string;
        firstName: string | null;
        surname: string | null;
    } | null;
    claimant: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
    } | null;
    community: {
        id: string;
        name: string;
    } | null;
};

type ClaimApiItem = {
    id: string;
    athleteId: string;
    userId: string;
    status: string;
    requestedAt: string;
};

type UserApiItem = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
};

export default function CommunityApproveClaimPage({ 
    params 
}: { 
    params: Promise<{ communityId: string; requestId: string }> 
}) {
    const router = useRouter();
    const [communityId, setCommunityId] = useState<string>('');
    const [requestId, setRequestId] = useState<string>('');
    const [claim, setClaim] = useState<ClaimRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        params.then(p => {
            setCommunityId(p.communityId);
            setRequestId(p.requestId);
            fetchClaim(p.communityId, p.requestId);
        });
    }, [params]);

    const fetchClaim = async (commId: string, reqId: string) => {
        try {
            // Get claim request details from the community API
            const res = await fetch(`/api/admin/communities/${commId}/claim-requests?status=pending`);
            if (res.status === 403) {
                setError('unauthorized');
                return;
            }
            if (!res.ok) {
                setError('Failed to fetch claim request');
                return;
            }

            const data = await res.json();
            const claimRequest = data.claims?.find((c: ClaimApiItem) => c.id === reqId);
            
            if (!claimRequest) {
                setError('Claim request not found');
                return;
            }

            // Fetch athlete details
            const athleteRes = await fetch(`/api/players/${claimRequest.athleteId}`);
            const athlete = athleteRes.ok ? await athleteRes.json() : null;

            // Fetch user details from the claim
            const userRes = await fetch(`/api/admin/users`);
            const usersData = userRes.ok ? await userRes.json() : { users: [] };
            const claimant = usersData.users?.find((u: UserApiItem) => u.id === claimRequest.userId);

            setClaim({
                ...claimRequest,
                athlete,
                claimant: {
                    id: claimRequest.userId,
                    firstName: claimant?.firstName || null,
                    lastName: claimant?.lastName || null,
                    email: claimant?.email || 'Unknown'
                }
            });
        } catch (err) {
            console.error(err);
            setError('Failed to load claim request');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!confirm('Are you sure you want to approve this claim request?')) return;
        
        setProcessing(true);
        try {
            const res = await fetch(`/api/admin/communities/${communityId}/claim-requests/${requestId}`, {
                method: 'POST',
            });

            if (res.ok) {
                setSuccess(true);
            } else if (res.status === 403) {
                setError('unauthorized');
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to approve claim');
            }
        } catch (err) {
            console.error(err);
            setError('Failed to approve claim');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error === 'unauthorized') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <Shield size={64} className="text-red-500 mb-4" />
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Access Denied</h1>
                <p className="text-slate-500">You must be a community admin to approve claims.</p>
                <button onClick={() => router.push('/')} className="mt-6 text-orange-500 hover:text-white font-bold">
                    Return Home
                </button>
            </div>
        );
    }

    if (error && error !== 'unauthorized') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <X size={64} className="text-red-500 mb-4" />
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Error</h1>
                <p className="text-slate-500">{error}</p>
                <button onClick={() => router.push(`/communities/${communityId}`)} className="mt-6 text-orange-500 hover:text-white font-bold">
                    Return to Community
                </button>
            </div>
        );
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                    <Check size={40} className="text-green-500" />
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Claim Approved!</h1>
                <p className="text-slate-500 mb-8 max-w-md">
                    The player profile has been successfully linked to the claimant&apos;s account. An email notification has been sent.
                </p>
                <button 
                    onClick={() => router.push('/admin')}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest transition-all"
                >
                    Return to Admin Dashboard
                </button>
            </div>
        );
    }

    if (!claim) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <X size={64} className="text-red-500 mb-4" />
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Not Found</h1>
                <p className="text-slate-500">Claim request not found or has already been processed.</p>
                <button onClick={() => router.push(`/communities/${communityId}`)} className="mt-6 text-orange-500 hover:text-white font-bold">
                    Return to Community
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button 
                    onClick={() => router.push('/admin')} 
                    className="p-2 hover:bg-card rounded-full transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <Shield className="text-blue-500" />
                        Approve Profile Claim
                    </h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">
                        Community Admin - Review and approve player profile claim
                    </p>
                </div>
            </div>

            {/* Community Info */}
            {claim.community && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-blue-400 font-bold">
                        <Shield size={18} />
                        {claim.community.name}
                    </div>
                </div>
            )}

            {/* Claim Details */}
            <div className="bg-input border border-border rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Trophy className="text-yellow-500" />
                        Claim Request Details
                    </h2>
                </div>

                <div className="p-6 space-y-6">
                    {/* Player Details */}
                    <div className="bg-card border border-border rounded-xl p-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Player Profile</h3>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 font-black text-2xl">
                                {claim.athlete?.firstName?.[0] || claim.athlete?.name?.[0] || '?'}
                            </div>
                            <div>
                                <div className="text-xl font-black">{claim.athlete?.name || 'Unknown Player'}</div>
                                <div className="text-sm text-slate-400">
                                    {claim.athlete?.firstName} {claim.athlete?.surname}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">ID: {claim.athleteId}</div>
                            </div>
                        </div>
                    </div>

                    {/* Claimant Details */}
                    <div className="bg-card border border-border rounded-xl p-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Claimant</h3>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                                <User size={24} />
                            </div>
                            <div>
                                <div className="font-bold">{claim.claimant?.firstName} {claim.claimant?.lastName}</div>
                                <div className="text-sm text-slate-400">{claim.claimant?.email}</div>
                                <div className="text-xs text-slate-500 mt-1">User ID: {claim.userId}</div>
                            </div>
                        </div>
                    </div>

                    {/* Request Info */}
                    <div className="bg-card border border-border rounded-xl p-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Request Information</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-slate-500">Request ID</div>
                                <div className="font-mono text-xs">{claim.id}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">Requested At</div>
                                <div>{new Date(claim.requestedAt).toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">Status</div>
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase bg-yellow-500/20 text-yellow-500">
                                    {claim.status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
                <button
                    onClick={handleApprove}
                    disabled={processing}
                    className={cn(
                        "flex-1 bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                        processing && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {processing ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Check size={20} />
                            Approve Claim
                        </>
                    )}
                </button>
                <button
                    onClick={() => router.push(`/admin/communities/${communityId}/claim-requests/${requestId}/reject`)}
                    className="px-6 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold uppercase tracking-widest transition-all"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
}
