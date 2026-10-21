# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento
[SemVer](https://semver.org/lang/pt-BR/). As notas de cada release também são geradas no
GitHub Release. Veja [ADR 0001](docs/adr/0001-versionamento-e-canais.md).

## [Unreleased]

### Adicionado

- Scaffold inicial: runner de scripts (`.js`, `.sh`, `.py`) com manifesto, integridade, confirmação por risco, `--confirm` em scripts `destructive` e log de auditoria; `stats`, `report`, `doctor`, `list`, `agent-guide`; contrato `--json`; CI e pipeline de publicação.
- `npm run init -- <nome>` para dar o seu nome à CLI.
