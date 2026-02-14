'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useThemeStore } from '@/lib/theme-store';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}

interface ThemeProviderProps {
    children: ReactNode;
    userTheme?: Theme | null;
}

export function ThemeProvider({ children, userTheme }: ThemeProviderProps) {
    const { theme, setTheme, toggleTheme, initializeTheme } = useThemeStore();

    useEffect(() => {
        initializeTheme(userTheme ?? null);
    }, [userTheme, initializeTheme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
