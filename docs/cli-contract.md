# Contrato de uso da CLI

A `vox` é usada por pessoas **e** por agentes de IA (Claude Code, Codex etc.) como subprocesso.
Este documento é o contrato estável: o que a CLI promete em flags, códigos de saída e saída de dados.

## Flags globais

Valem para qualquer comando, antes ou depois dele. Tudo depois de `--` é entregue literal ao comando.

| Flag              | Efeito                                             |
| ----------------- | -------------------------------------------------- |
| `-h`, `--help`    | Ajuda geral ou do comando (`vox <comando> --help`) |
| `-v`, `--version` | Versão                                             |
| `--json`          | Saída JSON (apenas dados em stdout)                |
| `--plain`         | Sem cores nem emojis                               |
| `--no-input`      | Nunca pergunta nada: falha em vez de abrir prompt  |
| `-y`, `--yes`     | Confirma automaticamente as perguntas              |
| `--verbose`       | Detalhes técnicos (stack) nos erros                |

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
