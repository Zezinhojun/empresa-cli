import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Os .md importados pelo código viram texto, como no bundle do tsup.
const markdownAsText = {
  name: 'markdown-as-text',
  transform: (code: string, id: string) =>
    id.endsWith('.md') ? { code: `export default ${JSON.stringify(code)};`, map: null } : null,
};

export default defineConfig({
  plugins: [markdownAsText],
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
    include: ['src/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 10000,
  },
});
