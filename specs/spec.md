# Spec: Testes Unitários — Cobertura Completa

**Iteração:** 3
**Timestamp:** 2026-10-02T05:21:54.377Z

## Contexto
App cli-vox (Node 20-24, ESM, TypeScript, Vitest).
Comandos/core/utils sem testes unitários.
Requisito: Adicionar testes unitários para todos os arquivos da aplicação.

## Requisitos Funcionais
- [x] Testes p/ CommandRegistry (singleton, register, list, get)
- [x] Testes p/ CommandExecutor (execute, not found)
- [x] Testes p/ MenuCommand (loop, select, exit)
- [x] Testes p/ CleanMemoryCommand (win32/unix, confirm) — comando substituído por `top-memory` (TopMemoryCommand.test.ts)
- [x] Testes p/ ListVoxCommand
- [x] Testes p/ VoxHome, VoxArquitetura (paths)
- [x] Testes p/ ListDirectory
- [x] vitest.config.ts com thresholds 80%
- [x] test/setup.ts com mocks globais (execa, inquirer, chalk; `ora` foi removido do projeto)

## Requisitos Não-Funcionais
- Suite < 30s
- Determinísticos (sem flakiness)
- Mocks isolados (afterEach cleanup)
- ESM only, Node 20-24

## Contratos/Interfaces
- vitest.config.ts: coverage lines/branches/functions/statements >= 80
- test/setup.ts: vi.mock para execa, @inquirer/prompts, chalk, ora
- Arquivos *.test.ts ao lado do fonte

## Plano de Implementação


## Critérios de Aceite
- [x] Todos src/**/*.ts com lógica têm *.test.ts (exceções: `Command.ts` só tipos, `index.ts` e `builtins.ts` só reexportam)
- [x] npm test:coverage ≥ 80% em todos thresholds
- [x] npm test passa (0 falhas)
- [x] npm run lint passa
- [x] npm run build passa
- [x] Testes isolados, sem vazamento de mocks

## Arquivos Afetados
- vitest.config.ts
- test/setup.ts
- src/core/command/CommandRegistry.test.ts
- src/core/command/CommandExecutor.test.ts
- src/commands/MenuCommand.test.ts
- src/commands/CleanMemoryCommand.test.ts
- src/commands/ListVoxCommand.test.ts
- src/vox/directories/VoxHome.test.ts
- src/vox/directories/VoxArquitetura.test.ts
- src/core/utils/ListDirectory.test.ts
