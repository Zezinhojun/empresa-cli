# Guia rápido para agentes de IA

A `mycli` é uma CLI feita para ser chamada por pessoas **e** por agentes (Claude Code, Codex etc.).
Este é o resumo do que o agente precisa saber. O contrato completo vem logo abaixo.

## Regras

1. **Descubra antes de agir:** `mycli list --json` devolve `data.commands` com nome, uso, argumentos,
   `risk` e `interactive` de cada comando. Só execute comandos que apareçam ali.
2. **Sempre peça JSON:** `mycli <comando> [args] --json`. `stdout` terá **uma linha de JSON** e nada mais.
   `--json` também desliga qualquer prompt.
3. **Confira `ok`.** Se `false`, leia `error.code` (estável) e `error.hint` (o que fazer). O erro também
   sai em `stdout`; `stderr` fica vazio.
4. **Use o código de saída:** `0` ok · `1` erro · `2` uso inválido (corrija comando/argumentos) ·
   `3` dependência ausente · `4` pede confirmação · `130` interrompido. No código `3`
   (`MISSING_RUNTIME`), rode `mycli doctor --json`: `data.checks[]` diz o que falta e `install` explica
   como instalar; **repasse isso ao usuário** em vez de tentar instalar por conta própria.
5. **Respeite o `risk`:** `read` pode rodar livremente. Para `write` e `destructive`, só execute se o usuário
   pediu aquela ação. Passe `--yes` **apenas** nesse caso: sem ele, um comando que pede confirmação falha
   com código `4` em vez de ficar esperando.
6. **Scripts são comandos como os outros** (`kind: "script"` no catálogo): descubra com `mycli list --json`,
   confira `requires` e `risk`, e use `mycli <nome> --dry-run --json` para ver o que seria executado sem
   executar. `write`/`destructive` só com `--yes` e se o usuário pediu aquela ação.
7. **Ignore `interactive: true`** (ex.: `menu`) e nunca dependa de `mycli` sem argumentos: sem terminal
   ele só mostra a ajuda.
8. Argumentos que começam com `-` devem vir depois de `--`: `mycli <comando> -- --valor`.

## Exemplos

```bash
mycli list --json                    # o que existe?
mycli list-files --json                # lista ~/mycli/files
mycli list-files services --json       # subpasta
mycli top-memory --json              # 10 processos que mais usam memória
mycli stats --json                  # scripts mais usados e erros comuns deste computador
mycli doctor --json                  # o que este computador tem (Node, Bash, Python)
mycli <comando> --help --json        # detalhes de um comando
```

Resposta típica:

```json
{
  "schemaVersion": 1,
  "ok": true,
  "command": "list-files",
  "data": { "path": "...", "items": [{ "name": "api", "type": "dir" }] }
}
```

## Trecho para o `CLAUDE.md` / `AGENTS.md` do seu projeto

```markdown
## CLI mycli

Use a `mycli` para tarefas operacionais. Antes de usar, rode `mycli agent-guide` (ou
`mycli list --json`) para ver os comandos. Sempre chame com `--json`, confira `ok` e o código de saída,
e só passe `--yes` quando o usuário tiver pedido explicitamente a ação.
```

---
