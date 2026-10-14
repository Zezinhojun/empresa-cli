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

| Comando      | O que faz                                                                              |
| ------------ | -------------------------------------------------------------------------------------- |
| `menu`       | Menu interativo com os comandos disponíveis (com opção "Sair")                         |
| `list-vox`   | Lista o conteúdo de `~/vox/arquitetura` (aceita uma subpasta: `vox list-vox services`) |
| `top-memory` | Lista os 10 processos que mais consomem memória (PowerShell / `ps`)                    |

Comando inexistente imprime uma dica e sai com código `1`.

## Desenvolvimento

```bash
npm ci
npm run dev -- --help   # roda direto do TypeScript (tsx)
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
