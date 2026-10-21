# Política de segurança

## Como reportar uma vulnerabilidade

**Não abra uma issue pública** para vulnerabilidades. Use o relato privado do GitHub:
**Security → Report a vulnerability** neste repositório
(<https://github.com/OWNER/REPO/security/advisories/new>).

Inclua: o que acontece, como reproduzir, a versão (`mycli --version`) e o sistema operacional. Retornamos o
quanto antes e coordenamos a correção e a publicação.

## O que está no escopo

- Execução indevida de código ou de scripts; fuga das proteções do runner (integridade, confirmação, `--yes`).
- Vazamento de segredos (variáveis de ambiente, log de auditoria, saída).
- Injeção por argumento, travessia de diretórios, escalonamento de privilégio.
- Comprometimento da cadeia de publicação (workflows de release, tokens, dependências).

O modelo de ameaças e os limites conhecidos estão em [docs/security/runner.md](docs/security/runner.md).

## Versões suportadas

Só a última versão publicada (`latest`) recebe correções de segurança.
