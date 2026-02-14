'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
    theme: Theme;
    isHydrated: boolean;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    initializeTheme: (userTheme: Theme | null) => void;
}

const persistThemeToServer = async (theme: Theme) => {
    try {
        await fetch('/api/profile/theme', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme }),
        });
    } catch (error) {
        console.debug('Failed to persist theme to server:', error);
    }
};

const applyThemeToDOM = (theme: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
    } else {
        root.classList.add('light');
        root.classList.remove('dark');
    }
};

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'dark',
            isHydrated: false,
            setTheme: (theme) => {
                set({ theme });
                applyThemeToDOM(theme);
                persistThemeToServer(theme);
            },
            toggleTheme: () => {
                const newTheme = get().theme === 'dark' ? 'light' : 'dark';
                get().setTheme(newTheme);
            },
            initializeTheme: (userTheme) => {
                const storedTheme = get().theme;
                const theme = userTheme || storedTheme || 'dark';
                set({ theme, isHydrated: true });
                applyThemeToDOM(theme);
            },
        }),
        {
            name: 'hoophoop-theme',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.isHydrated = true;
                }
            },
        }
    )
);
