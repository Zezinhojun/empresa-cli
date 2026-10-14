import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { findInterpreter } from './interpreters.js';
import { runScript, type RunOptions } from './runScript.js';

// Aqui os scripts rodam de verdade: usa o execa real, não o mock global do setup.
vi.unmock('execa');

const hasBash = Boolean(await findInterpreter('bash'));
const hasPython = Boolean(await findInterpreter('python'));

let dir: string;
const script = (name: string, content: string) => {
  const file = path.join(dir, name);
  writeFileSync(file, content);
  return file;
};
const run = (entry: string, extra: Partial<RunOptions> = {}) =>
  runScript({
    args: [],
    capture: true,
    dryRun: false,
    entry,
    env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' },
    interactive: false,
    name: 'teste',
    timeoutSec: 20,
    ...extra,
  });

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'vox-runner-'));
  mkdirSync(path.join(dir, 'sub'));
});
afterAll(() => rmSync(dir, { force: true, recursive: true }));

/** Argumentos "perigosos": se algum shell os interpretasse, algo seria executado ou expandido. */
const HOSTIL = [
  '',
  'com espaço',
  "aspas'simples",
  'aspas"duplas',
  'a;echo hackeado',
  '$(echo hackeado)',
  '`echo hackeado`',
  'a && echo hackeado',
  'a | cat',
  '%PATH%',
  '*',
  '--flag-que-parece-opcao',
];

