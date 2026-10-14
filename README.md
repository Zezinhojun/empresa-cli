# VOX CLI

CLI da Vox Tecnologia para centralizar e padronizar tarefas operacionais de desenvolvimento
(deploy, docker, setup de ambiente, banco de dados, configuração de projetos) num único ponto,
em vez de scripts dispersos.

> **Status:** pré-1.0 em construção. O pacote ainda não foi publicado no npm; veja
> [docs/RELEASING.md](docs/RELEASING.md) para o processo de publicação.

## Requisitos

- Node.js **20 a 24** (LTS)
- Windows, Linux ou macOS (testado no CI nos três)

## Instalação

```bash
npm install -g cli-vox          # produção (dist-tag latest)
npm install -g cli-vox@staging  # pré-release para validação
```

## Uso

```bash
vox                    # menu interativo
vox <comando> [args]   # executa um comando direto
vox --help             # lista comandos e opções
vox --version
```

| Comando       | O que faz                                                                              |
| ------------- | -------------------------------------------------------------------------------------- |
| `menu`        | Menu interativo com os comandos disponíveis (com opção "Sair")                         |
| `list-vox`    | Lista o conteúdo de `~/vox/arquitetura` (aceita uma subpasta: `vox list-vox services`) |
| `top-memory`  | Lista os 10 processos que mais consomem memória (PowerShell / `ps`)                    |
| `list`        | Lista os comandos (`--json`: catálogo com argumentos e risco)                          |
| `agent-guide` | Guia de uso para agentes de IA (`--json`: guia + contrato + catálogo)                  |
| `doctor`      | Confere se o computador tem Node, Bash e Python e ensina a instalar o que faltar       |

Comando inexistente imprime uma dica e sai com código `2`.

## Scripts (`.sh`, `.py`, `.js`)

Cada pasta de [`vox-scripts/`](vox-scripts/README.md) vira um comando: `vox <nome>`. Quem usa não precisa saber
se o script é Bash, Python ou Node: a `vox` descobre como executar, confere se o computador tem o que é
preciso (`vox doctor`) e, se o script altera ou apaga coisas, **pergunta antes**. Os scripts viajam dentro do
pacote npm, então passam por PR e CI como o resto do código. Como criar um: [vox-scripts/README.md](vox-scripts/README.md).

## Uso por agentes de IA (Claude Code, Codex etc.)

A `vox` foi desenhada para ser chamada também por agentes, como subprocesso:

- `vox agent-guide` (ou `--json`) imprime o guia e o catálogo de comandos — o agente aprende a usar a CLI sem ver este repositório.
- `vox list --json` descobre os comandos, os argumentos e o **risco** de cada um (`read`, `write`, `destructive`).
- Com `--json`, `stdout` tem **uma linha de JSON** e nada mais; erros também (`ok: false`, `error.code`), com `stderr` vazio.
- Sem terminal, a CLI **nunca abre prompt nem menu**: pedidos de confirmação falham com código `4` até receberem `--yes`.
- Códigos de saída estáveis: `0` ok · `1` erro · `2` uso inválido · `3` dependência ausente · `4` confirmação · `130` interrompido.

Contrato completo em [docs/cli-contract.md](docs/cli-contract.md) e guia rápido em [docs/agent-guide.md](docs/agent-guide.md)
(inclui um trecho pronto para colar no `CLAUDE.md`/`AGENTS.md` do seu projeto).

## Desenvolvimento

```bash
npm ci
npm run dev -- --help   # builda (tsup) e roda a CLI com os argumentos
```

| Script              | Função                                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| `npm run build`     | Gera `dist/index.js` (tsup, ESM, com shebang)                           |
| `npm test`          | Testes (vitest). `test:coverage` / `test:ci` geram cobertura (mín. 80%) |
| `npm run typecheck` | `tsc --noEmit`                                                          |
| `npm run lint`      | ESLint (`lint:fix` corrige)                                             |
| `npm run smoke`     | Build → `npm pack` → instala o tarball → executa a CLI instalada        |

Para adicionar um comando: crie `src/commands/XCommand.ts` implementando `Command`
(`src/core/command/Command.ts`), registre-o no fim do arquivo com
`CommandRegistry.getInstance().register(...)` e importe-o em `src/commands/index.ts`.
O teste `src/commands/index.test.ts` lista os comandos esperados.

Stack: TypeScript (ESM / NodeNext), [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js),
chalk, execa, tsup, vitest.

## Contribuindo e releases

- Fluxo de branches, commits e PRs: [CONTRIBUTING.md](CONTRIBUTING.md)
- Publicação (staging → produção), validação e rollback: [docs/RELEASING.md](docs/RELEASING.md)
- Decisões de arquitetura: [docs/adr/](docs/adr/)

## Licença

[MIT](LICENSE)
