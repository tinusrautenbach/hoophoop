'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface MutationFeedbackProps {
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
    errorMessage?: string;
}

export function MutationFeedback({ isPending, isSuccess, isError, errorMessage }: MutationFeedbackProps) {
    return (
        <AnimatePresence>
            {isPending && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed top-4 right-4 z-50 bg-blue-500/90 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2"
                >
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm font-medium">Saving...</span>
                </motion.div>
            )}
            {isSuccess && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="fixed top-4 right-4 z-50 bg-green-500/90 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2"
                >
                    <Check size={16} />
                    <span className="text-sm font-medium">Saved</span>
                </motion.div>
            )}
            {isError && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="fixed top-4 right-4 z-50 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-lg"
                >
                    <div className="flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span className="text-sm font-medium">{errorMessage || 'Failed to save'}</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export function useMutationFeedback() {
    return {
        getPendingClasses: (isPending: boolean) =>
            isPending ? 'animate-pulse opacity-70' : '',
        
        getSuccessClasses: (isSuccess: boolean) =>
            isSuccess ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-background' : '',
    };
}