import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { findInterpreter } from './interpreters.js';
import { runScript } from './runScript.js';

// Executa de verdade (sem o mock global do execa): aqui o que importa é o efeito no disco.
vi.unmock('execa');

const hasBash = Boolean(await findInterpreter('bash'));
const hasPython = Boolean(await findInterpreter('python'));

let dir: string;
let marker: string;

/** Se QUALQUER shell interpretasse o argumento, este arquivo apareceria. */
const payloads = () => {
  const m = marker;
  return [
    `; touch "${m}"`,
    `$(touch "${m}")`,
    `\`touch "${m}"\``,
    `&& touch "${m}"`,
    `| touch "${m}"`,
    `> "${m}"`,
    `\ntouch "${m}"`,
    `& echo x > "${m}"`,
    `%COMSPEC% /c echo x > "${m}"`,
    `^& echo x > "${m}"`,
    `'; echo x > "${m}"; '`,
    `"; echo x > "${m}"; "`,
    `\\"; echo x > "${m}"; \\"`,
    'ação ünï çödé 日本語 🚀',
  ];
};

const run = (entry: string, args: string[]) =>
  runScript({
    args,
    capture: true,
    dryRun: false,
    entry,
    env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' },
    interactive: false,
    name: 'injecao',
    timeoutSec: 20,
  });

beforeAll(() => {
  // Pasta com espaço e acento, como o perfil de muita gente no Windows.
  dir = path.join(mkdtempSync(path.join(tmpdir(), 'mycli-inj-')), 'Pasta com espaço é acento');
  mkdirSync(dir);
  marker = path.join(dir, 'HACKEADO');
});
afterAll(() => rmSync(path.dirname(dir), { force: true, recursive: true }));

const script = (name: string, content: string) => {
  const file = path.join(dir, name);
  writeFileSync(file, content);
  return file;
};

describe('runScript: payloads de injeção não têm efeito no disco', () => {
  it('.js: argumentos chegam literais e nada é executado', async () => {
    const entry = script('args.mjs', 'console.log(JSON.stringify(process.argv.slice(2)));\n');
    const args = payloads();

    const result = await run(entry, args);

    expect(JSON.parse(result.stdout ?? '')).toEqual(args);
    expect(existsSync(marker)).toBe(false);
  });

  it.skipIf(!hasBash)('.sh: argumentos chegam literais e nada é executado', async () => {
    const entry = script('args.sh', 'for a in "$@"; do printf "%s\\0" "$a"; done\n');
    const args = payloads();

    const result = await run(entry, args);

    expect((result.stdout ?? '').split('\0').slice(0, -1)).toEqual(args);
    expect(existsSync(marker)).toBe(false);
  });

  it.skipIf(!hasPython)('.py: argumentos chegam literais e nada é executado', async () => {
    const entry = script(
      'args.py',
      'import json, sys\nsys.stdout.reconfigure(encoding="utf-8")\nprint(json.dumps(sys.argv[1:]))\n',
    );
    const args = payloads();

    const result = await run(entry, args);

    expect(JSON.parse(result.stdout ?? '')).toEqual(args);
    expect(existsSync(marker)).toBe(false);
  });

  it('o próprio caminho do script (com espaço e acento) não é reinterpretado', async () => {
    const entry = script('caminho.mjs', 'console.log("ok");\n');

    const result = await run(entry, []);

    expect(result).toMatchObject({ exitCode: 0 });
    expect(result.stdout?.trim()).toBe('ok');
  });
});
