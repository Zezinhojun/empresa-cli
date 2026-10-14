#!/usr/bin/env node
/**
 * Smoke test do pacote publicável: build → npm pack → install em diretório
 * temporário → executa a CLI instalada. Falha (exit 1) se algo quebrar.
 * Uso: npm run smoke
 */
import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const ALLOWED = /^(dist\/.+|package\.json|README\.md|LICENSE)$/;

const run = (cmd, cwd = ROOT) =>
  execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const assert = (ok, msg) => {
  if (!ok) throw new Error(`SMOKE FALHOU: ${msg}`);
  console.log(`✔ ${msg}`);
};

const work = mkdtempSync(join(tmpdir(), 'vox-smoke-'));
try {
  run('npm run build');
  const [{ files, filename }] = JSON.parse(run(`npm pack --json --pack-destination "${work}"`));

  const extras = files.map((f) => f.path).filter((p) => !ALLOWED.test(p));
  assert(
    extras.length === 0,
    `tarball só contém arquivos de runtime (extras: ${extras.join(', ') || 'nenhum'})`,
  );

  run('npm init -y', work);
  run(`npm install --no-audit --no-fund "${join(work, filename)}"`, work);

  const entry = join(work, 'node_modules', pkg.name, pkg.bin.vox);
  assert(readFileSync(entry, 'utf8').startsWith('#!/usr/bin/env node'), 'bin tem shebang');

  // HOME isolado com uma pasta ~/vox/arquitetura de teste (nas máquinas de CI ela não existe)
  const home = join(work, 'home');
  mkdirSync(join(home, 'vox', 'arquitetura', 'servicos'), { recursive: true });
  writeFileSync(join(home, 'vox', 'arquitetura', 'leia-me.txt'), 'oi');
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.CI; // o smoke simula uma pessoa/agente; CI=true só desliga prompts

  // sem terminal (stdin/stdout em pipe), exatamente como um agente chamaria
  const exec = (...args) =>
    spawnSync(process.execPath, [entry, ...args], { cwd: work, encoding: 'utf8', env });
  const vox = (...args) => {
    const r = exec(...args);
    if (r.status !== 0) throw new Error(`vox ${args.join(' ')} saiu com ${r.status}: ${r.stderr}`);
    return r.stdout;
  };
  const json = (...args) => JSON.parse(vox(...args, '--json')); // falha se stdout tiver algo além do JSON

  assert(vox('--version').trim() === pkg.version, `vox --version === ${pkg.version}`);
  const help = vox('--help');
  assert(
    ['menu', 'list-vox', 'top-memory'].every((c) => help.includes(c)),
    'vox --help lista todos os comandos',
  );
  assert(
    vox('list-vox').includes('servicos/'),
    'vox list-vox lista a pasta (texto simples fora de TTY)',
  );
  assert(/MB|WS/.test(vox('top-memory')), 'vox top-memory lista processos (ps/powershell reais)');

  const exitCode = (...args) => exec(...args).status;
  assert(exitCode('comando-que-nao-existe') === 2, 'comando inexistente sai com código 2');
  assert(exitCode('list-vox', '--opcao-inexistente') === 2, 'opção desconhecida sai com código 2');
  assert(
    vox('list-vox', '--help').includes('vox list-vox [subpasta]'),
    'vox <cmd> --help mostra o uso',
  );

  const semArgs = vox();
  assert(
    semArgs.includes('Comandos:') &&
      !semArgs.includes('Selecione um comando') &&
      !semArgs.includes('\u001B['),
    'vox sem argumentos e sem terminal mostra a ajuda (não abre menu, sem ANSI)',
  );
  assert(exitCode('menu') === 2, 'vox menu sem terminal recusa com código 2');

  // --- contrato JSON (docs/cli-contract.md) ---
  const lv = json('list-vox');
  assert(
    lv.ok === true &&
      lv.schemaVersion === 1 &&
      lv.command === 'list-vox' &&
      JSON.stringify(lv.data.items) ===
        JSON.stringify([
          { name: 'leia-me.txt', type: 'file' },
          { name: 'servicos', type: 'dir' },
        ]),
    'list-vox --json: stdout só com o envelope JSON e os dados corretos',
  );
  const cat = json('list');
  assert(
    ['list', 'list-vox', 'menu', 'top-memory'].every((n) =>
      cat.data.commands.some((c) => c.name === n),
    ) && cat.data.commands.every((c) => ['read', 'write', 'destructive'].includes(c.risk)),
    'vox list --json: catálogo com todos os comandos e o risco de cada um',
  );
  assert(
    json().data.commands.length === cat.data.commands.length,
    'vox --json sem args devolve o catálogo',
  );
  const mem = json('top-memory').data.processes;
  assert(
    mem.length > 0 && typeof mem[0].pid === 'number' && typeof mem[0].memoryMb === 'number',
    'top-memory --json: processos com pid e memoryMb numéricos',
  );

  assert(
    vox('agent-guide').includes('Guia rápido para agentes de IA'),
    'vox agent-guide imprime o guia embutido no pacote',
  );
  const guia = json('agent-guide').data;
  assert(
    guia.guide.length > 0 && guia.contract.length > 0 && guia.catalog.commands.length > 0,
    'agent-guide --json: guia + contrato + catálogo numa só chamada',
  );

  const ausente = exec('list-vox', 'nao-existe', '--json');
  assert(
    ausente.status === 1 &&
      ausente.stderr === '' &&
      JSON.parse(ausente.stdout).error.code === 'NOT_FOUND',
    'erro com --json: exit 1, JSON de erro em stdout e stderr vazio',
  );
  const fora = exec('list-vox', '../..', '--json');
  assert(
    fora.status === 2 && JSON.parse(fora.stdout).error.code === 'PATH_OUTSIDE_BASE',
    'list-vox não sai de ~/vox/arquitetura (../.. recusado, exit 2)',
  );
  console.log('\nSMOKE OK');
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(work, { force: true, recursive: true });
}
