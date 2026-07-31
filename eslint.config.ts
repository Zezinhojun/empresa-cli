import pluginImport from 'eslint-plugin-import';
import pluginN from 'eslint-plugin-n';
import perfectionist from 'eslint-plugin-perfectionist';
import pluginPromise from 'eslint-plugin-promise';
import pluginSecurity from 'eslint-plugin-security';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import * as tseslint from 'typescript-eslint';

export default defineConfig([
  /* =========================================================
   * TYPE SCRIPT LAYER (CLI CORE)
   * Regras principais para código TypeScript da CLI VOX
   * ========================================================= */
  {
    // Base recomendada do TypeScript ESLint
    extends: [tseslint.configs.recommended],

    files: ['**/*.{ts,mts,cts}'],

    languageOptions: {
      // Ambiente Node (CLI roda no terminal, não no browser)
      globals: globals.node,
    },

    plugins: {
      import: pluginImport, // Validação de imports e dependências
      n: pluginN, // Regras específicas do Node.js
      perfectionist, // Organização de imports e objetos
      promise: pluginPromise, // Garantia de uso correto de async/await
      security: pluginSecurity, // Detecção de padrões inseguros
    },

    settings: {
      // <--
      'import/resolver': {
        typescript: createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: './tsconfig.json',
        }),
      },
    },

    rules: {
      '@typescript-eslint/consistent-type-imports': 'error', // imports mais seguros
      /* =========================================================
       * TYPESCRIPT SAFETY (evita bugs silenciosos)
       * ========================================================= */
      '@typescript-eslint/no-explicit-any': 'warn', // evita tipagem fraca
      /* =========================================================
       * ASYNC SAFETY (CRÍTICO para CLI)
       * Evita CLI "rodar e falhar silenciosamente"
       * ========================================================= */
      '@typescript-eslint/no-floating-promises': 'off',

      '@typescript-eslint/no-unused-vars': 'warn', // evita código morto
      'import/no-cycle': 'error', // evita dependência circular

      /* =========================================================
       * IMPORT SAFETY (arquitetura limpa)
       * ========================================================= */
      'import/no-unresolved': 'error', // evita paths inválidos
      /* =========================================================
       * NODE SAFETY (CLI / runtime)
       * ========================================================= */
      'n/no-missing-import': 'error', // impede import quebrado

      'n/no-unsupported-features/es-syntax': 'error', // evita syntax incompatível com Node

      /* =========================================================
       * CLI FRIENDLY SETTINGS
       * ========================================================= */
      'no-console': 'off', // CLI precisa de logs
      /* =========================================================
       * CODE ORGANIZATION (qualidade de leitura)
       * ========================================================= */
      'perfectionist/sort-imports': 'warn',

      'perfectionist/sort-objects': 'warn',
      /* =========================================================
       * SECURITY (execução de comandos shell)
       * Importante porque CLI executa automações reais
       * ========================================================= */
      'security/detect-child-process': 'warn',

      'security/detect-eval-with-expression': 'error',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '*.log',
      '.env*',
      '.vscode/**',
      '.idea/**',
      'eslint.config.ts',
    ],
  },
]);
