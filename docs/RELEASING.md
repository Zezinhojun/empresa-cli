# Publicação e releases

Fluxo (ADR: [0001](adr/0001-versionamento-e-canais.md)):

```
PR → develop ──CI──▶ staging (X.Y.Z-staging.N, dist-tag staging)
                        │  validação (checklist abaixo)
PR develop → master ──▶ Promote (manual, com aprovação) ──▶ X.Y.Z (dist-tag latest) + tag vX.Y.Z + GitHub Release
```

Nenhum workflow publica sem a variável `NPM_PUBLISH_ENABLED=true` e credenciais.

## 1. Configuração única (só o dono do repositório / npm)

1. **Nome e dono do pacote.** Escolha um nome **livre** no npm (`npm view <nome>` deve dar 404) ou use um escopo da
   sua conta/organização (`@sua-org/<nome>`, edite o `name` do `package.json` à mão: o `init` não aceita `@`).
   O comando que as pessoas digitam é o `bin`, que não muda. Padrão adotado: público, `access: public`.
2. Gere um **automation token** no npm (nunca cole em chat, issue ou commit) e salve como secret
   **`NPM_TOKEN`** nos environments `staging` **e** `production`
   (GitHub → Settings → Environments). Alternativa: _trusted publishing_ do npm.
3. Habilite a publicação: Settings → Secrets and variables → Actions → **Variables** →
   `NPM_PUBLISH_ENABLED` = `true`.
4. **Branch protection** em `develop` e `master`: PR obrigatório e os checks do CI como obrigatórios (lint, testes nos 3
   sistemas, build + smoke). O scaffold **não** traz isso configurado.
5. **Provenance.** Os workflows publicam com `--provenance`, que exige o GitHub Actions e repositório público. Se o seu
   for privado, remova `--provenance` de `publish.yml` e `promote.yml`.
6. **Privacidade.** O padrão é pacote público, e os scripts de `<nome>-scripts/` vão dentro dele. Para uso só interno,
   use escopo com `access: restricted` (em `publishConfig` e nos dois workflows) ou um registro privado.

## 2. Lançar uma versão

1. **Staging:** merge na `develop` publica `X.Y.Z-staging.N` automaticamente (job `publish-staging`
   do `ci.yml`: roda lint, testes, build, smoke e `npm audit` antes).
2. **Validar** em staging com o checklist da seção 3.
3. **PR `develop` → `master`** com CI verde e 1 aprovação (como mantenedor único, use o _bypass_
   de administrador). Faça **merge commit** para preservar os commits convencionais.
4. **Promote:** Actions → _Promote to production_ → _Run workflow_ na `master`, informando a
   versão validada (ex.: `1.0.0-staging.57`). O workflow confere que a `master` está em `X.Y.Z`,
   que a versão estável ainda não existe e que o `dist/index.js` da `master` é **idêntico** ao do
   tarball de staging (só muda a string de versão). Depois pede a aprovação do environment
   `production`, publica com `--tag latest --provenance` e cria a tag `vX.Y.Z` + GitHub Release.
5. **Bump:** abra PR na `develop` com `npm version <patch|minor|major> --no-git-tag-version`
   e atualize o [CHANGELOG](../CHANGELOG.md).

## 3. Checklist de validação em staging

Rodar com `npm install -g mycli@staging`:

- [ ] Instala limpo em **Windows, Linux e macOS** (Node 20 e 24)
- [ ] `mycli --version` = versão publicada; `mycli --help` lista `menu`, `list-files`, `top-memory`
- [ ] `mycli` abre o menu; "Sair" encerra com código 0
- [ ] `mycli list-files` com e sem a pasta `~/mycli/files`; com subpasta (`mycli list-files <sub>`)
- [ ] `mycli top-memory` lista 10 processos
- [ ] `mycli comando-inexistente` sai com código ≠ 0
- [ ] Atualizar sobre uma versão anterior funciona (`npm i -g mycli@staging`)
- [ ] A página do pacote no npm mostra o selo de **provenance**
- [ ] Nenhuma issue aberta com label `blocker`

Anexe o resultado ao PR `develop → master`.

## 4. Primeira release (1.0.0)

Siga a seção 2 com `package.json` em `1.0.0`. Ao final:

- [ ] `npm install -g mycli` (latest) instala `1.0.0`; `mycli@staging` segue para a próxima pré-release
- [ ] Tag `v1.0.0` e GitHub Release criados
- [ ] CHANGELOG: mover `[Unreleased]` para `[1.0.0]` com a data

## 5. Rollback

Nunca use `npm unpublish`. Aponte `latest` de volta para a versão estável anterior:

- Actions → _Rollback latest_ → informe a versão estável (ex.: `1.0.0`), com aprovação; ou
- `npm dist-tag add mycli@<versão-anterior> latest`

E deprecie a versão ruim para avisar quem instalar:

```bash
npm deprecate mycli@<versão-ruim> "motivo — use <versão-boa>"
```

## 6. Problemas comuns

| Sintoma                                            | Causa / ação                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Nenhum check roda e o run mostra `startup_failure` | Workflow inválido (ex.: permissões do job chamado maiores que as do chamador). Veja a aba Actions |
| `publish-staging` aparece como _skipped_           | `NPM_PUBLISH_ENABLED` não é `true`, ou o push não foi na `develop`                                |
| Promote falha em "master está em X, esperado Y"    | Falta o PR `develop → master` ou o `version` do `package.json` diverge                            |
| Promote falha na comparação do `dist`              | A `master` tem código diferente do validado em staging; refaça o staging                          |
