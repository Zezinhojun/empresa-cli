# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento
[SemVer](https://semver.org/lang/pt-BR/). As notas de cada release também são geradas no
GitHub Release. Veja [ADR 0001](docs/adr/0001-versionamento-e-canais.md).

## [Unreleased]

Será a **1.0.0** (primeira publicação).

### Adicionado

- `vox --help` e `vox --version`; comando inexistente sai com código 1; Ctrl+C em prompt sai com 130.
- Menu interativo em loop com opção "Sair".
- `list-vox` (lista `~/vox/arquitetura`) e grupos de projetos em `VoxHome`.
- `top-memory`: lista os processos que mais consomem memória em Windows, Linux e macOS.
- Smoke test do pacote instalado (`npm run smoke`).
- Pipeline: CI em Linux/Windows/macOS, publish em staging, promoção manual a produção e rollback.
- Contrato de uso da CLI ([docs/cli-contract.md](docs/cli-contract.md)): flags globais (`--json`, `--plain`, `--no-input`, `-y/--yes`), `--help` por comando e exit codes estáveis (4 = confirmação necessária).
- Modo não interativo: nunca abre prompt nem executa sozinha sem terminal (sem TTY, `CI=true`, `--json` ou `--no-input`).
- Saída para máquinas: `--json` imprime uma única linha de JSON em stdout, com códigos de erro estáveis; `--plain` e `NO_COLOR` removem cores e emojis.
- `vox list` (catálogo de comandos com `args` e `risk`) e `vox agent-guide` ([docs/agent-guide.md](docs/agent-guide.md)).
- Suíte de contrato que executa a CLI como um agente (sem TTY, `--json`).
- Runner de scripts: `.js`, `.sh` e `.py` de `vox-scripts/` viram comandos (manifesto e índice), com interpretador detectado, sem shell e com `--dry-run`.
- `vox-scripts/` empacotado no pacote npm, com smoke test de um script de cada tipo instalado.
- `vox doctor` e mensagens claras para dependência ausente e erros comuns.
- Segurança do runner ([docs/security/runner.md](docs/security/runner.md)): integridade SHA-256 dos scripts antes de executar (`INTEGRITY_ERROR`), log de auditoria em `~/.vox/audit.log` e modelo de ameaças.
- CI: testa a CLI sem Bash nem Python e no Node 20 e 24; actions pinadas por SHA, `npm audit` e dependabot.
- Scripts `destructive`: `effects` no manifesto (informativo), alvo validado (precisa ser um projeto, nunca `~`, raiz ou pasta do sistema) e, sem terminal, `--yes --confirm=<pasta alvo>`; `effects` e alvo vão para o `audit.log` ([ADR 0003](docs/adr/0003-permissoes-scripts-destrutivos.md)).

### Corrigido

- A CLI empacotada não executava (`Module not found in bundle`): comandos agora são registrados por import estático.
- `bin` sem shebang (não funcionava em Linux/macOS).
- O pacote incluía testes, fontes e configs (707 kB); agora só `dist/` (4 kB).

### Removido

- `clean-memory` (perguntava se deveria limpar e não fazia nada) — substituído por `top-memory`.
- Dependências sem uso: `commander` e `ora`.
