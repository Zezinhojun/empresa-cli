# Contrato de uso da CLI

A `vox` é usada por pessoas **e** por agentes de IA (Claude Code, Codex etc.) como subprocesso.
Este documento é o contrato estável: o que a CLI promete em flags, códigos de saída e saída de dados.

## Flags globais

Valem para qualquer comando, antes ou depois dele. Tudo depois de `--` é entregue literal ao comando.

| Flag              | Efeito                                               |
| ----------------- | ---------------------------------------------------- |
| `-h`, `--help`    | Ajuda geral ou do comando (`vox <comando> --help`)   |
| `-v`, `--version` | Versão                                               |
| `--json`          | Saída JSON (apenas dados em stdout)                  |
| `--plain`         | Sem cores nem emojis                                 |
| `--dry-run`       | Mostra o que seria executado, sem executar (scripts) |
| `--no-input`      | Nunca pergunta nada: falha em vez de abrir prompt    |
| `-y`, `--yes`     | Confirma automaticamente as perguntas                |
| `--verbose`       | Detalhes técnicos (stack) nos erros                  |

`vox help <comando>` equivale a `vox <comando> --help`. Opção desconhecida é erro de uso (código 2).

## Códigos de saída

| Código | Significado                             |
| ------ | --------------------------------------- |
| `0`    | Sucesso                                 |
| `1`    | Erro de execução                        |
| `2`    | Uso inválido (comando/opção/argumentos) |
| `3`    | Dependência ausente (ex.: Python, Bash) |
| `4`    | Requer confirmação / negado sem `--yes` |
| `130`  | Interrompido (Ctrl+C)                   |

Erros vão para **stderr**, em uma ou duas linhas (mensagem + dica). O stack só aparece com `--verbose`.

## Modo não interativo

A CLI **nunca** abre prompt nem executa comando por conta própria sem um terminal de verdade.
Ela é "interativa" somente se stdin **e** stdout forem TTY e não houver `--no-input`, `--json` nem `CI=true`.

- `vox` sem argumentos: interativa → abre o menu; **não interativa → imprime a ajuda** (código 0).
- `vox menu` sem terminal: recusa com código `2` (`INTERACTIVE_REQUIRED`).
- Pergunta de confirmação: com `--yes` segue; sem terminal e sem `--yes` falha com código `4`
  (`CONFIRMATION_REQUIRED`) e diz para repetir com `--yes`. Nunca fica esperando resposta.
- Sem TTY, cores são desligadas automaticamente (também com `NO_COLOR` ou `--plain`).
- Ctrl+C dentro de um prompt encerra com `130`, sem stack.

## Saída para máquinas (`--json`)

Com `--json`, **stdout contém exatamente uma linha de JSON** e nada mais (sem logs, cor ou emoji);
os códigos de saída continuam valendo. Em erro, o JSON de erro também vai para **stdout** e
**stderr fica vazio** (ferramentas de agente costumam juntar os dois fluxos).

Sucesso:

```json
{
  "schemaVersion": 1,
  "ok": true,
  "command": "list-vox",
  "data": { "path": "...", "items": [{ "name": "api", "type": "dir" }] }
}
```

Erro (`code` é estável; `hint`, `details` e `stack` são opcionais, o stack só com `--verbose`):

```json
{
  "schemaVersion": 1,
  "ok": false,
  "error": { "code": "NOT_FOUND", "message": "Pasta não encontrada em ...", "hint": "..." }
}
```

`schemaVersion` só muda em quebra de compatibilidade. Comandos que não têm dados devolvem `"data": null`.

### Códigos de erro (`error.code`)

| Código                    | Exit | Quando                                                    |
| ------------------------- | ---- | --------------------------------------------------------- |
| `UNKNOWN_COMMAND`         | 2    | Comando inexistente                                       |
| `UNKNOWN_OPTION`          | 2    | Opção começada por `-` que a CLI não conhece              |
| `INVALID_ARGUMENTS`       | 2    | Faltam ou sobram argumentos                               |
| `INTERACTIVE_REQUIRED`    | 2    | Comando só funciona com terminal (ex.: `menu`)            |
| `PATH_OUTSIDE_BASE`       | 2    | `list-vox` com subpasta fora de `~/vox/arquitetura`       |
| `CONFIRMATION_REQUIRED`   | 4    | Ação pede confirmação e não há terminal nem `--yes`       |
| `NOT_FOUND`               | 1    | Arquivo ou pasta inexistente (inclui `ENOENT` do sistema) |
| `PERMISSION_DENIED`       | 1    | Sem permissão (inclui `EACCES`/`EPERM` do sistema)        |
| `DISK_FULL`               | 1    | Sem espaço em disco (`ENOSPC`)                            |
| `COMMAND_FAILED`          | 1    | Comando de sistema falhou (ex.: `ps`/PowerShell)          |
| `SCRIPT_FAILED`           | 1    | Script saiu com código ≠ 0 (`error.details.exitCode`)     |
| `SCRIPT_TIMEOUT`          | 1    | Script passou do tempo limite e foi interrompido          |
| `SCRIPT_OUTPUT_TOO_LARGE` | 1    | Script gerou saída demais e foi interrompido              |
| `MISSING_RUNTIME`         | 3    | Falta Bash, Python 3 ou outro interpretador do script     |
| `UNSUPPORTED_SCRIPT_TYPE` | 2    | Extensão de script que a CLI não executa                  |
| `ERROR`                   | 1    | Qualquer outro erro                                       |

## Descobrir comandos

`vox list --json` (ou `vox --json`, ou `vox --help --json`) devolve o catálogo:

```json
{
  "version": "1.0.0",
  "commands": [
    {
      "name": "list-vox",
      "description": "...",
      "usage": "vox list-vox [subpasta]",
      "args": [{ "name": "subpasta", "description": "...", "required": false }],
      "risk": "read",
      "interactive": false
    }
  ]
}
```

`vox <comando> --help --json` devolve só a entrada daquele comando.

- `risk`: `read` (só lê), `write` (altera algo) ou `destructive` (pode apagar/sobrescrever). Agentes devem
  tratar `write` e `destructive` com cuidado e só passar `--yes` quando a ação for realmente pretendida.
- `interactive: true` significa que o comando exige terminal (ex.: `menu`); agentes devem ignorá-lo.

## Sem decoração

Cores, emoji e espaçamento decorativo somem automaticamente quando stdout não é terminal, com `--json`,
`--plain` ou `NO_COLOR`. No modo simples, `list-vox` imprime pastas com `/` no fim (`api/`) e arquivos sem sufixo.
