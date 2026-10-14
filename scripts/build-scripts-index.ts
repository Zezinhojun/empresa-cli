/**
 * Gera `vox-scripts/index.json` (manifestos validados + SHA-256 de cada arquivo).
 * Roda no build, DEPOIS do tsup: usa a própria CLI buildada para saber quais nomes de comando
 * já são dos comandos nativos e não podem ser usados por scripts.
 *
 * Uso: npm run scripts:index
 *
 * `VOX_ROOT=<pasta>` aponta para OUTRA raiz de pacote (com `dist/` e `vox-scripts/`), em vez do
 * repositório: o smoke test usa isso para indexar scripts de teste dentro de um pacote já instalado.
 */
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { buildIndex, INDEX_FILE, ScriptIndexError } from '../src/runner/scriptIndex.js';

const ROOT = process.env.VOX_ROOT
  ? path.resolve(process.env.VOX_ROOT)
  : path.resolve(import.meta.dirname, '..');
const SCRIPTS = path.join(ROOT, 'vox-scripts');
const CLI = path.join(ROOT, 'dist', 'index.js');

try {
  // Um índice antigo e inválido não pode derrubar a CLI que vamos consultar.
  rmSync(path.join(SCRIPTS, INDEX_FILE), { force: true });

  const catalog = JSON.parse(
    execFileSync(process.execPath, [CLI, 'list', '--json'], { encoding: 'utf8' }),
  ) as {
    data: { commands: { kind: string; name: string }[] };
  };
  const reserved = catalog.data.commands.filter((c) => c.kind === 'builtin').map((c) => c.name);

  const index = buildIndex(SCRIPTS, reserved);
  writeFileSync(path.join(SCRIPTS, INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`);
  console.log(`vox-scripts: ${index.scripts.length} script(s) indexado(s)`);
} catch (error) {
  console.error(error instanceof ScriptIndexError ? error.message : error);
  process.exitCode = 1;
}
