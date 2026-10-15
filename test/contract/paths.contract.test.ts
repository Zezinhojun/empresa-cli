import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Ambientes "feios" de usuários reais: perfil com espaço e acento (`C:\Users\João da Silva`),
 * `HOME` ausente e shells diferentes. A CLI não pode quebrar nem estragar nomes.
 */
const DIST = resolve(import.meta.dirname, '../../dist/index.js');
const isWindows = process.platform === 'win32';

let root: string;
let home: string;

/** Só o necessário para o Node achar a si mesmo; HOME/USERPROFILE ficam por conta de cada teste. */
const minimalEnv = (extra: Record<string, string> = {}) => {
  const env: Record<string, string> = { PATH: process.env.PATH ?? '', ...extra };
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  return env;
};

const vox = (args: string[], env: Record<string, string>) =>
  spawnSync(process.execPath, [DIST, ...args], {
    encoding: 'utf8',
    env,
    input: '',
    timeout: 20_000,
  });

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'vox-paths-'));
  home = join(root, 'João da Silva é Ünï');
  mkdirSync(join(home, 'vox', 'arquitetura', 'serviços'), { recursive: true });
  writeFileSync(join(home, 'vox', 'arquitetura', 'léia-me.txt'), 'oi');
});
afterAll(() => rmSync(root, { force: true, recursive: true }));

describe('perfil com espaço e acento', () => {
  const env = () => minimalEnv({ HOME: home, USERPROFILE: home });

  it('--json devolve os nomes com acento intactos', () => {
    const r = vox(['list-vox', '--json'], env());

    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
    const { data } = JSON.parse(r.stdout) as { data: { items: { name: string; type: string }[] } };
    expect(data.items).toEqual([
      { name: 'léia-me.txt', type: 'file' },
      { name: 'serviços', type: 'dir' },
    ]);
  });

  it('texto simples também preserva os nomes (sem ? nem mojibake)', () => {
    const r = vox(['list-vox', '--plain'], env());

    expect(r.status).toBe(0);
    expect(r.stdout).toContain('léia-me.txt');
    expect(r.stdout).toContain('serviços/');
  });

  it('subpasta com acento', () => {
    const r = vox(['list-vox', 'serviços', '--json'], env());

    expect(r.status).toBe(0);
  });
});

describe('HOME ausente', () => {
  it('não quebra: devolve JSON válido (sucesso ou erro claro), nunca stack trace', () => {
    const r = vox(['list-vox', '--json'], minimalEnv());

    expect([0, 1, 2]).toContain(r.status);
    expect(r.stderr).toBe('');
    expect(JSON.parse(r.stdout)).toMatchObject({ schemaVersion: 1 });
  });

  it('`vox doctor` e `vox --version` funcionam sem HOME', () => {
    expect(vox(['--version'], minimalEnv()).status).toBe(0);
    expect(vox(['doctor', '--json'], minimalEnv()).status).toBe(0);
  });
});

describe.skipIf(!isWindows)('Windows: shells diferentes', () => {
  const env = () => ({ ...process.env, HOME: home, USERPROFILE: home }) as Record<string, string>;

  it('PowerShell: caminho do binário e do perfil com espaço', () => {
    const r = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `& '${process.execPath}' '${DIST}' list-vox --json`,
      ],
      { encoding: 'utf8', env: env(), timeout: 30_000 },
    );

    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ ok: true });
  });

  it('cmd.exe: caminho do binário e do perfil com espaço', () => {
    const r = spawnSync(
      'cmd.exe',
      ['/d', '/s', '/c', `""${process.execPath}" "${DIST}" list-vox --json"`],
      {
        encoding: 'utf8',
        env: env(),
        timeout: 30_000,
        windowsVerbatimArguments: true,
      },
    );

    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ ok: true });
  });
});
