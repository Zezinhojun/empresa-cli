#!/usr/bin/env node
/**
 * Smoke test do pacote publicável: build → npm pack → install em diretório
 * temporário → executa a CLI instalada. Falha (exit 1) se algo quebrar.
 * Uso: npm run smoke
 */
import { execSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const ALLOWED = /^(dist\/.+|package\.json|README\.md|LICENSE|mycli-scripts\/.+)$/;
/** Tamanho máximo do tarball (comprimido): um salto grande aqui geralmente é arquivo que não devia entrar. */
const MAX_TARBALL_BYTES = 300_000;

const run = (cmd, cwd = ROOT) =>
  execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const assert = (ok, msg) => {
  if (!ok) throw new Error(`SMOKE FALHOU: ${msg}`);
  console.log(`✔ ${msg}`);
};

const work = mkdtempSync(join(tmpdir(), 'mycli-smoke-'));
try {
  run('npm run build');
  const [{ files, filename, size }] = JSON.parse(
    // --ignore-scripts: o build acabou de rodar acima; o prepack imprimiria o log dele no meio do JSON
    run(`npm pack --ignore-scripts --json --pack-destination "${work}"`),
  );

  const paths = files.map((f) => f.path);
  const extras = paths.filter((p) => !ALLOWED.test(p));
  assert(
    extras.length === 0,
    `tarball só contém arquivos de runtime (extras: ${extras.join(', ') || 'nenhum'})`,
  );
  assert(
    paths.includes('mycli-scripts/index.json') && !paths.includes('mycli-scripts/README.md'),
    'tarball leva o índice de scripts (mycli-scripts/index.json) e não leva o README de desenvolvimento',
  );
  assert(size < MAX_TARBALL_BYTES, `tarball pequeno: ${size} bytes (< ${MAX_TARBALL_BYTES})`);

  run('npm init -y', work);
  run(`npm install --no-audit --no-fund "${join(work, filename)}"`, work);

  const entry = join(work, 'node_modules', pkg.name, pkg.bin.mycli);
  assert(readFileSync(entry, 'utf8').startsWith('#!/usr/bin/env node'), 'bin tem shebang');

  // HOME isolado com uma pasta ~/mycli/files de teste (nas máquinas de CI ela não existe)
  const home = join(work, 'home');
  mkdirSync(join(home, 'mycli', 'files', 'servicos'), { recursive: true });
  writeFileSync(join(home, 'mycli', 'files', 'leia-me.txt'), 'oi');
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.CI; // o smoke simula uma pessoa/agente; CI=true só desliga prompts

  // sem terminal (stdin/stdout em pipe), exatamente como um agente chamaria
  const exec = (...args) =>
    spawnSync(process.execPath, [entry, ...args], { cwd: work, encoding: 'utf8', env });
  const mycli = (...args) => {
    const r = exec(...args);
    if (r.status !== 0)
      throw new Error(`mycli ${args.join(' ')} saiu com ${r.status}: ${r.stderr}`);
    return r.stdout;
  };
  const json = (...args) => JSON.parse(mycli(...args, '--json')); // falha se stdout tiver algo além do JSON

  assert(mycli('--version').trim() === pkg.version, `mycli --version === ${pkg.version}`);
  const help = mycli('--help');
  assert(
    ['menu', 'list-files', 'top-memory'].every((c) => help.includes(c)),
    'mycli --help lista todos os comandos',
  );
  assert(
    mycli('list-files').includes('servicos/'),
    'mycli list-files lista a pasta (texto simples fora de TTY)',
  );
  assert(
    /MB|WS/.test(mycli('top-memory')),
    'mycli top-memory lista processos (ps/powershell reais)',
  );

  const exitCode = (...args) => exec(...args).status;
  assert(exitCode('comando-que-nao-existe') === 2, 'comando inexistente sai com código 2');
  assert(
    exitCode('list-files', '--opcao-inexistente') === 2,
    'opção desconhecida sai com código 2',
  );
  assert(
    mycli('list-files', '--help').includes('mycli list-files [subpasta]'),
    'mycli <cmd> --help mostra o uso',
  );

  const semArgs = mycli();
  assert(
    semArgs.includes('Comandos:') &&
      !semArgs.includes('Selecione um comando') &&
      !semArgs.includes('\u001B['),
    'mycli sem argumentos e sem terminal mostra a ajuda (não abre menu, sem ANSI)',
  );
  assert(exitCode('menu') === 2, 'mycli menu sem terminal recusa com código 2');

  // --- contrato JSON (docs/cli-contract.md) ---
  const lv = json('list-files');
  assert(
    lv.ok === true &&
      lv.schemaVersion === 1 &&
      lv.command === 'list-files' &&
      JSON.stringify(lv.data.items) ===
        JSON.stringify([
          { name: 'leia-me.txt', type: 'file' },
          { name: 'servicos', type: 'dir' },
        ]),
    'list-files --json: stdout só com o envelope JSON e os dados corretos',
  );
  const cat = json('list');
  assert(
    ['list', 'list-files', 'menu', 'top-memory'].every((n) =>
      cat.data.commands.some((c) => c.name === n),
    ) && cat.data.commands.every((c) => ['read', 'write', 'destructive'].includes(c.risk)),
    'mycli list --json: catálogo com todos os comandos e o risco de cada um',
  );
  assert(
    json().data.commands.length === cat.data.commands.length,
    'mycli --json sem args devolve o catálogo',
  );
  const mem = json('top-memory').data.processes;
  assert(
    mem.length > 0 && typeof mem[0].pid === 'number' && typeof mem[0].memoryMb === 'number',
    'top-memory --json: processos com pid e memoryMb numéricos',
  );

  assert(
    mycli('agent-guide').includes('Guia rápido para agentes de IA'),
    'mycli agent-guide imprime o guia embutido no pacote',
  );
  const guia = json('agent-guide').data;
  assert(
    guia.guide.length > 0 && guia.contract.length > 0 && guia.catalog.commands.length > 0,
    'agent-guide --json: guia + contrato + catálogo numa só chamada',
  );

  const doctor = json('doctor').data;
  assert(
    ['node', 'bash', 'python'].every((r) => doctor.checks.some((c) => c.runtime === r)) &&
      doctor.checks.find((c) => c.runtime === 'node').ok,
    'mycli doctor --json: confere Node, Bash e Python (o Node sempre ok)',
  );
  assert(
    mycli('doctor').includes('Verificando este computador'),
    'mycli doctor imprime o diagnóstico em texto simples',
  );

  const ausente = exec('list-files', 'nao-existe', '--json');
  assert(
    ausente.status === 1 &&
      ausente.stderr === '' &&
      JSON.parse(ausente.stdout).error.code === 'NOT_FOUND',
    'erro com --json: exit 1, JSON de erro em stdout e stderr vazio',
  );
  const fora = exec('list-files', '../..', '--json');
  assert(
    fora.status === 2 && JSON.parse(fora.stdout).error.code === 'PATH_OUTSIDE_BASE',
    'list-files não sai de ~/mycli/files (../.. recusado, exit 2)',
  );
  // --- scripts empacotados: um de cada tipo, no pacote INSTALADO ---
  // Os scripts de teste vivem em test/fixtures (nunca empacotados). Aqui eles são copiados para o
  // pacote instalado e indexados, como o build faria, para exercitar descoberta, execução e integridade.
  const pkgDir = join(work, 'node_modules', pkg.name);
  cpSync(join(ROOT, 'test', 'fixtures', 'scripts'), join(pkgDir, 'mycli-scripts'), {
    recursive: true,
  });
  execSync('npx tsx scripts/build-scripts-index.ts', {
    cwd: ROOT,
    env: { ...process.env, MYCLI_ROOT: pkgDir },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  const catalog = json('list').data.commands;
  const scripts = catalog.filter((c) => c.kind === 'script').map((c) => c.name);
  assert(
    ['smoke-js', 'smoke-py', 'smoke-sh'].every((n) => scripts.includes(n)),
    'mycli list --json: os scripts do pacote aparecem como comandos (kind: script)',
  );

  const available = Object.fromEntries(json('doctor').data.checks.map((c) => [c.runtime, c.ok]));
  const cases = [
    ['smoke-js', 'node', 'js:["a b","c"]'],
    ['smoke-sh', 'bash', 'sh:a b c'],
    ['smoke-py', 'python', 'py:a b|c'],
  ];
  for (const [name, runtime, expected] of cases) {
    if (!available[runtime]) {
      console.log(`⚠ ${name} ignorado: este computador não tem ${runtime} (mycli doctor)`);
      continue;
    }
    const out = json(name, 'a b', 'c').data;
    assert(
      out.exitCode === 0 && out.runtime === runtime && out.stdout.trim() === expected,
      `${name} executa pelo pacote instalado, com argumento com espaço intacto (${expected})`,
    );
  }

  const auditFile = join(home, '.mycli', 'audit.log');
  assert(
    existsSync(auditFile) && readFileSync(auditFile, 'utf8').includes('"script":"smoke-js"'),
    'a execução ficou registrada em ~/.mycli/audit.log',
  );

  // --- máquina SEM Bash nem Python: o caminho "falta o interpretador" ---
  // PATH vazio (a CLI é chamada pelo caminho absoluto do Node) e as pastas onde o Git para Windows
  // costuma ficar apontando para o vazio: não há Bash nem Python possível de achar. É o computador de
  // quem nunca instalou nada; o Node, que roda a própria CLI, sempre existe.
  const vazio = join(work, 'maquina-sem-nada');
  mkdirSync(vazio);
  // No Windows, SOBRESCREVER ProgramFiles num processo filho é ignorado (ele segue vendo
  // C:\Program Files), mas REMOVER funciona: sem essas raízes, não há onde procurar o Git Bash.
  const RAIZES_DO_GIT = ['PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMW6432', 'LOCALAPPDATA'];
  const bareEnv = Object.fromEntries(
    Object.entries(env)
      .filter(([k]) => !RAIZES_DO_GIT.includes(k.toUpperCase()))
      .map(([k, v]) => [k, k.toUpperCase() === 'PATH' ? vazio : v]),
  );
  const bare = (...args) =>
    spawnSync(process.execPath, [entry, ...args], { cwd: work, encoding: 'utf8', env: bareEnv });

  const checks = Object.fromEntries(
    JSON.parse(bare('doctor', '--json').stdout).data.checks.map((c) => [c.runtime, c]),
  );
  assert(
    checks.node.ok &&
      !checks.bash.ok &&
      !checks.python.ok &&
      checks.bash.install &&
      checks.python.install,
    'sem Bash nem Python: mycli doctor diz o que falta e como instalar (o Node sempre está)',
  );
  assert(
    JSON.parse(bare('smoke-js', 'a b', 'c', '--json').stdout).data.stdout.trim() ===
      'js:["a b","c"]',
    'sem Bash nem Python, os scripts .js continuam funcionando',
  );
  for (const [name, label] of [
    ['smoke-sh', 'Bash'],
    ['smoke-py', 'Python 3'],
  ]) {
    const r = bare(name, 'a', '--json');
    const { error } = JSON.parse(r.stdout);
    assert(
      r.status === 3 &&
        r.stderr === '' &&
        error.code === 'MISSING_RUNTIME' &&
        error.message.includes(`precisa do ${label}`) &&
        error.hint.includes('mycli doctor') &&
        !/ENOENT|spawn/.test(r.stdout),
      `${name} sem ${label}: exit 3, MISSING_RUNTIME e instruções de instalação (nunca "ENOENT")`,
    );
  }
  const humano = bare('smoke-py', 'a');
  assert(
    humano.status === 3 &&
      humano.stdout === '' &&
      humano.stderr.includes('Python 3') &&
      !/ENOENT|spawn|\bat /.test(humano.stderr),
    'em modo texto a falta do Python vai para stderr, sem stack nem jargão técnico',
  );

  // adulteração depois da instalação: o script alterado NÃO executa
  const marker = join(work, 'executou-adulterado.txt');
  appendFileSync(
    join(pkgDir, 'mycli-scripts', 'smoke-js', 'run.js'),
    `\nimport('node:fs').then((fs) => fs.writeFileSync(${JSON.stringify(marker)}, 'x'));\n`,
  );
  const adulterado = exec('smoke-js', 'a b', 'c', '--json');
  assert(
    adulterado.status === 1 &&
      JSON.parse(adulterado.stdout).error.code === 'INTEGRITY_ERROR' &&
      !existsSync(marker),
    'script adulterado depois da instalação é barrado (INTEGRITY_ERROR) e NÃO executa',
  );
  console.log('\nSMOKE OK');
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(work, { force: true, recursive: true });
}
