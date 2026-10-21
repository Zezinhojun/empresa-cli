# Scripts da vox

Cada pasta aqui dentro vira um **comando da CLI**: `vox <nome>`. Os scripts viajam **dentro do pacote npm**,
então passam por PR, revisão e CI como qualquer outro código (decisão em
[ADR 0002](../docs/adr/0002-scripts-empacotados.md)). Quem usa **não precisa saber** se o script é `.sh`,
`.py` ou `.js`: a `vox` descobre como executar.

> **Segurança:** scripts são código executado na máquina de todos. Leia o
> [modelo de ameaças](../docs/security/runner.md) e use o checklist de revisão dele. A revisão de segurança do
> **runner** foi aprovada pelo dono do repositório (2026-10-14); **cada script novo** ainda precisa passar
> pelo checklist no próprio PR (o template de PR já traz os itens).

## Como criar um script

```
vox-scripts/
  setup-wordpress/          ← nome da pasta = nome do comando
    manifest.json           ← o contrato do script (obrigatório)
    setup.sh                ← arquivo de entrada (pode ter arquivos de apoio ao lado)
```

`manifest.json`:

```json
{
  "name": "setup-wordpress",
  "description": "Prepara um ambiente WordPress local",
  "entry": "setup.sh",
  "args": [{ "name": "pasta", "description": "Onde criar o ambiente", "required": true }],
  "risk": "write",
  "os": ["darwin", "linux"],
  "requires": ["docker"],
  "timeoutSec": 300,
  "category": "setup"
}
```

