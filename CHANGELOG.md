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

### Corrigido

- A CLI empacotada não executava (`Module not found in bundle`): comandos agora são registrados por import estático.
- `bin` sem shebang (não funcionava em Linux/macOS).
- O pacote incluía testes, fontes e configs (707 kB); agora só `dist/` (4 kB).

### Removido

- `clean-memory` (perguntava se deveria limpar e não fazia nada) — substituído por `top-memory`.
- Dependências sem uso: `commander` e `ora`.
