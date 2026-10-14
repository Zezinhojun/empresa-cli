import { describe, expect, it } from 'vitest';

import { parseArgv } from './parseArgv.js';

describe('parseArgv', () => {
  it('separa comando e argumentos', () => {
    expect(parseArgv(['list-vox', 'services'])).toMatchObject({
      args: ['services'],
      command: 'list-vox',
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
    const { args, command, flags } = parseArgv(['--json', 'list-vox', 'a', '--no-input', 'b']);
    expect(command).toBe('list-vox');
    expect(args).toEqual(['a', 'b']);
    expect(flags).toMatchObject({ json: true, noInput: true });
  });

  it('`vox help cmd` equivale a `cmd --help`', () => {
    expect(parseArgv(['help', 'list-vox'])).toMatchObject({
      command: 'list-vox',
      flags: { help: true },
    });
    expect(parseArgv(['help']).command).toBeUndefined();
  });

  it('coleta opções desconhecidas', () => {
    expect(parseArgv(['list-vox', '--foo', '-x']).unknown).toEqual(['--foo', '-x']);
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
