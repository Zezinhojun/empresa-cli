import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { which } from './which.js';

let dir: string;
const file = (name: string, mode = 0o755) => {
  const full = path.join(dir, name);
  writeFileSync(full, '');
  chmodSync(full, mode);
  return full;
};
/** No Windows o sistema de arquivos ignora maiúsculas (docker.EXE == docker.exe). */
const same = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'mycli-which-'));
});
afterEach(() => rmSync(dir, { force: true, recursive: true }));

// O PATH POSIX separa por ":", que num host Windows colide com "C:\": estes rodam em Linux/macOS.
describe.skipIf(process.platform === 'win32')('which (POSIX)', () => {
  it('acha o executável no PATH', () => {
    const exe = file('docker');

    expect(which('docker', { PATH: `/nao/existe:${dir}` }, 'linux')).toBe(exe);
  });

  it('o primeiro diretório do PATH vence', () => {
    const outro = mkdtempSync(path.join(tmpdir(), 'mycli-which2-'));
    writeFileSync(path.join(outro, 'git'), '');
    chmodSync(path.join(outro, 'git'), 0o755);
    const primeiro = file('git');

    expect(which('git', { PATH: `${dir}:${outro}` }, 'linux')).toBe(primeiro);
    rmSync(outro, { force: true, recursive: true });
  });

  it('arquivo sem permissão de execução não conta', () => {
    file('sem-permissao', 0o644);

    expect(which('sem-permissao', { PATH: dir }, 'linux')).toBeUndefined();
  });

  it('pasta com o mesmo nome não conta como executável', () => {
    mkdirSync(path.join(dir, 'docker'));

    expect(which('docker', { PATH: dir }, 'linux')).toBeUndefined();
  });

  it('inexistente, PATH vazio ou ausente: undefined', () => {
    expect(which('nada', { PATH: dir }, 'linux')).toBeUndefined();
    expect(which('nada', { PATH: '' }, 'linux')).toBeUndefined();
    expect(which('nada', {}, 'linux')).toBeUndefined();
  });
});

describe('which (Windows)', () => {
  it('usa PATHEXT: "docker" encontra docker.exe', () => {
    const exe = file('docker.exe');

    expect(same(which('docker', { PATH: dir, PATHEXT: '.com;.exe;.bat' }, 'win32'), exe)).toBe(
      true,
    );
  });

  it('o nome da variável pode ser "Path" e o separador é ";"', () => {
    const cmd = file('npm.cmd');

    expect(same(which('npm', { Path: `C:\\nada;${dir}` }, 'win32'), cmd)).toBe(true);
  });

  it('sem PATHEXT usa um padrão razoável', () => {
    const exe = file('git.exe');

    expect(same(which('git', { PATH: dir }, 'win32'), exe)).toBe(true);
  });

  it('nome já com extensão também vale', () => {
    const exe = file('tool.exe');

    expect(same(which('tool.exe', { PATH: dir }, 'win32'), exe)).toBe(true);
  });

  it('pasta com o mesmo nome não conta', () => {
    mkdirSync(path.join(dir, 'docker'));

    expect(which('docker', { PATH: dir }, 'win32')).toBeUndefined();
  });

  it('inexistente: undefined', () => {
    expect(which('nada', { PATH: dir }, 'win32')).toBeUndefined();
  });
});
