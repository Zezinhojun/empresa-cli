## O que muda

## Como testar

## Checklist

- [ ] `npm run typecheck && npm run lint && npm test`
- [ ] `npm run smoke` / `npm run contract` (se mexeu em build, pacote, saída, flags ou exit codes)

### Só se este PR adiciona ou altera um script de `mycli-scripts/`

Revisão conforme [docs/security/runner.md](../docs/security/runner.md#checklist-de-revisão-de-um-script-para-quem-aprova-o-pr):

- [ ] `risk` correto (na dúvida, o mais alto) e `description` em linguagem simples
- [ ] Faz **só** o que a descrição diz; sem `curl | sh`, sem envio de dados, sem binários
- [ ] Não pede nem imprime segredos; respeita `MYCLI_YES` e `MYCLI_NO_INPUT`
- [ ] `requires`, `os` e `timeoutSec` declarados; testado nos sistemas de `os`
- [ ] `.sh` com fim de linha LF
