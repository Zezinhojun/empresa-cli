# mycli — scaffold de CLI para scripts

Ponto de partida para uma **CLI que roda os seus scripts** (`.js`, `.sh`, `.py`) como comandos, com o que costuma
faltar em scripts soltos: testes, validação de segurança, log de auditoria e saída para agentes de IA.
`mycli` é só um nome de exemplo: o `init` troca por o nome da sua CLI.

## Começando

```bash
# 1. Crie seu repositório a partir deste (botão "Use this template" no GitHub) ou copie a pasta
npm ci

# 2. Dê o seu nome à CLI (comando, pasta de scripts, variáveis de ambiente, pacote npm)
npm run init -- meucli --repo meu-usuario/meucli --author "Seu Nome <voce@exemplo.com>"

# 3. Confira que tudo funciona e use
npm run build && npm test
node dist/index.js ola Maria     # script de exemplo: meucli-scripts/ola/
```

O `init` roda uma vez e remove a si mesmo. Depois, **adicione seus scripts** em
`meucli-scripts/` (guia completo: [mycli-scripts/README.md](mycli-scripts/README.md) e a seção
"Adicionando scripts" do [CONTRIBUTING.md](CONTRIBUTING.md)).

### O que já vem pronto

| Tema      | O que você ganha                                                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scripts   | Cada pasta com `manifest.json` vira um comando; `risk` (`read`/`write`/`destructive`), `os`, `requires`, `timeoutSec`                                            |
| Segurança | Sem shell, ambiente com allowlist, integridade SHA-256, confirmação por risco e `--confirm` em `destructive`: [docs/security/runner.md](docs/security/runner.md) |
| Auditoria | `~/.mycli/audit.log` de toda tentativa (com segredos mascarados); `mycli stats` e `mycli report` leem esse log                                                   |
| Testes    | vitest com cobertura mínima de 80%, suíte de contrato (roda a CLI como um agente) e smoke do pacote instalado                                                    |
| Agentes   | `--json`, códigos de saída estáveis, nunca abre prompt sem terminal: [docs/cli-contract.md](docs/cli-contract.md)                                                |
| Pipeline  | CI em Linux/Windows/macOS, publicação em staging → produção com provenance: [docs/RELEASING.md](docs/RELEASING.md)                                               |

## Publicando a sua CLI no seu npm

O pipeline já vem pronto, mas **não publica nada até você configurar** (nenhum workflow roda sem
`NPM_PUBLISH_ENABLED=true`). Resumo; o passo a passo completo está em [docs/RELEASING.md](docs/RELEASING.md).

1. **Nome livre no npm.** `mycli` é só exemplo e o seu nome provavelmente já existe. Troque o `name` do `package.json`
   por um nome livre ou por um escopo da sua conta/organização (ex.: `@sua-org/mycli`); o comando (`bin`) continua `mycli`.
2. **Credenciais no GitHub.** Um _automation token_ do npm salvo como secret `NPM_TOKEN` nos environments `staging` e
   `production`, e a variável do repositório `NPM_PUBLISH_ENABLED=true`. Proteja o `production` com aprovação obrigatória.
3. **Staging.** Cada merge na `develop` publica `X.Y.Z-staging.N` na dist-tag `staging`: `npm i -g mycli@staging`.
4. **Produção.** PR `develop → master`, depois o workflow _Promote_ com a versão validada: ele confere que o código é
   idêntico ao de staging, pede aprovação, publica em `latest` e cria a tag e o GitHub Release. Seus colegas instalam com
   `npm install -g mycli`.

Antes de publicar, confira dois pontos:

- **Pacote público.** O padrão é `access: public` com `--provenance`. A assinatura de procedência exige publicar pelo
  GitHub Actions e vale para repositório público; em repositório privado remova `--provenance` de `publish.yml` e
  `promote.yml`. Para uso só da empresa, use um escopo com `access: restricted` ou um registro interno.
- **Os scripts viajam dentro do pacote.** Publicar num npm público publica também os seus scripts: não coloque nada
  que não possa ser público (endereços internos, nomes de clientes, segredos).

## Requisitos

- Node.js **20 a 24** (LTS)
- Windows, Linux ou macOS (testado no CI nos três)

## Instalação

```bash
npm install -g mycli          # produção (dist-tag latest)
npm install -g mycli@staging  # pré-release para validação
```

## Uso

```bash
mycli                    # menu interativo
mycli <comando> [args]   # executa um comando direto
mycli --help             # lista comandos e opções
mycli --version
```

| Comando       | O que faz                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `menu`        | Menu interativo com os comandos disponíveis (com opção "Sair")                                              |
| `list-files`  | Lista o conteúdo de `~/mycli/files` (aceita uma subpasta: `mycli list-files services`)                      |
| `top-memory`  | Lista os 10 processos que mais consomem memória (PowerShell / `ps`)                                         |
| `list`        | Lista os comandos (`--json`: catálogo com argumentos e risco)                                               |
| `agent-guide` | Guia de uso para agentes de IA (`--json`: guia + contrato + catálogo)                                       |
| `stats`       | Mostra os scripts mais usados e os erros mais comuns **deste computador** (lê `~/.mycli/audit.log`)         |
| `report`      | Prepara um relatório sem dados pessoais e abre uma issue já preenchida no GitHub para você revisar e enviar |
| `doctor`      | Confere se o computador tem Node, Bash e Python e ensina a instalar o que faltar                            |

Comando inexistente imprime uma dica e sai com código `2`.

## Scripts (`.sh`, `.py`, `.js`)

Cada pasta de [`mycli-scripts/`](mycli-scripts/README.md) vira um comando: `mycli <nome>`. Quem usa não precisa saber
se o script é Bash, Python ou Node: a `mycli` descobre como executar, confere se o computador tem o que é
preciso (`mycli doctor`) e, se o script altera ou apaga coisas, **pergunta antes**. Os scripts viajam dentro do
pacote npm, então passam por PR e CI como o resto do código. Como criar um: [mycli-scripts/README.md](mycli-scripts/README.md).

## Uso por agentes de IA (Claude Code, Codex etc.)

A `mycli` foi desenhada para ser chamada também por agentes, como subprocesso:

- `mycli agent-guide` (ou `--json`) imprime o guia e o catálogo de comandos — o agente aprende a usar a CLI sem ver este repositório.
- `mycli list --json` descobre os comandos, os argumentos e o **risco** de cada um (`read`, `write`, `destructive`).
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
