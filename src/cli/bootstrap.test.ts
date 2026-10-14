import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import pkg from '../../package.json' with { type: 'json' };
import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { bootstrap } from './bootstrap.js';

vi.mock('../commands/index.js', () => ({}));

describe('bootstrap', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  const execute = vi.fn();
  const menu = vi.fn();

  beforeEach(() => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    const registry = CommandRegistry.getInstance();
    registry.register({
      args: [{ description: 'Alvo', name: 'alvo', required: true }],
      description: 'Faz algo',
      execute,
      name: 'foo',
    });
    registry.register({ args: [], execute: menu, name: 'menu' });
    registry.register({ execute, name: 'livre' }); // sem args declarados: não valida
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it.each(['--version', '-v'])('%s imprime só a versão do pacote', async (flag) => {
    await bootstrap([flag]);

    expect(logSpy).toHaveBeenCalledExactlyOnceWith(pkg.version);
  });

  it.each([['--help'], ['-h'], ['help']])('%s lista os comandos', async (flag) => {
    await bootstrap([flag]);

    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('foo');
    expect(output).toContain('Faz algo');
    expect(output).toContain('--version');
    expect(execute).not.toHaveBeenCalled();
  });

  it('`<cmd> --help` e `help <cmd>` mostram a ajuda do comando sem executá-lo', async () => {
    await bootstrap(['foo', '--help']);
    await bootstrap(['help', 'foo']);

    expect(logSpy.mock.calls.flat().join('\n')).toContain('vox foo <alvo>');
    expect(execute).not.toHaveBeenCalled();
  });

  it('sem argumentos abre o menu', async () => {
    await bootstrap([]);

    expect(menu).toHaveBeenCalledOnce();
  });

  it('executa o comando com os argumentos e sem as flags globais', async () => {
    await bootstrap(['--json', 'foo', 'a']);

    expect(execute).toHaveBeenCalledWith(['a']);
  });

  it('comando sem args declarados aceita qualquer quantidade', async () => {
    await bootstrap(['livre', 'a', 'b', 'c']);

    expect(execute).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('comando inexistente: erro de uso (exit 2) com dica', async () => {
    await expect(bootstrap(['nope'])).rejects.toMatchObject({
      code: 'UNKNOWN_COMMAND',
      exitCode: 2,
      hint: expect.stringContaining('--help'),
    });
  });

  it('`help nope` também é comando inexistente', async () => {
    await expect(bootstrap(['help', 'nope'])).rejects.toMatchObject({ exitCode: 2 });
  });

  it('opção desconhecida: exit 2 e não executa nada', async () => {
    await expect(bootstrap(['foo', 'a', '--nada'])).rejects.toMatchObject({
      code: 'UNKNOWN_OPTION',
      exitCode: 2,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    [['foo']], // falta o obrigatório
    [['foo', 'a', 'b']], // argumento demais
    [['menu', 'x']], // não aceita nenhum
  ])('argumentos inválidos %j: exit 2 com o uso correto', async (argv) => {
    await expect(bootstrap(argv)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENTS',
      exitCode: 2,
      message: expect.stringContaining('Uso: vox'),
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('tudo depois de -- chega literal ao comando', async () => {
    await bootstrap(['livre', '--', '--json']);

    expect(execute).toHaveBeenCalledWith(['--json']);
  });
});
