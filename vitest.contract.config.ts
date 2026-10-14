import { defineConfig } from 'vitest/config';

// Testes de contrato: executam o binário já buildado (dist/index.js) como um agente faria.
// Uso: npm run contract
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/contract/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
