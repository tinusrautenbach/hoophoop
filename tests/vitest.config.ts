import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        include: ['**/*.test.ts', '**/*.test.tsx'],
        reporters: ['default', './tests/markdown-reporter.ts'],
        alias: {
            '@': path.resolve(__dirname, '../src'),
        },
    },
});
