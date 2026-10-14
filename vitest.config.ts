import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    coverage: {
      exclude: [
        'node_modules/',
        'dist/',
        'scripts/',
        'specs/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/setup.ts',
        'src/index.ts',
        'src/cli/bootstrap.ts',
      ],
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: 'node',
    globals: true,
    hookTimeout: 10000,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 10000,
  },
});
