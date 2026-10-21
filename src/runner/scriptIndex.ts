import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ManifestError, parseManifest, type Manifest } from './manifest.js';

export const INDEX_FILE = 'index.json';
const MANIFEST_FILE = 'manifest.json';

export interface IndexedScript {
  /** Nome da pasta (sempre igual a `manifest.name`). */
  dir: string;
  /** SHA-256 de cada arquivo da pasta, por caminho relativo (com "/"). */
  files: Record<string, string>;
  manifest: Manifest;
}

export interface ScriptIndex {
  schemaVersion: 1;
  scripts: IndexedScript[];
}

/** Todos os problemas encontrados nos scripts, de uma vez. */
export class ScriptIndexError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Scripts inválidos:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ScriptIndexError';
  }
}

const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

interface Scan {
  /** Arquivos comuns, como caminhos relativos com "/", em ordem estável. */
  files: string[];
  /** Links simbólicos: não são permitidos (poderiam apontar para fora da pasta do script). */
  symlinks: string[];
}

function scan(dir: string, prefix = ''): Scan {
  const result: Scan = { files: [], symlinks: [] };
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) result.symlinks.push(relative);
    else if (entry.isDirectory()) {
      const inner = scan(path.join(dir, entry.name), relative);
      result.files.push(...inner.files);
      result.symlinks.push(...inner.symlinks);
    } else result.files.push(relative);
  }
  result.files.sort();
  result.symlinks.sort();
  return result;
}

/** SHA-256 de cada arquivo da pasta, por caminho relativo. */
export function hashDirectory(dir: string): Record<string, string> {
  return Object.fromEntries(scan(dir).files.map((file) => [file, sha256(path.join(dir, file))]));
}

export interface IntegrityReport {
  /** Existem mas o conteúdo mudou. */
  changed: string[];
  /** Estão no índice mas sumiram. */
  missing: string[];
  /** Existem na pasta mas não estão no índice (código que ninguém revisou). */
  extra: string[];
  symlinks: string[];
}

/** Compara o que está instalado com os hashes do build. `ok` só se for idêntico, sem sobras. */
export function verifyDirectory(
  dir: string,
  expected: Record<string, string>,
): { ok: boolean } & IntegrityReport {
  const { files, symlinks } = scan(dir);
  const present = new Set(files);

  const missing = Object.keys(expected).filter((file) => !present.has(file));
  const extra = files.filter((file) => !(file in expected));
  const changed = files.filter(
    (file) => file in expected && sha256(path.join(dir, file)) !== expected[file],
  );

  return {
    changed,
    extra,
    missing,
    ok: changed.length + extra.length + missing.length + symlinks.length === 0,
    symlinks,
  };
}

/**
 * Lê `<root>/<script>/manifest.json` de cada script, valida e calcula os hashes.
 * Roda no BUILD: o runtime lê só o índice pronto, sem varrer pastas.
 *
 * @param reserved nomes que um script não pode usar (comandos nativos)
 */
export function buildIndex(root: string, reserved: Iterable<string> = []): ScriptIndex {
  const taken = new Set(reserved);
  const problems: string[] = [];
  const scripts: IndexedScript[] = [];

  const dirs = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort()
    : [];

  for (const dir of dirs) {
    const scriptDir = path.join(root, dir);
    const manifestPath = path.join(scriptDir, MANIFEST_FILE);
    const label = `${path.basename(root)}/${dir}`;

    if (!existsSync(manifestPath)) {
      problems.push(`${label}: falta o ${MANIFEST_FILE}`);
      continue;
    }

    let manifest: Manifest;
    try {
      manifest = parseManifest(
        JSON.parse(readFileSync(manifestPath, 'utf8')),
        `${label}/${MANIFEST_FILE}`,
      );
    } catch (error) {
      if (error instanceof ManifestError) {
        problems.push(...error.problems.map((p) => `${label}: ${p}`));
      } else problems.push(`${label}: ${MANIFEST_FILE} não é um JSON válido`);
      continue;
    }

    if (manifest.name !== dir) {
      problems.push(`${label}: a pasta deve se chamar "${manifest.name}" (igual ao "name")`);
    }
    if (taken.has(manifest.name)) {
      problems.push(`${label}: o nome "${manifest.name}" já é usado por outro comando`);
    }
    taken.add(manifest.name);

    const { files, symlinks } = scan(scriptDir);
    for (const link of symlinks) {
      problems.push(`${label}: "${link}" é um link simbólico (não permitido em scripts)`);
    }
    if (!files.includes(manifest.entry.replaceAll('\\', '/'))) {
      problems.push(`${label}: o arquivo de entrada "${manifest.entry}" não existe`);
    }

    // O Bash lê o CR como parte do comando e falha só na máquina de quem roda ("\r: command not found").
    for (const file of files.filter((name) => name.endsWith('.sh'))) {
      if (readFileSync(path.join(scriptDir, file)).includes('\r\n')) {
        problems.push(`${label}: "${file}" usa fim de linha CRLF; converta para LF`);
      }
    }

    scripts.push({ dir, files: hashDirectory(scriptDir), manifest });
  }

  if (problems.length > 0) throw new ScriptIndexError(problems);
  return { schemaVersion: 1, scripts };
}

/** Lê o índice gerado no build. `undefined` se não existir (nenhum script instalado). */
export function readIndex(root: string): ScriptIndex | undefined {
  const file = path.join(root, INDEX_FILE);
  if (!existsSync(file)) return undefined;

  let parsed: Partial<ScriptIndex> | null;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<ScriptIndex> | null;
  } catch {
    throw new ScriptIndexError([
      `${INDEX_FILE} está ilegível (truncado ou corrompido); gere de novo com o build`,
    ]);
  }
  if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.scripts)) {
    throw new ScriptIndexError([
      `${INDEX_FILE} tem formato desconhecido; gere de novo com o build`,
    ]);
  }
  // Revalida os manifestos: um índice adulterado não pode injetar campos inesperados.
  return {
    schemaVersion: 1,
    scripts: parsed.scripts.map((script) => ({
      ...script,
      manifest: parseManifest(script.manifest, `${INDEX_FILE}:${script.dir}`),
    })),
  };
}

/**
 * Pasta `mycli-scripts/` ao lado de onde o código está rodando: `dist/index.js` (pacote instalado)
 * ou `src/...` (desenvolvimento). `undefined` se nenhuma tiver índice.
 */
export function findScriptsRoot(fromUrl: string = import.meta.url): string | undefined {
  let dir = path.dirname(fileURLToPath(fromUrl));
  for (let level = 0; level < 4; level++) {
    const candidate = path.join(dir, 'mycli-scripts');
    if (existsSync(path.join(candidate, INDEX_FILE))) return candidate;
    dir = path.dirname(dir);
  }
  return undefined;
}
