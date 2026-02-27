'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, Trash2, Shield, Eye, ShieldAlert, Mail, Link2, Copy, CheckCheck } from 'lucide-react';
import QRCode from 'react-qr-code';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type Scorer = {
    id: string;
    userId: string;
    role: 'owner' | 'co_scorer' | 'viewer';
    joinedAt: string;
};

interface ScorerManagerProps {
    gameId: string;
    ownerId: string;
    currentUserId?: string | null;
    scorers: Scorer[];
    isOpen: boolean;
    onClose: () => void;
    // Kept for backward compat — no longer called (invite flow replaces direct add)
    onAddScorer?: (userId: string) => void;
    onRemoveScorer: (scorerId: string) => void;
}

type InviteTab = 'email' | 'link';

export function ScorerManager({
    gameId,
    ownerId,
    currentUserId,
    scorers,
    isOpen,
    onClose,
    onRemoveScorer,
}: ScorerManagerProps) {
    const [activeTab, setActiveTab] = useState<InviteTab>('email');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'co_scorer' | 'viewer'>('co_scorer');
    const [inviteLink, setInviteLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [sending, setSending] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const isOwner = currentUserId === ownerId;

    const resetFeedback = () => setFeedback(null);

    const handleInviteByEmail = async () => {
        if (!email.trim()) {
            setFeedback({ type: 'error', message: 'Please enter an email address.' });
            return;
        }
        setSending(true);
        resetFeedback();
        try {
            const res = await fetch(`/api/games/${gameId}/scorer-invites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), role }),
            });
            const data = await res.json();
            if (res.ok) {
                setFeedback({ type: 'success', message: `Invite sent to ${email.trim()}!` });
                setEmail('');
                setInviteLink(data.inviteLink);
            } else {
                setFeedback({ type: 'error', message: data.error || 'Failed to send invite.' });
            }
        } catch {
            setFeedback({ type: 'error', message: 'Network error. Please try again.' });
        } finally {
            setSending(false);
        }
    };

    const handleGenerateLink = async () => {
        setSending(true);
        resetFeedback();
        try {
            const res = await fetch(`/api/games/${gameId}/scorer-invites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            const data = await res.json();
            if (res.ok) {
                setInviteLink(data.inviteLink);
                setFeedback({ type: 'success', message: 'Share link generated!' });
            } else {
                setFeedback({ type: 'error', message: data.error || 'Failed to generate link.' });
            }
        } catch {
            setFeedback({ type: 'error', message: 'Network error. Please try again.' });
        } finally {
            setSending(false);
        }
    };

    const handleCopy = async () => {
        if (!inviteLink) return;
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[150] bg-background/90 backdrop-blur-xl flex items-center justify-center p-6"
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-input border border-white/10 rounded-[32px] p-8 max-w-md w-full relative shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <Users size={24} className="text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tight">Game Scorers</h3>
                                <p className="text-slate-500 text-sm">Manage who can control this game</p>
                            </div>
                        </div>

                        {/* Invite Section — owner only */}
                        {isOwner && (
                            <div className="mb-8">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 block">
                                    Invite a Scorer
                                </label>

                                {/* Tab selector */}
                                <div className="flex gap-1 bg-background/60 rounded-xl p-1 mb-4">
                                    <button
                                        onClick={() => { setActiveTab('email'); resetFeedback(); }}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2 rounded-lg transition-colors',
                                            activeTab === 'email'
                                                ? 'bg-blue-600 text-white'
                                                : 'text-slate-400 hover:text-white'
                                        )}
                                    >
                                        <Mail size={13} /> Email
                                    </button>
                                    <button
                                        onClick={() => { setActiveTab('link'); resetFeedback(); }}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2 rounded-lg transition-colors',
                                            activeTab === 'link'
                                                ? 'bg-blue-600 text-white'
                                                : 'text-slate-400 hover:text-white'
                                        )}
                                    >
                                        <Link2 size={13} /> Share Link
                                    </button>
                                </div>

                                {/* Role selector (shared) */}
                                <div className="mb-3">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Role</label>
                                    <div className="flex gap-2">
                                        {(['co_scorer', 'viewer'] as const).map((r) => (
                                            <button
                                                key={r}
                                                onClick={() => setRole(r)}
                                                className={cn(
                                                    'flex-1 text-xs font-bold py-2 rounded-lg border transition-colors capitalize',
                                                    role === r
                                                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                                        : 'border-border text-slate-500 hover:text-white'
                                                )}
                                            >
                                                {r.replace('_', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Email tab */}
                                {activeTab === 'email' && (
                                    <div className="space-y-3">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleInviteByEmail()}
                                            placeholder="scorer@example.com"
                                            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                        <button
                                            onClick={handleInviteByEmail}
                                            disabled={sending}
                                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Mail size={16} />
                                            {sending ? 'Sending...' : 'Send Invite'}
                                        </button>
                                    </div>
                                )}

                                {/* Share link tab */}
                                {activeTab === 'link' && (
                                    <div className="space-y-3">
                                        <button
                                            onClick={handleGenerateLink}
                                            disabled={sending}
                                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Link2 size={16} />
                                            {sending ? 'Generating...' : 'Generate Link'}
                                        </button>
                                        {inviteLink && (
                                            <div className="space-y-3">
                                                <div className="bg-background/60 rounded-xl p-3 flex items-center gap-2">
                                                    <p className="text-[10px] text-slate-400 font-mono truncate flex-1">{inviteLink}</p>
                                                    <button
                                                        onClick={handleCopy}
                                                        className="p-2 text-slate-400 hover:text-white transition-colors shrink-0"
                                                        title="Copy link"
                                                    >
                                                        {copied ? <CheckCheck size={16} className="text-green-400" /> : <Copy size={16} />}
                                                    </button>
                                                </div>
                                                <div className="flex justify-center bg-white rounded-xl p-4">
                                                    <QRCode value={inviteLink} size={140} />
                                                </div>
                                                <p className="text-[10px] text-slate-500 text-center">Link valid for 7 days</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Feedback */}
                                {feedback && (
                                    <p className={cn(
                                        'text-xs mt-2',
                                        feedback.type === 'success' ? 'text-green-400' : 'text-red-400'
                                    )}>
                                        {feedback.message}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Scorers List */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1">
                                Authorized Users
                            </label>

                            {/* Owner */}
                            <div className="bg-background/50 border border-yellow-500/20 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Shield size={16} className="text-yellow-500" />
                                    <div>
                                        <div className="font-bold text-sm">Owner</div>
                                        <div className="text-[10px] text-slate-500 font-mono">{ownerId}</div>
                                    </div>
                                </div>
                                {currentUserId === ownerId && (
                                    <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded">YOU</span>
                                )}
                            </div>

                            {/* Co-Scorers */}
                            {scorers.map((scorer) => (
                                <div key={scorer.id} className="bg-background/50 border border-border rounded-xl p-4 flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        {scorer.role === 'viewer' ? (
                                            <Eye size={16} className="text-slate-500" />
                                        ) : (
                                            <ShieldAlert size={16} className="text-blue-500" />
                                        )}
                                        <div>
                                            <div className="font-bold text-sm capitalize">{scorer.role.replace('_', ' ')}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{scorer.userId}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {scorer.userId === currentUserId && (
                                            <span className="text-[10px] font-bold bg-card text-slate-400 px-2 py-1 rounded">YOU</span>
                                        )}
                                        {isOwner && (
                                            <button
                                                onClick={() => onRemoveScorer(scorer.id)}
                                                className="p-2 text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {scorers.length === 0 && (
                                <div className="text-center py-4 text-slate-500 text-xs italic">
                                    No other scorers added yet.
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
