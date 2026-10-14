# Spec: Testes Unitários — Cobertura Completa

**Iteração:** 3
**Timestamp:** 2026-10-02T05:21:54.377Z

## Contexto
App cli-vox (Node 20-24, ESM, TypeScript, Vitest).
Comandos/core/utils sem testes unitários.
Requisito: Adicionar testes unitários para todos os arquivos da aplicação.

## Requisitos Funcionais
- [ ] Testes p/ CommandRegistry (singleton, register, list, get)
- [ ] Testes p/ CommandExecutor (execute, not found)
- [ ] Testes p/ MenuCommand (loop, select, exit)
- [ ] Testes p/ CleanMemoryCommand (win32/unix, confirm)
- [ ] Testes p/ ListVoxCommand
- [ ] Testes p/ VoxHome, VoxArquitetura (paths)
- [ ] Testes p/ ListDirectory
- [ ] vitest.config.ts com thresholds 80%
- [ ] test/setup.ts com mocks globais (execa, inquirer, chalk, ora)

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
- [ ] Todos src/**/*.ts têm *.test.ts correspondente
- [ ] npm test:coverage ≥ 80% em todos thresholds
- [ ] npm test passa (0 falhas)
- [ ] npm run lint passa
- [ ] npm run build passa
- [ ] Testes isolados, sem vazamento de mocks

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
