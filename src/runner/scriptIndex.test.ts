import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildIndex,
  findScriptsRoot,
  INDEX_FILE,
  readIndex,
  ScriptIndexError,
} from './scriptIndex.js';

let root: string;

/** Cria vox-scripts/<name>/ com manifesto e arquivos. */
const script = (
  name: string,
  manifest: Record<string, unknown> | string,
  files: Record<string, string> = { 'run.js': "console.log('oi');" },
) => {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'manifest.json'),
    typeof manifest === 'string' ? manifest : JSON.stringify(manifest),
  );
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
};
const ok = (name: string, extra: Record<string, unknown> = {}) => ({
  description: `Faz ${name}`,
  entry: 'run.js',
  name,
  risk: 'read',
  ...extra,
});
const problemsOf = (reserved: string[] = []): string[] => {
  try {
    buildIndex(root, reserved);
  } catch (error) {
    return (error as ScriptIndexError).problems;
  }
  return [];
};

beforeEach(() => {
  root = path.join(mkdtempSync(path.join(tmpdir(), 'vox-index-')), 'vox-scripts');
  mkdirSync(root, { recursive: true });
});
afterEach(() => rmSync(path.dirname(root), { force: true, recursive: true }));

describe('buildIndex', () => {
  it('sem scripts (pasta vazia ou inexistente): índice vazio', () => {
    expect(buildIndex(root)).toEqual({ schemaVersion: 1, scripts: [] });
    expect(buildIndex(path.join(root, 'nao-existe'))).toEqual({ schemaVersion: 1, scripts: [] });
  });

  it('indexa o manifesto normalizado e o SHA-256 de cada arquivo, inclusive em subpastas', () => {
    script('alfa', ok('alfa'), { 'lib/util.js': 'x', 'run.js': 'abc' });

    const [alfa] = buildIndex(root).scripts;

    expect(alfa?.dir).toBe('alfa');
    expect(alfa?.manifest).toMatchObject({ name: 'alfa', os: [], requires: [], timeoutSec: 300 });
    expect(Object.keys(alfa?.files ?? {})).toEqual(['lib/util.js', 'manifest.json', 'run.js']);
    // sha256("abc")
    expect(alfa?.files['run.js']).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('é determinístico e ordenado por nome (mesmo conteúdo → mesmo índice)', () => {
    script('zeta', ok('zeta'));
    script('alfa', ok('alfa'));

    const first = JSON.stringify(buildIndex(root));
    const second = JSON.stringify(buildIndex(root));

    expect(second).toBe(first);
    expect(buildIndex(root).scripts.map((s) => s.dir)).toEqual(['alfa', 'zeta']);
  });

  it('mudar 1 byte do script muda o hash dele (e só dele)', () => {
    script('alfa', ok('alfa'), { 'run.js': 'a' });
    script('beta', ok('beta'), { 'run.js': 'b' });
    const before = buildIndex(root);

    writeFileSync(path.join(root, 'alfa', 'run.js'), 'a!');
    const after = buildIndex(root);

    expect(after.scripts[0]?.files['run.js']).not.toBe(before.scripts[0]?.files['run.js']);
    expect(after.scripts[1]?.files).toEqual(before.scripts[1]?.files);
  });

  it('ignora arquivos soltos e pastas ocultas na raiz (README, .gitkeep)', () => {
    writeFileSync(path.join(root, 'README.md'), '# oi');
    mkdirSync(path.join(root, '.cache'));
    script('alfa', ok('alfa'));

    expect(buildIndex(root).scripts.map((s) => s.dir)).toEqual(['alfa']);
  });

  describe('problemas (todos reportados de uma vez, com a pasta de origem)', () => {
    it('sem manifest.json', () => {
      mkdirSync(path.join(root, 'sem-manifesto'));

      expect(problemsOf()).toEqual(['vox-scripts/sem-manifesto: falta o manifest.json']);
    });

    it('JSON quebrado', () => {
      script('quebrado', '{ nao é json');

      expect(problemsOf()[0]).toContain('vox-scripts/quebrado: manifest.json não é um JSON válido');
    });

    it('manifesto inválido: cada problema aparece prefixado pela pasta', () => {
      script('ruim', { entry: 'run.js', name: 'ruim', riks: 1 });

      const problems = problemsOf();

      expect(problems.some((p) => p.startsWith('vox-scripts/ruim: ') && p.includes('"riks"'))).toBe(
        true,
      );
      expect(problems.some((p) => p.includes('"description"'))).toBe(true);
      expect(problems.some((p) => p.includes('"risk"'))).toBe(true);
    });

    it('pasta com nome diferente do "name"', () => {
      script('pasta-errada', ok('outro-nome'));

      expect(problemsOf()).toEqual([
        'vox-scripts/pasta-errada: a pasta deve se chamar "outro-nome" (igual ao "name")',
      ]);
    });

    it('nome que colide com comando nativo', () => {
      script('list', ok('list'));

      expect(problemsOf(['list', 'menu'])).toEqual([
        'vox-scripts/list: o nome "list" já é usado por outro comando',
      ]);
    });

    it('arquivo de entrada inexistente', () => {
      script('sem-entrada', ok('sem-entrada', { entry: 'nao-existe.js' }));

      expect(problemsOf()).toEqual([
        'vox-scripts/sem-entrada: o arquivo de entrada "nao-existe.js" não existe',
      ]);
    });

    it('entrada em subpasta existe e é aceita', () => {
      script('sub', ok('sub', { entry: 'bin/main.js' }), { 'bin/main.js': 'x' });

      expect(problemsOf()).toEqual([]);
    });

    it('junta problemas de vários scripts numa única exceção', () => {
      mkdirSync(path.join(root, 'a'));
      script('b', ok('b', { entry: 'x.js' }));

      expect(problemsOf()).toHaveLength(2);
      expect(() => buildIndex(root)).toThrow(ScriptIndexError);
      expect(() => buildIndex(root)).toThrow(/Scripts inválidos/);
    });
  });
});

describe('readIndex', () => {
  const write = (content: unknown) =>
    writeFileSync(
      path.join(root, INDEX_FILE),
      typeof content === 'string' ? content : JSON.stringify(content),
    );

  it('sem índice: undefined (nenhum script instalado)', () => {
    expect(readIndex(root)).toBeUndefined();
  });

  it('lê o índice gerado no build', () => {
    script('alfa', ok('alfa'));
    const built = buildIndex(root);
    write(built);

    expect(readIndex(root)).toEqual(built);
  });

  it('formato desconhecido: erro claro', () => {
    write({ schemaVersion: 2, scripts: [] });

    expect(() => readIndex(root)).toThrow(/formato desconhecido/);
  });

  it('revalida os manifestos: índice adulterado com campo extra é rejeitado', () => {
    script('alfa', ok('alfa'));
    const built = buildIndex(root);
    (built.scripts[0]?.manifest as unknown as Record<string, unknown>).rodar = 'rm -rf /';
    write(built);

    expect(() => readIndex(root)).toThrow(/campo desconhecido "rodar"/);
  });
});

describe('findScriptsRoot', () => {
  it('acha vox-scripts/ (com índice) subindo a partir do arquivo que está rodando', () => {
    writeFileSync(path.join(root, INDEX_FILE), JSON.stringify({ schemaVersion: 1, scripts: [] }));
    const deep = path.join(path.dirname(root), 'dist');
    mkdirSync(deep);

    expect(findScriptsRoot(pathToFileURL(path.join(deep, 'index.js')).href)).toBe(root);
  });

  it('sem índice em lugar nenhum: undefined', () => {
    expect(
      findScriptsRoot(pathToFileURL(path.join(path.dirname(root), 'x.js')).href),
    ).toBeUndefined();
  });
});
