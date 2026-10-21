import { describe, expect, it } from 'vitest';

import { parseArgv } from './parseArgv.js';

describe('parseArgv', () => {
  it('separa comando e argumentos', () => {
    expect(parseArgv(['list-files', 'services'])).toMatchObject({
      args: ['services'],
      command: 'list-files',
    });
  });

  it('sem nada: sem comando', () => {
    expect(parseArgv([])).toMatchObject({ args: [], command: undefined, unknown: [] });
  });

  it.each([
    ['--json', 'json'],
    ['--plain', 'plain'],
    ['--no-input', 'noInput'],
    ['--dry-run', 'dryRun'],
    ['--yes', 'yes'],
    ['-y', 'yes'],
    ['--verbose', 'verbose'],
    ['--version', 'version'],
    ['-v', 'version'],
    ['--help', 'help'],
    ['-h', 'help'],
  ] as const)('reconhece %s', (token, flag) => {
    expect(parseArgv([token]).flags[flag]).toBe(true);
  });

  it('aceita flags globais antes e depois do comando e não as passa como argumento', () => {
    const { args, command, flags } = parseArgv(['--json', 'list-files', 'a', '--no-input', 'b']);
    expect(command).toBe('list-files');
    expect(args).toEqual(['a', 'b']);
    expect(flags).toMatchObject({ json: true, noInput: true });
  });

  it('`mycli help cmd` equivale a `cmd --help`', () => {
    expect(parseArgv(['help', 'list-files'])).toMatchObject({
      command: 'list-files',
      flags: { help: true },
    });
    expect(parseArgv(['help']).command).toBeUndefined();
  });

  it('coleta opções desconhecidas', () => {
    expect(parseArgv(['list-files', '--foo', '-x']).unknown).toEqual(['--foo', '-x']);
  });

  it('tudo depois de -- é literal, inclusive o que parece flag', () => {
    const { args, command, flags, unknown } = parseArgv(['run', '--', '--json', '-v', 'x']);
    expect(command).toBe('run');
    expect(args).toEqual(['--json', '-v', 'x']);
    expect(flags.json).toBe(false);
    expect(unknown).toEqual([]);
  });

  it('um "-" sozinho é argumento comum (stdin)', () => {
    expect(parseArgv(['cat', '-']).args).toEqual(['-']);
  });
});

describe('parseArgv: --confirm=', () => {
  it('guarda o valor e não o trata como opção desconhecida', () => {
    const parsed = parseArgv(['limpar', '--confirm=meu-projeto', '--yes']);
    expect(parsed.flags).toMatchObject({ confirm: 'meu-projeto', yes: true });
    expect(parsed.unknown).toEqual([]);
    expect(parsed.args).toEqual([]);
  });
});
