import { defineConfig } from 'tsup';

export default defineConfig({
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
  entry: ['src/index.ts'],
  format: ['esm'],
  loader: { '.md': 'text' },
  sourcemap: false,
  splitting: false,
  target: 'node20',
});
