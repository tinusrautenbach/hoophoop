'use client';

import { useTheme } from '@/components/theme-provider';
import { Sun, Moon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ThemeToggleProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'ghost' | 'outline';
}

export function ThemeToggle({ 
    className, 
    size = 'md',
    variant = 'default' 
}: ThemeToggleProps) {
    const { theme, toggleTheme } = useTheme();

    const sizeClasses = {
        sm: 'p-1.5',
        md: 'p-2',
        lg: 'p-3',
    };

    const iconSizes = {
        sm: 16,
        md: 20,
        lg: 24,
    };

    const variantClasses = {
        default: 'bg-card hover:bg-muted text-slate-300 hover:text-white border border-border',
        ghost: 'hover:bg-card text-slate-400 hover:text-white',
        outline: 'border border-border hover:border-slate-500 text-slate-400 hover:text-white',
    };

    return (
        <button
            onClick={toggleTheme}
            className={cn(
                'rounded-lg transition-all duration-200 flex items-center gap-2',
                sizeClasses[size],
                variantClasses[variant],
                className
            )}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {theme === 'dark' ? (
                <>
                    <Moon size={iconSizes[size]} className="text-orange-400" />
                    <span className="text-sm font-medium hidden sm:inline">Dark</span>
                </>
            ) : (
                <>
                    <Sun size={iconSizes[size]} className="text-orange-500" />
                    <span className="text-sm font-medium hidden sm:inline">Light</span>
                </>
            )}
        </button>
    );
}

// Simple icon-only version for compact spaces
export function ThemeToggleIcon({ className, size = 20 }: { className?: string; size?: number }) {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={cn(
                'p-2 rounded-lg transition-colors hover:bg-card text-slate-400 hover:text-white',
                className
            )}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {theme === 'dark' ? (
                <Moon size={size} className="text-orange-400" />
            ) : (
                <Sun size={size} className="text-orange-500" />
            )}
        </button>
    );
}
