# ADR 0001 — Versionamento e canais de publicação (staging → produção)

- **Status:** aceito
- **Data:** 2026-10-14
- **Issue:** #9

## Contexto

A CLI será publicada no npm. O requisito é publicar **primeiro em staging**, validar, e só então promover a **produção**, com versionamento de release. Os commits já seguem Conventional Commits (commitlint) e o repositório tem as branches `develop` (integração) e `master` (produção).

## Decisão

### Canais (dist-tags do npm)

| Canal    | dist-tag  | Versão publicada  | Origem                 | Instalação                 |
| -------- | --------- | ----------------- | ---------------------- | -------------------------- |
| staging  | `staging` | `X.Y.Z-staging.N` | push na `develop`      | `npm i -g cli-vox@staging` |
| produção | `latest`  | `X.Y.Z`           | workflow `promote.yml` | `npm i -g cli-vox`         |

`N` é o `github.run_number`: único e crescente, sem estado extra no repositório.

### Qual é o `X.Y.Z`

O `version` do `package.json` na `develop` é **a próxima versão a lançar**. Ele só muda quando alguém decide o bump, num PR de uma linha (`npm version <major|minor|patch> --no-git-tag-version`), seguindo Conventional Commits desde a última release:

- `feat` → minor · `fix`/`perf` → patch · `!` ou `BREAKING CHANGE` → major.

Depois de cada release, o primeiro PR na `develop` bumpa para a próxima versão.

### Fluxo

1. PR → `develop`: CI (lint, testes em 3 SOs, build + smoke).
2. Merge na `develop`: o CI empacota e publica `X.Y.Z-staging.N` com `--tag staging`.
3. Validação manual em staging com o checklist de `docs/RELEASING.md`.
4. PR `develop` → `master` (aprovado e com CI verde).
5. Workflow **Promote** (manual, `workflow_dispatch`, Environment `production` com revisor obrigatório), informando a versão de staging validada:
   - confere que `master` tem `package.json` na versão `X.Y.Z` correspondente;
   - reconstrói a partir da `master` e **compara `dist/index.js` com o do tarball de staging** (mesmo código que foi testado, ignorando a string de versão);
   - publica `X.Y.Z` com `--tag latest --provenance`;
   - cria a tag `vX.Y.Z` e o GitHub Release com notas geradas.

### Rollback

`npm dist-tag add cli-vox@<versão-anterior> latest` (workflow **Rollback**) e `npm deprecate` na versão ruim. Nunca `npm unpublish`.

## Alternativas consideradas

- **semantic-release / release-please / changesets:** calculam versão e changelog automaticamente, mas adicionam uma ferramenta, arquivos de configuração e PRs automáticos num projeto com um mantenedor e poucas releases. O bump manual em 1 linha + notas geradas pelo GitHub cobre o necessário. Revisitar se a cadência de releases crescer.
- **Promover só movendo a dist-tag** (`latest` → `X.Y.Z-staging.N`): mais simples, mas `latest` ficaria com uma versão com sufixo `-staging`, o que é confuso para quem instala e para o histórico de releases.
- **Republicar o mesmo tarball com outra versão:** não é possível; o npm exige a versão dentro do tarball.

## Consequências

- Nada chega a `latest` sem passar por staging, pela comparação de código e por aprovação humana.
- Publicação desligada por padrão: só ocorre com a variável de repositório `NPM_PUBLISH_ENABLED=true` e credenciais configuradas.
- O bump da versão é uma decisão humana explícita (um PR pequeno), não automática.
