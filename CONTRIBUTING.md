# Contribuindo

## Branches

| Branch      | Papel                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| `master`    | Produção. Só recebe PR vindo da `develop`; exige 1 aprovação e CI verde       |
| `develop`   | Integração. Cada merge publica uma pré-release em **staging** (se habilitado) |
| `tipo/nome` | Trabalho: `feat/...`, `fix/...`, `ci/...`, `docs/...`, `chore/...`            |

`develop` e `master` são protegidas: sem push direto nem force-push; PR com checks obrigatórios
(lint, testes nos 3 SOs, build + smoke). Merge de feature na `develop`: **squash**.

## Fluxo

1. Crie a branch a partir da `develop` e implemente com testes (cobertura mínima de 80%).
2. Rode localmente: `npm run typecheck && npm run lint && npm test` (e `npm run smoke` se mexeu em build/pacote).
3. Abra o PR para a `develop` e aguarde o CI.
4. Para lançar: veja [docs/RELEASING.md](docs/RELEASING.md).

## Commits (Conventional Commits, validados pelo commitlint)

```
tipo(escopo): descrição curta em minúsculas, sem ponto final

Corpo opcional, linhas de até 100 caracteres.

Closes #123
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Cabeçalho com até 100 caracteres. `feat` gera _minor_, `fix`/`perf` _patch_ e `!` ou
`BREAKING CHANGE:` _major_ (ver [ADR 0001](docs/adr/0001-versionamento-e-canais.md)).

## Hooks (husky)

- `commit-msg`: commitlint
- `pre-commit`: lint-staged (eslint + prettier nos arquivos do commit)
- `pre-push`: `typecheck` + testes
- `post-merge`: `npm ci` só se o `package-lock.json` mudou

## Versão

O `version` do `package.json` na `develop` é a **próxima versão a lançar**. Depois de cada
release, o primeiro PR bumpa para a seguinte:

```bash
npm version <patch|minor|major> --no-git-tag-version
```
