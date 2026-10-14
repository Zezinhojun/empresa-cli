#!/usr/bin/env node
/**
 * Smoke test do pacote publicável: build → npm pack → install em diretório
 * temporário → executa a CLI instalada. Falha (exit 1) se algo quebrar.
 * Uso: npm run smoke
 */
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const ALLOWED = /^(dist\/.+|package\.json|README\.md|LICENSE)$/;

const run = (cmd, cwd = ROOT) => execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const assert = (ok, msg) => {
  if (!ok) throw new Error(`SMOKE FALHOU: ${msg}`);
  console.log(`✔ ${msg}`);
};

const work = mkdtempSync(join(tmpdir(), 'vox-smoke-'));
try {
  run('npm run build');
  const [{ files, filename }] = JSON.parse(run(`npm pack --json --pack-destination "${work}"`));

  const extras = files.map((f) => f.path).filter((p) => !ALLOWED.test(p));
  assert(extras.length === 0, `tarball só contém arquivos de runtime (extras: ${extras.join(', ') || 'nenhum'})`);

  run('npm init -y', work);
  run(`npm install --no-audit --no-fund "${join(work, filename)}"`, work);

  const entry = join(work, 'node_modules', pkg.name, pkg.bin.vox);
  assert(readFileSync(entry, 'utf8').startsWith('#!/usr/bin/env node'), 'bin tem shebang');

  const vox = (...args) => execFileSync(process.execPath, [entry, ...args], { cwd: work, encoding: 'utf8' });

  assert(vox('--version').trim() === pkg.version, `vox --version === ${pkg.version}`);
  const help = vox('--help');
  assert(['menu', 'list-vox', 'clean-memory'].every((c) => help.includes(c)), 'vox --help lista todos os comandos');
  vox('list-vox');
  assert(true, 'vox list-vox executa sem erro');

  let code = 0;
  try {
    vox('comando-que-nao-existe');
  } catch (e) {
    code = e.status;
  }
  assert(code === 1, 'comando inexistente sai com código 1');
  console.log('\nSMOKE OK');
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(work, { force: true, recursive: true });
}