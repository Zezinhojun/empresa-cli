# ADR 0003 — Permissões para scripts que apagam e instalam

- **Status:** aceito e implementado (#82)
- **Data:** 2026-10-21
- **Issue:** #73
- **Relacionados:** [ADR 0002](0002-scripts-empacotados.md), [modelo de ameaças](../security/runner.md)

## Contexto

Há scripts previstos que apagam `node_modules`, `vendor` e `var` e instalam dependências. Hoje a confirmação
diz só que o script "pode apagar dados", e um agente de IA passa por ela com `--yes`. Não há sandbox
(ver limitações em `runner.md`), então a defesa é declarar, revisar e confirmar.

## Decisão

1. **`effects` no `manifest.json` é informativo.** Lista o que o script faz: `delete:node_modules`,
   `delete:vendor`, `delete:var`, `install:npm`, `install:composer`, `network`. O runner **não** bloqueia o que
   não foi declarado (sem sandbox isso não é imponível). Quem garante que `effects` bate com o código é a
   **revisão do PR** (item novo no checklist). Campo desconhecido continua rejeitado.
2. **A confirmação mostra** os `effects` e o diretório alvo **resolvido** (caminho absoluto).
3. **O alvo é validado antes de rodar:** precisa ser um projeto (`package.json` ou `composer.json`); `~`, raiz
   do disco e pastas do sistema são recusados; sem `..` nem symlink que saia do projeto.
4. **`--confirm=<nome da pasta alvo>` é exigido só quando não há terminal** e o `risk` é `destructive`. Nesse
   caso `--yes` sozinho falha com código `4`. Com terminal, a pergunta à pessoa já é a confirmação humana.
5. **`--dry-run` lista** o que seria apagado ou instalado.
6. **`effects` e o alvo entram no `audit.log`.**
7. **Instalação só com versões travadas** (`npm ci`, `composer install` com lock); nunca `curl | sh`.

## Alternativas consideradas

- **`effects` imposto pelo runner:** impossível sem sandbox; daria falsa sensação de segurança.
- **`--confirm` também com terminal:** atrito para a pessoa sem ganho; o prompt já exige decisão humana.

## Consequências

- Fecha a pendência "destructive exigir confirmação humana mesmo com `--yes`" do `runner.md` (para o caso sem terminal).
- Implementado em `manifest.ts` (campo `effects`), `ScriptCommand.ts` (`--confirm`), `target.ts` (validação do
  alvo), `audit.ts` e `parseArgv.ts`, com testes. `--dry-run` listar os efeitos e o uso de lockfile (`npm ci`) são
  conferidos na **revisão do PR**, não pelo runner.
- A segurança contra um agente induzido continua dependendo também da aprovação de comandos do cliente do agente.
