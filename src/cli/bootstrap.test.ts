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
    registry.register({ description: 'Faz algo', execute, name: 'foo' });
    registry.register({ execute: menu, name: 'menu' });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  it.each(['--version', '-v'])('%s imprime só a versão do pacote', async (flag) => {
    await bootstrap([flag]);

    expect(logSpy).toHaveBeenCalledExactlyOnceWith(pkg.version);
  });

  it.each(['--help', '-h', 'help'])('%s lista os comandos', async (flag) => {
    await bootstrap([flag]);

    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('foo');
    expect(output).toContain('Faz algo');
    expect(output).toContain('--version');
    expect(execute).not.toHaveBeenCalled();
  });

  it('sem argumentos abre o menu', async () => {
    await bootstrap([]);

    expect(menu).toHaveBeenCalledOnce();
    expect(process.exitCode).toBeUndefined();
  });

  it('executa o comando com os argumentos', async () => {
    await bootstrap(['foo', 'a', 'b']);

    expect(execute).toHaveBeenCalledWith(['a', 'b']);
    expect(process.exitCode).toBeUndefined();
  });

  it('comando inexistente sai com código 1', async () => {
    await bootstrap(['nope']);

    expect(process.exitCode).toBe(1);
  });
});
