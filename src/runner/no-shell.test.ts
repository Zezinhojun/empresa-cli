import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guarda estática do runner: o código que executa scripts jamais pode passar por um shell nem
 * avaliar texto como código. Se alguém precisar de uma exceção, este teste precisa ser mudado de
 * propósito (e revisado), em vez de a regra ser violada em silêncio.
 */
const SRC = path.resolve(import.meta.dirname, '..');

const sources = [
  ...readdirSync(path.join(SRC, 'runner')).map((f) => path.join('runner', f)),
  ...readdirSync(path.join(SRC, 'commands'))
    .filter((f) => f.startsWith('Script'))
    .map((f) => path.join('commands', f)),
]
  .filter((file) => file.endsWith('.ts') && !file.includes('.test.'))
  .map((file) => ({ code: readFileSync(path.join(SRC, file), 'utf8'), file }));

/** Tira comentários para não acusar o que está só documentado. */
const withoutComments = (code: string) =>
  code.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/^\s*\/\/.*$/gm, '');

const FORBIDDEN: [string, RegExp][] = [
  ['shell: true', /shell\s*:\s*true/],
  ['eval()', /\beval\s*\(/],
  ['new Function()', /new\s+Function\s*\(/],
  ['vm.runIn*', /\bvm\.run\w*\(/],
  // exec( solto (de child_process); `regex.exec(` e `.exec(` de métodos não contam
  ['child_process exec/execSync', /(?<![.\w])(?:exec|execSync)\s*\(/],
  ['require("child_process")', /child_process/],
];

describe('runner: nada de shell nem avaliação dinâmica', () => {
  it('encontrou os arquivos do runner (a guarda não está olhando para o nada)', () => {
    const names = sources.map((s) => path.basename(s.file));

    expect(names).toEqual(
      expect.arrayContaining(['runScript.ts', 'interpreters.ts', 'env.ts', 'ScriptCommand.ts']),
    );
  });

  it.each(FORBIDDEN)('nenhum arquivo usa %s', (_nome, pattern) => {
    const offenders = sources
      .filter(({ code }) => pattern.test(withoutComments(code)))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it('a execução dos scripts usa execa com argumentos em array', () => {
    const run = sources.find(({ file }) => file.endsWith('runScript.ts'))?.code ?? '';

    expect(run).toMatch(/execa\(\s*interpreter\.command,\s*spawnArgs/);
  });
});
