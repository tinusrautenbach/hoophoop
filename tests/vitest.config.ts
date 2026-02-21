import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        include: ['**/*.test.ts', '**/*.test.tsx'],
        exclude: [
            '**/node_modules/**',
            '**/tests/load/**', // Exclude load tests - they should be run manually
            '**/__tests__/integration.test.ts', // Exclude integration tests - they require running server
        ],
        reporters: ['default', path.resolve(__dirname, 'markdown-reporter.ts')],
        alias: {
            '@': path.resolve(__dirname, '../src'),
        },
    },
});
