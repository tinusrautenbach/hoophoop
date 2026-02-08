'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, SignOutButton } from '@/components/auth-provider';
import { User, Mail, Shield, History, LogOut, ArrowRight, Trophy, School, Globe } from 'lucide-react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type ProfileData = {
    user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        imageUrl: string | null;
    };
    communities: Array<{
        id: string;
        name: string;
        type: string;
        role: string;
    }>;
    activity: Array<{
        id: string;
        action: string;
        resourceType: string;
        resourceId: string;
        createdAt: string;
    }>;
};

export default function ProfilePage() {
    const { userId, isLoaded } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isLoaded && !userId) {
            router.push('/');
            return;
        }

        if (userId) {
            fetch('/api/profile')
                .then(res => res.json())
                .then(data => {
                    setData(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Failed to load profile:', err);
                    setLoading(false);
                });
        }
    }, [userId, isLoaded, router]);

    if (!isLoaded || loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header / User Info */}
                <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 sm:p-10 flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                    
                    <div className="relative">
                        {data.user.imageUrl ? (
                            <img src={data.user.imageUrl} alt="Profile" className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl object-cover ring-4 ring-orange-500/20 shadow-xl" />
                        ) : (
                            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-slate-800 flex items-center justify-center text-4xl font-black text-slate-600 ring-4 ring-white/5 shadow-xl">
                                {data.user.firstName?.[0] || 'U'}
                            </div>
                        )}
                        <div className="absolute -bottom-2 -right-2 bg-orange-600 p-2 rounded-xl shadow-lg">
                            <User size={16} />
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left space-y-2">
                        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">
                            {data.user.firstName} {data.user.lastName}
                        </h1>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                                <Mail size={16} className="text-orange-500/60" />
                                {data.user.email}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                                <Shield size={16} className="text-orange-500/60" />
                                ID: {data.user.id.substring(0, 12)}...
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-auto">
                        <SignOutButton>
                            <button className="w-full md:w-auto bg-slate-800 hover:bg-red-950/30 hover:text-red-500 border border-slate-700 hover:border-red-500/30 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 group">
                                <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
                                Logout
                            </button>
                        </SignOutButton>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* My Communities */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 px-2 flex items-center gap-2">
                            <Trophy size={16} className="text-orange-500" />
                            My Communities
                        </h2>
                        <div className="space-y-3">
                            {data.communities.length > 0 ? (
                                data.communities.map((community) => (
                                    <Link key={community.id} href={`/communities/${community.id}`}>
                                        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:border-orange-500/50 transition-all group cursor-pointer flex items-center justify-between shadow-lg">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                                                    {community.type === 'school' ? <School size={20} /> : <Globe size={20} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm uppercase tracking-tight">{community.name}</div>
                                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">{community.role}</div>
                                                </div>
                                            </div>
                                            <ArrowRight size={16} className="text-slate-700 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="bg-slate-900/50 border border-dashed border-slate-800 p-10 rounded-3xl text-center space-y-4">
                                    <p className="text-slate-500 text-sm italic">No communities joined yet.</p>
                                    <Link href="/communities/create">
                                        <button className="text-orange-500 font-black uppercase tracking-widest text-xs hover:text-orange-400">
                                            Create One &rarr;
                                        </button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 px-2 flex items-center gap-2">
                            <History size={16} className="text-blue-500" />
                            Recent Activity
                        </h2>
                        <div className="bg-slate-900/40 border border-slate-800 rounded-[32px] overflow-hidden">
                            <div className="divide-y divide-slate-800">
                                {data.activity.length > 0 ? (
                                    data.activity.map((item) => (
                                        <div key={item.id} className="p-4 flex items-start gap-4">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-300">
                                                    <span className="text-blue-400 uppercase tracking-widest text-[10px]">{item.action.replace(/_/g, ' ')}</span>
                                                    <span className="text-slate-600 mx-2">•</span>
                                                    {item.resourceType} {item.resourceId.substring(0, 8)}
                                                </p>
                                                <p className="text-[10px] text-slate-500 font-mono mt-1">
                                                    {new Date(item.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-10 text-center text-slate-500 text-sm italic">
                                        No recent activity recorded.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
