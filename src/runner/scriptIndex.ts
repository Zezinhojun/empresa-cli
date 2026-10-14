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

/** Arquivos da pasta (recursivo), como caminhos relativos com "/", em ordem estável. */
function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listFiles(path.join(dir, entry.name), relative) : [relative];
    })
    .sort();
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

    const files = listFiles(scriptDir);
    if (!files.includes(manifest.entry.replaceAll('\\', '/'))) {
      problems.push(`${label}: o arquivo de entrada "${manifest.entry}" não existe`);
    }

    scripts.push({
      dir,
      files: Object.fromEntries(files.map((file) => [file, sha256(path.join(scriptDir, file))])),
      manifest,
    });
  }

  if (problems.length > 0) throw new ScriptIndexError(problems);
  return { schemaVersion: 1, scripts };
}

/** Lê o índice gerado no build. `undefined` se não existir (nenhum script instalado). */
export function readIndex(root: string): ScriptIndex | undefined {
  const file = path.join(root, INDEX_FILE);
  if (!existsSync(file)) return undefined;

  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<ScriptIndex>;
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.scripts)) {
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
 * Pasta `vox-scripts/` ao lado de onde o código está rodando: `dist/index.js` (pacote instalado)
 * ou `src/...` (desenvolvimento). `undefined` se nenhuma tiver índice.
 */
export function findScriptsRoot(fromUrl: string = import.meta.url): string | undefined {
  let dir = path.dirname(fileURLToPath(fromUrl));
  for (let level = 0; level < 4; level++) {
    const candidate = path.join(dir, 'vox-scripts');
    if (existsSync(path.join(candidate, INDEX_FILE))) return candidate;
    dir = path.dirname(dir);
  }
  return undefined;
}
