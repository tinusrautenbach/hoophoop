'use client';

import { clsx, type ClassValue } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Repeat } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import type { LastScorerState } from '@/lib/types/scorer-ui';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface QuickRepeatButtonProps {
    lastScorer: LastScorerState;
    onQuickRepeat: () => void;
    className?: string;
}

export function QuickRepeatButton({ lastScorer, onQuickRepeat, className }: QuickRepeatButtonProps) {
    if (!lastScorer.playerId || !lastScorer.playerName) return null;

    const teamColor = lastScorer.team === 'home' ? 'bg-orange-500/20 border-orange-500/50 text-orange-500' : 'bg-slate-500/20 border-slate-400/50 text-slate-300';

    return (
        <AnimatePresence>
            <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                onClick={onQuickRepeat}
                className={cn(
                    'fixed bottom-24 left-1/2 -translate-x-1/2 z-50',
                    'flex items-center gap-2 px-4 py-3 rounded-full',
                    'border-2 shadow-lg shadow-black/20',
                    'active:scale-95 transition-all',
                    teamColor,
                    'landscape:bottom-4 landscape:right-4 landscape:left-auto landscape:translate-x-0',
                    className
                )}
            >
                <Repeat size={18} />
                <span className="font-bold text-sm whitespace-nowrap">
                    Score Again: #{lastScorer.playerName} ({lastScorer.points}pt)
                </span>
            </motion.button>
        </AnimatePresence>
    );
}