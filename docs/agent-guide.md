# Guia rápido para agentes de IA

A `vox` é uma CLI feita para ser chamada por pessoas **e** por agentes (Claude Code, Codex etc.).
Este é o resumo do que o agente precisa saber. O contrato completo vem logo abaixo.

## Regras

1. **Descubra antes de agir:** `vox list --json` devolve `data.commands` com nome, uso, argumentos,
   `risk` e `interactive` de cada comando. Só execute comandos que apareçam ali.
2. **Sempre peça JSON:** `vox <comando> [args] --json`. `stdout` terá **uma linha de JSON** e nada mais.
   `--json` também desliga qualquer prompt.
3. **Confira `ok`.** Se `false`, leia `error.code` (estável) e `error.hint` (o que fazer). O erro também
   sai em `stdout`; `stderr` fica vazio.
4. **Use o código de saída:** `0` ok · `1` erro · `2` uso inválido (corrija comando/argumentos) ·
   `3` dependência ausente (veja `error.hint`) · `4` pede confirmação · `130` interrompido.
5. **Respeite o `risk`:** `read` pode rodar livremente. Para `write` e `destructive`, só execute se o usuário
   pediu aquela ação. Passe `--yes` **apenas** nesse caso: sem ele, um comando que pede confirmação falha
   com código `4` em vez de ficar esperando.
6. **Ignore `interactive: true`** (ex.: `menu`) e nunca dependa de `vox` sem argumentos: sem terminal
   ele só mostra a ajuda.
7. Argumentos que começam com `-` devem vir depois de `--`: `vox <comando> -- --valor`.

## Exemplos

```bash
vox list --json                    # o que existe?
vox list-vox --json                # lista ~/vox/arquitetura
vox list-vox services --json       # subpasta
vox top-memory --json              # 10 processos que mais usam memória
vox <comando> --help --json        # detalhes de um comando
```

Resposta típica:

```json
{
  "schemaVersion": 1,
  "ok": true,
  "command": "list-vox",
  "data": { "path": "...", "items": [{ "name": "api", "type": "dir" }] }
}
```

## Trecho para o `CLAUDE.md` / `AGENTS.md` do seu projeto

```markdown
## CLI vox

Use a `vox` para tarefas operacionais da empresa. Antes de usar, rode `vox agent-guide` (ou
`vox list --json`) para ver os comandos. Sempre chame com `--json`, confira `ok` e o código de saída,
e só passe `--yes` quando o usuário tiver pedido explicitamente a ação.
```

---
