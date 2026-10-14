# ADR 0002 — Scripts empacotados no pacote npm (modelo do runner)

- **Status:** aceito
- **Data:** 2026-10-14
- **Issue:** #42 (épico do runner: #43 a #48)

## Contexto

A `vox` precisa executar scripts `.sh`, `.py` e `.js` **sem que o usuário saiba o que são**, em máquinas de
devs e não-devs, e também quando chamada por agentes de IA (sem alguém olhando). Um script é código
arbitrário: a origem dele define a segurança de todo o runner.

## Decisão

### 1. Origem: os scripts viajam **dentro do pacote npm**

Os scripts ficam no repositório, em `vox-scripts/`, e são publicados junto com a CLI. Consequências desejadas:

- passam por **PR + revisão + CI** e pelo mesmo pipeline de staging → produção (com _provenance_);
- a versão da CLI identifica exatamente quais scripts existem e qual o conteúdo deles;
- não há download em tempo de execução, nem pasta do usuário, nem fonte remota na v1.

Atualizar um script = nova release. Pasta do usuário (`~/vox/scripts`) e fontes remotas ficam **fora da v1**;
se vierem, terão ADR próprio, com confirmação explícita e assinatura.

### 2. Estrutura e manifesto

```
vox-scripts/<nome>/
  manifest.json     # contrato do script
  <entrada>.sh|.py|.js
  ...               # arquivos de apoio (templates etc.)
```

```jsonc
{
  "name": "setup-wordpress", // nome do comando: kebab-case, único; não pode colidir com comando nativo
  "description": "Prepara um ambiente WordPress local", // linguagem simples, obrigatório
  "entry": "setup.sh", // o runtime é deduzido da extensão — o usuário nunca escolhe
  "args": [{ "name": "pasta", "description": "Onde criar o ambiente", "required": true }],
  "risk": "write", // read | write | destructive — obrigatório
  "os": ["win32", "linux", "darwin"], // opcional; padrão: todos
  "requires": ["docker"], // opcional; executáveis extras que precisam estar no PATH
  "timeoutSec": 300, // opcional; padrão 300, máximo 3600
  "category": "setup", // opcional; agrupa no menu
}
```

Manifesto inválido, sem `description` ou `risk`, ou com nome repetido/colidindo **quebra o build/CI** (#45).

### 3. Runtimes e plataforma

| Extensão      | Interpretador                              | Disponibilidade                              |
| ------------- | ------------------------------------------ | -------------------------------------------- |
| `.js`, `.mjs` | `process.execPath` (o próprio Node da CLI) | **Sempre** (a CLI já exige Node)             |
| `.sh`         | `bash` (Windows: Git Bash, depois WSL)     | Linux/macOS sim; **Windows só se instalado** |
| `.py`         | `python3`, `python`, `py -3` (nessa ordem) | **Não garantido** em nenhum SO               |

**Regra de ouro:** script destinado a **todos** (não-devs, Windows) deve ser **`.js`**. `.sh` e `.py` são para
quem tem o runtime e **declaram** `os`/`requires`; se faltar algo, a CLI **não executa** e explica em português
simples o que instalar, com código de saída `3` (`vox doctor`, #44).

> **Premissa a confirmar:** quais SOs os não-devs usam não foi informado. Assumimos o pior caso (Windows sem
> bash nem Python), por isso `.js` é o padrão. Se a base for só macOS/Linux, a regra pode ser relaxada.

### 4. Contrato de execução

- **Sem shell:** `execa(interpretador, [entrada, ...args])`, argumentos sempre em array. Nada de interpolar string.
- **Ambiente:** variáveis herdadas por **allowlist** (PATH, HOME/USERPROFILE, TEMP/TMP, LANG, SystemRoot…),
  mais `VOX_JSON`, `VOX_NO_INPUT`, `VOX_YES`, `VOX_SCRIPT_DIR` e `VOX_VERSION`. Segredos do ambiente do usuário
  não vazam para o script por padrão.
- **cwd:** o diretório de onde o usuário chamou a `vox`.
- **Streams:** em modo humano, stdout/stderr do script fluem em tempo real; com `--json`, são capturados
  (com limite de tamanho) e devolvidos em `data`. O stdin só é repassado quando a execução é interativa.
- **Resultado:** código 0 = sucesso. Qualquer outro vira o erro `SCRIPT_FAILED` (saída `1`) com o código real
  do script em `error`/`data`. Timeout vira `SCRIPT_TIMEOUT`.
- **`--dry-run`:** mostra o que seria executado (interpretador, entrada, argumentos), sem executar.

### 5. Risco e confirmação (modelo de ameaças detalhado em #46)

| `risk`        | Pessoa no terminal              | Agente / sem terminal                     |
| ------------- | ------------------------------- | ----------------------------------------- |
| `read`        | executa                         | executa                                   |
| `write`       | pergunta (ou `--yes`)           | exige `--yes`, senão falha com código `4` |
| `destructive` | pergunta com aviso (ou `--yes`) | exige `--yes`, senão falha com código `4` |

### 6. Integridade

No build, gera-se `vox-scripts/index.json` com o **SHA-256** de cada arquivo de cada script. O runner confere
o hash antes de executar e recusa script adulterado. O índice também alimenta menu, `--help` e
`vox list --json` — **sem varrer diretórios em tempo de execução** (lição do #3).

## Alternativas consideradas

- **Pasta do usuário (`~/vox/scripts`):** flexível, mas executa código que ninguém revisou; descartada na v1.
- **Repositório/registro remoto:** atualiza sem release, mas exige assinatura, rede e confiança em outro canal; descartada na v1.
- **Declarar o runtime no manifesto:** exigiria o autor e o usuário pensarem nisso; deduzir da extensão é suficiente.

## Consequências

- Todo script novo exige PR, revisão e release. É mais lento, e é exatamente o controle desejado.
- O pacote cresce com os scripts; o tamanho passa a ser monitorado (#47).
- `.sh` precisa de fim de linha LF no repositório (`.gitattributes`) para não quebrar em Linux/macOS (#47).
- O primeiro script real só entra depois da revisão de segurança do runner (#46).
