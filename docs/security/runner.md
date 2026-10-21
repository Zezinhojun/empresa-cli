# Modelo de ameaças do runner de scripts

O runner (`src/runner/`, `src/commands/Script*.ts`) executa código `.sh`, `.py` e `.js` na máquina de **todos
os usuários** da `vox`, às vezes **sem ninguém olhando** (agentes de IA). É a superfície de risco mais alta do
projeto. Este documento diz do que o runner protege, do que **não** protege, e o que revisar antes de aceitar
um script. Decisão de origem dos scripts: [ADR 0002](../adr/0002-scripts-empacotados.md).

> **Status da revisão:** os controles abaixo estão implementados e testados (issue #46) e a revisão foi
> **aprovada pelo dono do repositório (Junior Silva) em 2026-10-14**, com os limites da seção
> [Limitações](#limitações-e-riscos-que-permanecem) aceitos. Com isso, o **primeiro script real pode entrar** em
> `vox-scripts/`, **desde que cada script passe pelo checklist** [abaixo](#checklist-de-revisão-de-um-script-para-quem-aprova-o-pr).
> A aprovação cobre o **runner e os controles**, não os scripts futuros: cada script é revisado no seu PR.

## O que protegemos

| Ativo                                       | Por quê importa                                          |
| ------------------------------------------- | -------------------------------------------------------- |
| Arquivos e credenciais do usuário           | Um script roda com os mesmos privilégios de quem o chama |
| A confiança nos scripts empacotados         | Um script adulterado atinge todo mundo que instalou      |
| A decisão do usuário (e do agente) de rodar | Ninguém deve executar algo destrutivo sem querer         |

## Quem pode causar dano

| Ator                                          | Exemplo                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| **Autor de script** (descuidado ou malicioso) | PR que inclui um script que apaga pastas ou envia dados para fora      |
| **Cadeia de suprimentos**                     | Dependência comprometida; publicação npm adulterada                    |
| **Quem tem escrita na instalação**            | Malware ou outro processo editando `vox-scripts/` depois de instalado  |
| **Agente de IA induzido** (prompt injection)  | Um texto malicioso faz o agente chamar `vox <script-destrutivo> --yes` |
| **Argumento hostil**                          | `vox x '; rm -rf ~'`, `$(…)`, crases                                   |
| **Pessoa não técnica enganada**               | Confirma sem entender o que o comando faz                              |

## Controles

| Ameaça                                    | Controle                                                                                                                                                                                                        | Onde                                 | Teste                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Script adulterado depois da instalação    | SHA-256 de **cada arquivo** gravado no build; antes de executar compara **changed / missing / extra / symlinks**. Qualquer diferença: `INTEGRITY_ERROR`, nada executa, **antes** de confirmar ou checar sistema | `scriptIndex.ts`, `ScriptCommand.ts` | `ScriptCommand.security.test.ts`                              |
| Arquivo novo que o script carregaria      | Arquivo **extra** na pasta reprova (código que ninguém revisou)                                                                                                                                                 | idem                                 | idem                                                          |
| Link simbólico apontando para fora        | Proibido no build e na verificação                                                                                                                                                                              | idem                                 | `scriptIndex.test.ts`                                         |
| Índice com campos inesperados             | O runtime **revalida** os manifestos do índice; campo desconhecido é rejeitado                                                                                                                                  | `readIndex`                          | `scriptIndex.test.ts`                                         |
| Injeção por argumento                     | **Nunca** há shell: `execa(interpretador, [arquivo, ...args])`. No Git Bash do Windows os argumentos vão por arquivo NUL para não serem reinterpretados                                                         | `runScript.ts`                       | `runScript.test.ts` (12 argumentos hostis, `.js`/`.sh`/`.py`) |
| Alguém reintroduzir shell/eval            | Guarda estática: o teste **falha** se `shell: true`, `eval`, `new Function`, `vm.run*` ou `child_process.exec` aparecerem no runner                                                                             | `no-shell.test.ts`                   | idem                                                          |
| Vazamento de segredos do ambiente         | O script recebe só uma **allowlist** (PATH, HOME, TEMP, idioma…) + `VOX_*`; tokens/chaves do usuário **não** passam                                                                                             | `env.ts`                             | `env.test.ts`                                                 |
| Agente executa algo que altera/apaga      | `risk: write\|destructive` **exige** `--yes` fora de terminal; sem ele: código `4` e o script não roda                                                                                                          | `ScriptCommand.ts`, `confirm.ts`     | `ScriptCommand.test.ts`, contrato                             |
| Pessoa executa sem entender               | Pergunta com aviso claro (`pode APAGAR…`); o menu marca `[altera coisas]` / `[pode apagar dados]`                                                                                                               | `ScriptCommand.ts`, `MenuCommand.ts` | testes dos dois                                               |
| Script travado ou que gera saída infinita | **Timeout obrigatório** (padrão 300 s, máx. 3600 s) e limite de saída capturada (1 MB)                                                                                                                          | `runScript.ts`, `manifest.ts`        | `runScript.test.ts`                                           |
| Fuga de diretório na entrada              | `entry` relativo, sem `..` (rejeitado no manifesto)                                                                                                                                                             | `manifest.ts`                        | `manifest.test.ts`                                            |
| Falta de rastreabilidade                  | **Log de auditoria** local de toda tentativa (inclusive negadas e bloqueadas), com segredos mascarados                                                                                                          | `audit.ts`, `ScriptCommand.ts`       | `audit.test.ts`, `ScriptCommand.security.test.ts`             |
| Script malicioso entrando por PR          | Revisão obrigatória (checklist abaixo), CODEOWNERS, CI, _provenance_ na publicação                                                                                                                              | `.github/`                           | — (processo)                                                  |

## Log de auditoria

- **Onde:** `~/.vox/audit.log` (uma linha JSON por tentativa; `VOX_AUDIT_LOG=<arquivo>` troca o local, `off`
  desliga: pensado para CI/testes). Pasta `0700`, arquivo `0600` (em sistemas POSIX). Rotaciona a ~1 MB e guarda
  uma geração (`audit.log.1`).
- **O que grava:** `time`, `user`, `platform`, `version`, `script`, `args` (mascarados), `risk`, `runtime`,
  `interactive` (pessoa × agente), `yes`, `outcome`, `exitCode`, `durationMs`, `errorCode`.
- **`outcome`:** `ok`, `dry-run`, `failed`, `timeout`, `denied` (pedia confirmação e não havia terminal nem
  `--yes`), `cancelled` (a pessoa disse não), `blocked` (integridade, sistema ou programa ausente) e `error`.
- **O que NÃO grava:** a saída (`stdout`/`stderr`) do script nem o ambiente.
- **Máscara (melhor esforço):** valor de opções com nome sensível (`--token`, `--password`, `--api-key`,
  `GITHUB_TOKEN=…`), credenciais pelo formato (`ghp_…`, `github_pat_…`, `glpat-…`, `sk-…`, `xox…-`, `AKIA…`, JWT),
  senha dentro de URL, e argumentos acima de 200 caracteres são cortados. **Não confie na máscara: não passe
  segredos por argumento; use variável de ambiente ou arquivo.**
- **Nunca derruba o comando:** se o log não puder ser gravado, a execução segue.
- Exemplo para consultar o que agentes executaram: `grep '"interactive":false' ~/.vox/audit.log`.

## Limitações e riscos que **permanecem**

1. **Não há sandbox.** O script roda com os privilégios do usuário. Um script revisado e mesmo assim
   malicioso causa dano. Não existe sandbox portável entre Windows, macOS e Linux; a defesa é **revisão +
   `risk` honesto + auditoria**, não isolamento.
2. **O hash protege contra adulteração parcial ou acidental, não contra quem controla a instalação inteira.**
   Quem consegue escrever em `vox-scripts/` também consegue reescrever o `index.json` ao lado. A defesa real
   contra isso é a integridade do **pacote npm** (provenance, `npm audit signatures`, tarball verificado pelo npm
   na instalação).
3. **`risk` é declarado pelo autor** e não é verificável por máquina. Um script `read` que apaga coisas só é
   pego na **revisão**.
4. **`--yes` é uma convenção, não uma barreira.** Um agente induzido por prompt injection pode passar `--yes`.
   O guia do agente instrui a só usá-lo quando o usuário pediu, mas a imposição real é do **cliente do agente**
   (aprovação de comandos). Para scripts `destructive`, prefira exigir confirmação humana no cliente. O [ADR 0003](../adr/0003-permissoes-scripts-destrutivos.md) exige `--confirm=<pasta alvo>` além de `--yes` em `destructive` sem terminal.
5. **A máscara do log é heurística.** Segredos com formato incomum passam. Cobertos: opções e variáveis com
   nome sensível (`--token`, `*_SECRET`), cabeçalhos (`Authorization`, `Cookie`, `X-*-Key`), `Bearer`/`Basic`,
   senha em URL, segredo em query string e prefixos conhecidos (GitHub, GitLab, npm, Stripe, Slack, AWS, Google,
   JWT). **Não** cobertos: segredo posicional sem pista (`vox deploy minha-senha`), valor em base64 sem prefixo
   e segredo escrito pelo próprio script na saída. Não passe segredo por argumento.
6. **Janela entre verificar e executar** (TOCTOU): mínima; quem consegue explorá-la já escreve nos arquivos do
   usuário.
7. **O interpretador é o do usuário** (Node, Bash, Python). Se estiver comprometido, o runner não ajuda.

## Checklist de revisão de um script (para quem aprova o PR)

- [ ] `risk` está **correto**? Na dúvida, o mais alto. `read` não pode criar, alterar nem apagar nada, nem rede com efeito colateral.
- [ ] Faz **só** o que a `description` diz? Nada de coleta, envio de dados ou download-e-execução (`curl | sh`).
- [ ] Não lê credenciais fora do necessário; não imprime segredos; não os pede por argumento.
- [ ] Operações destrutivas têm escopo **explícito** (nunca `rm -rf` de caminho montado por entrada sem validar); respeita `VOX_YES`/`VOX_NO_INPUT`.
- [ ] `requires`, `os` e `timeoutSec` declarados e realistas.
- [ ] **Nunca** pede entrada com `VOX_NO_INPUT=1` (falha com mensagem clara).
- [ ] Sem binários, minificados ou ofuscados; sem dependências baixadas em tempo de execução sem versão fixa e hash.
- [ ] (Após ADR 0003) `effects` declarados batem com o que o código realmente apaga, instala ou acessa na rede.
- [ ] Testado nos sistemas declarados em `os`; `--dry-run` mostra o comando esperado.
- [ ] `.sh` com fim de linha LF.

## Se um script ruim for publicado

1. Remova o script e publique uma nova versão pelo fluxo normal (`develop` → staging → `master` → Promote).
2. Aponte `latest` para a última versão boa (workflow **Rollback latest**) e `npm deprecate` a versão ruim
   (nunca `unpublish`). Veja [RELEASING.md](../RELEASING.md).
3. Avise os usuários: o log `~/.vox/audit.log` mostra se o script chegou a ser executado naquela máquina.

## Pendências

- [x] **Aprovação humana desta revisão de segurança:** dada pelo dono do repositório em 2026-10-14.
- [x] _Private vulnerability reporting_ habilitado no GitHub (ver [SECURITY.md](../../SECURITY.md)).
- [x] Decidido em [ADR 0003](../adr/0003-permissoes-scripts-destrutivos.md): `destructive` sem terminal exigirá `--confirm=<pasta alvo>` além de `--yes`.
- [x] ADR 0003 implementado (#82): `effects`, validação do alvo, `--confirm` e auditoria.