| Campo         | Obrigatório | O que é                                                                                                                                                                                                |
| ------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`        | sim         | Nome do comando: minúsculas e hífens (`setup-wordpress`), até 40 caracteres. **Igual ao da pasta.** Não pode repetir um comando existente.                                                             |
| `description` | sim         | O que faz, **em linguagem simples** (aparece no menu e em `vox list`). Até 200 caracteres.                                                                                                             |
| `entry`       | sim         | Arquivo a executar, relativo à pasta. `.js`/`.mjs`/`.cjs`, `.sh` ou `.py`. O runtime sai da extensão.                                                                                                  |
| `risk`        | sim         | `read` (só lê), `write` (altera coisas) ou `destructive` (pode apagar). Veja abaixo.                                                                                                                   |
| `args`        | não         | Argumentos posicionais (`name`, `description`, `required`). Obrigatórios vêm antes dos opcionais.                                                                                                      |
| `os`          | não         | Sistemas onde funciona: `darwin`, `linux`, `win32`. Padrão: todos.                                                                                                                                     |
| `requires`    | não         | Programas que precisam estar instalados (ex.: `docker`, `git`). A CLI confere antes de executar.                                                                                                       |
| `timeoutSec`  | não         | Tempo máximo, de 1 a 3600 (padrão 300). Passou disso, o script é interrompido.                                                                                                                         |
| `effects`     | não         | O que o script apaga, instala ou acessa: `delete:node_modules`, `delete:vendor`, `delete:var`, `install:npm`, `install:composer`, `network`. Só informa; a revisão do PR confere se bate com o código. |
| `category`    | não         | Agrupa no menu interativo.                                                                                                                                                                             |

Campos que não existem nesta tabela são **rejeitados** (assim um erro de digitação como `riks` não passa batido).

### Escolhendo o tipo de script

| Quem vai usar                                | Use                                                               |
| -------------------------------------------- | ----------------------------------------------------------------- |
| **Todos**, inclusive quem está no Windows    | **`.js`** — o Node já é pré-requisito da CLI, então sempre existe |
| Quem tem Bash (macOS/Linux; Windows com Git) | `.sh` — declare `os`/`requires` se depender de algo específico    |
| Quem tem Python 3                            | `.py` — idem                                                      |

**Atenção com `.js`:** dentro do pacote ele é **ESM** (`"type": "module"`): use `import`, não `require`. Para
CommonJS use a extensão `.cjs`. Scripts `.sh` precisam de fim de linha **LF** (o `.gitattributes` já garante
isso no checkout; com CRLF o Bash falha no Linux/macOS).

No Windows não há Bash nem Python por padrão. Se faltar, a CLI **não executa** e explica o que instalar
(`vox doctor` mostra a situação do computador).

### Risco e confirmação

| `risk`        | Pessoa no terminal              | Agente de IA / sem terminal                                    |
| ------------- | ------------------------------- | -------------------------------------------------------------- |
| `read`        | executa                         | executa                                                        |
| `write`       | pergunta antes (ou `--yes`)     | exige `--yes`, senão falha com código `4`                      |
| `destructive` | pergunta com aviso (ou `--yes`) | exige `--yes` **e** `--confirm=<pasta alvo>`, senão código `4` |

Na dúvida, escolha o risco **mais alto**. O menu mostra `[altera coisas]` / `[pode apagar dados]` ao lado do comando.

Script `destructive` (ou que declara `effects` de apagar/instalar) só roda dentro de um **projeto** (a pasta atual
precisa ter `package.json` ou `composer.json`; `~`, a raiz do disco e pastas do sistema são recusados, e
`node_modules`/`vendor`/`var` não podem ser links simbólicos). Para `destructive` **sem terminal**, `--yes` não basta: passe também
`--confirm=<nome da pasta alvo>`, ou o comando falha com código `4`
([ADR 0003](../docs/adr/0003-permissoes-scripts-destrutivos.md)).

## O que o script recebe

- **Argumentos:** exatamente como a pessoa digitou, um por posição (`$1`, `sys.argv[1]`, `process.argv[2]`).
  Nada é reinterpretado por shell: espaços, aspas, `;`, `$(…)` chegam literais.
- **Diretório atual:** de onde a pessoa chamou a `vox`.
- **Variáveis de ambiente:** só o essencial (`PATH`, `HOME`, `TEMP`, idioma…). Tokens e chaves do ambiente
  **não** são repassados. Além disso: `VOX_JSON`, `VOX_NO_INPUT`, `VOX_YES` (`1`/`0`), `VOX_SCRIPT_DIR`
  (pasta do script, para achar arquivos de apoio) e `VOX_VERSION`.
- **Entrada (stdin):** só há se houver um terminal interativo. Com `VOX_NO_INPUT=1`, **nunca peça nada**:
  falhe com uma mensagem clara.
- **Saída:** escreva o resultado em `stdout` e avisos em `stderr`. Saia com `0` em sucesso; qualquer outro
  código vira o erro `SCRIPT_FAILED` (com o código real em `error.details.exitCode`).

## Integridade e auditoria

- **Integridade:** no build, cada arquivo do script recebe um SHA-256. Antes de executar, a CLI confere a
  pasta inteira: arquivo **alterado, removido, acrescentado** ou **link simbólico** reprova (`INTEGRITY_ERROR`)
  e **nada executa**. Por isso: não crie arquivos dentro da pasta do script em tempo de execução (use um
  diretório temporário) e **não use links simbólicos**.
- **Auditoria:** toda tentativa de executar (inclusive as negadas e as bloqueadas) é gravada em
  `~/.vox/audit.log`: quem, quando, qual script, argumentos (com segredos mascarados), risco, resultado.
  A saída do script **não** é gravada. **Não passe segredos por argumento**; use variável de ambiente ou arquivo.

## Testando

```bash
npm run build                 # valida os manifestos e gera vox-scripts/index.json
vox list --json               # o script aparece no catálogo (kind: "script")
vox <nome> --dry-run          # mostra o que seria executado, sem executar
vox <nome> <args> --json      # executa e devolve stdout/stderr no JSON
```

O build **falha** se algum manifesto for inválido, se o nome repetir outro comando ou se o arquivo de entrada
não existir, listando todos os problemas de uma vez. O `npm test` valida o mesmo antes mesmo do build.
