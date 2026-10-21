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
2. Rode localmente: `npm run typecheck && npm run lint && npm test` (`npm run smoke` se mexeu em build/pacote e `npm run contract` se mexeu em saída, flags ou exit codes: ele roda o binário como um agente faria, sem terminal).
   Para **adicionar um script** (`.sh`, `.py` ou `.js`), crie a pasta em `mycli-scripts/` com um `manifest.json`:
   veja [mycli-scripts/README.md](mycli-scripts/README.md). O `npm test` e o build validam o manifesto.
3. Abra o PR para a `develop` e aguarde o CI.
4. Para lançar: veja [docs/RELEASING.md](docs/RELEASING.md).

## Adicionando scripts

Um script é uma pasta em `mycli-scripts/` com um `manifest.json` e o arquivo de entrada. Passo a passo:

1. **Copie** `mycli-scripts/ola/` e renomeie a pasta (o nome da pasta é o nome do comando, em minúsculas e hífens).
2. **Edite o `manifest.json`**: `description` em linguagem simples, `entry`, `args`, e sobretudo um `risk` honesto
   (`read` só lê; `write` altera; `destructive` pode apagar; na dúvida, o mais alto).
   Se o script apaga ou instala algo, declare `effects` (ex.: `delete:node_modules`, `install:npm`).
   Declare `os` e `requires` quando depender de algo específico (`docker`, `git`).
3. **Escolha a linguagem**: `.js` roda em qualquer lugar (o Node já é pré-requisito); `.sh` e `.py` só onde há Bash/Python,
   e a CLI explica o que instalar se faltar (`mycli doctor`). `.js` aqui é ESM (`import`, não `require`).
4. **Teste**: `npm run build` valida o manifesto e gera o índice de integridade; `mycli <nome> --dry-run` mostra o que
   seria executado; `mycli <nome> --json` roda como um agente. O `npm test` valida todos os manifestos.
5. **Revise com o checklist de segurança** em [docs/security/runner.md](docs/security/runner.md#checklist-de-revisão-de-um-script-para-quem-aprova-o-pr)
   (o template de PR traz os itens): faz só o que a descrição diz, sem `curl | sh`, sem segredos em argumentos,
   `requires`/`os`/`timeoutSec` realistas, `.sh` com fim de linha LF.
6. **Abra o PR**. Scripts `destructive` só rodam dentro de um projeto e, sem terminal, exigem `--yes --confirm=<pasta>`
   ([ADR 0003](docs/adr/0003-permissoes-scripts-destrutivos.md)).

**Validações que rodam sozinhas** (`npm run typecheck && npm run lint && npm test`, e o CI nos 3 sistemas): manifesto
válido e sem nome repetido, integridade SHA-256 dos arquivos, testes do runner (injeção de argumentos, timeout, segredos
mascarados) e cobertura mínima de 80%.

**Logs**: toda execução (inclusive as negadas e bloqueadas) vai para `~/.mycli/audit.log`, sem a saída do script.
`mycli stats` mostra o que mais roda e o que mais falha; `mycli report` prepara um relatório sem dados pessoais para
abrir como issue, e `npm run backlog` soma esses relatórios. Não passe segredos por argumento: a máscara é heurística.

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