describe('runScript (.js)', () => {
  it('executa e captura stdout/stderr no modo --json', async () => {
    const entry = script('ok.js', "console.log('saida'); console.error('aviso');");

    const result = await run(entry);

    expect(result).toMatchObject({
      dryRun: false,
      exitCode: 0,
      runtime: 'node',
      stderr: 'aviso',
      stdout: 'saida',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('entrega argumentos hostis LITERAIS ao script (sem shell, sem injeção)', async () => {
    const entry = script('args.js', 'console.log(JSON.stringify(process.argv.slice(2)));');

    const result = await run(entry, { args: HOSTIL });

    expect(JSON.parse(result.stdout ?? '')).toEqual(HOSTIL);
    expect(result.stdout).not.toContain('hackeado\n');
  });

  it('preserva quebras de linha e argumentos vazios', async () => {
    const entry = script('quebras.js', 'console.log(JSON.stringify(process.argv.slice(2)));');
    const args = ['linha1\nlinha2', '', 'fim'];

    expect(JSON.parse((await run(entry, { args })).stdout ?? '')).toEqual(args);
  });

  it('NÃO repassa segredos do ambiente; repassa PATH e as variáveis do runner', async () => {
    process.env.VOX_TESTE_SEGREDO = 'nao-vazar';
    const entry = script('env.js', 'console.log(JSON.stringify(process.env));');

    const result = await run(entry, {
      env: {
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
        VOX_JSON: '1',
      },
    });
    delete process.env.VOX_TESTE_SEGREDO;

    const env = JSON.parse(result.stdout ?? '') as Record<string, string>;
    expect(env.VOX_TESTE_SEGREDO).toBeUndefined();
    expect(env.VOX_JSON).toBe('1');
    expect(Object.keys(env).map((k) => k.toUpperCase())).toContain('PATH');
  });

  it('usa o cwd informado', async () => {
    const entry = script('cwd.js', 'console.log(process.cwd());');

    const result = await run(entry, { cwd: path.join(dir, 'sub') });

    expect(path.resolve(result.stdout ?? '')).toBe(path.resolve(path.join(dir, 'sub')));
  });

  it('stdin não interativo: o script não fica esperando (recebe EOF)', async () => {
    const entry = script(
      'stdin.js',
      "let n = 0; process.stdin.on('data', (d) => (n += d.length)).on('end', () => console.log('eof ' + n));",
    );

    expect((await run(entry)).stdout).toBe('eof 0');
  });

  it('modo humano (capture: false): não captura, deixa a saída fluir ao terminal', async () => {
    const entry = script('humano.js', "console.log('direto');");

    const result = await run(entry, { capture: false });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBeUndefined();
  });

  it('--dry-run: devolve o comando exato e NÃO executa', async () => {
    const marca = path.join(dir, 'marca-dry.txt');
    const entry = script(
      'dry.js',
      `require('node:fs').writeFileSync(${JSON.stringify(marca)}, 'x');`,
    );

    const result = await run(entry, { args: ['um', 'dois'], dryRun: true });

    expect(result).toMatchObject({ dryRun: true, exitCode: null, runtime: 'node' });
    expect(result.command.slice(-3)).toEqual([entry, 'um', 'dois']);
    expect(existsSync(marca)).toBe(false);
  });

  describe('falhas', () => {
    it('código de saída ≠ 0 vira SCRIPT_FAILED (exit 1) com o código real e a saída', async () => {
      const entry = script(
        'falha.js',
        "console.log('antes'); console.error('motivo'); process.exit(3);",
      );

      await expect(run(entry)).rejects.toMatchObject({
        code: 'SCRIPT_FAILED',
        details: { exitCode: 3, stderr: 'motivo', stdout: 'antes' },
        exitCode: 1,
        message: expect.stringContaining('código 3'),
      });
    });

    it.skipIf(process.platform === 'win32')(
      'script morto por sinal: SCRIPT_FAILED sem código de saída',
      async () => {
        const entry = script('sinal.js', "process.kill(process.pid, 'SIGKILL');");

        await expect(run(entry)).rejects.toMatchObject({
          code: 'SCRIPT_FAILED',
          details: { exitCode: null },
          message: expect.stringContaining('desconhecido'),
        });
      },
    );

    it('estouro de tempo vira SCRIPT_TIMEOUT e o processo é encerrado', async () => {
      const entry = script('lento.js', 'setTimeout(() => {}, 30000);');

      await expect(run(entry, { timeoutSec: 1 })).rejects.toMatchObject({
        code: 'SCRIPT_TIMEOUT',
        details: { timeoutSec: 1 },
      });
    });

    it('saída acima do limite vira SCRIPT_OUTPUT_TOO_LARGE (não finge sucesso)', async () => {
      const entry = script('barulho.js', "process.stdout.write('x'.repeat(5000));");

      await expect(run(entry, { maxOutputBytes: 100 })).rejects.toMatchObject({
        code: 'SCRIPT_OUTPUT_TOO_LARGE',
      });
    });

    it('extensão desconhecida: UNSUPPORTED_SCRIPT_TYPE (exit 2) e nada é executado', async () => {
      await expect(run(script('x.rb', 'puts 1'))).rejects.toMatchObject({
        code: 'UNSUPPORTED_SCRIPT_TYPE',
        exitCode: 2,
      });
    });
  });
});

describe.skipIf(!hasBash)('runScript (.sh)', () => {
  it('executa com o bash certo e entrega os argumentos hostis literais', async () => {
    const entry = script('args.sh', 'for a in "$@"; do printf "%s\\n" "$a"; done\n');

    const result = await run(entry, { args: HOSTIL });

    expect(result).toMatchObject({ exitCode: 0, runtime: 'bash' });
    expect(result.stdout?.split(/\r?\n/)).toEqual(HOSTIL);
  });

  it('código de saída do script chega em SCRIPT_FAILED', async () => {
    const entry = script('falha.sh', 'echo erro >&2\nexit 7\n');

    await expect(run(entry)).rejects.toMatchObject({
      code: 'SCRIPT_FAILED',
      details: { exitCode: 7 },
    });
  });
});

describe.skipIf(!hasPython)('runScript (.py)', () => {
  it('executa com o Python 3 que funciona e entrega os argumentos hostis literais', async () => {
    const entry = script('args.py', 'import json, sys\nprint(json.dumps(sys.argv[1:]))\n');

    const result = await run(entry, { args: HOSTIL });

    expect(result).toMatchObject({ exitCode: 0, runtime: 'python' });
    expect(JSON.parse(result.stdout ?? '')).toEqual(HOSTIL);
  });

  it('código de saída do script chega em SCRIPT_FAILED', async () => {
    const entry = script('falha.py', 'import sys\nsys.exit(5)\n');

    await expect(run(entry)).rejects.toMatchObject({
      code: 'SCRIPT_FAILED',
      details: { exitCode: 5 },
    });
  });
});
