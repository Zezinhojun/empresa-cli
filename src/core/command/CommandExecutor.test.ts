import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Command } from './Command.js';

import { CommandExecutor } from './CommandExecutor.js';
import { CommandRegistry } from './CommandRegistry.js';

describe('CommandExecutor', () => {
  let registry: CommandRegistry;
  let executor: CommandExecutor;

  beforeEach(() => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    registry = CommandRegistry.getInstance();
    executor = new CommandExecutor(registry);
  });

  it('executa comando existente', async () => {
    const executeFn = vi.fn().mockResolvedValue(undefined);
    const cmd: Command = { execute: executeFn, name: 'test' };
    registry.register(cmd);

    await expect(executor.execute('test', ['arg1', 'arg2'])).resolves.toBe(true);

    expect(executeFn).toHaveBeenCalledWith(['arg1', 'arg2']);
  });

  it('executa comando sem argumentos', async () => {
    const executeFn = vi.fn().mockResolvedValue(undefined);
    const cmd: Command = { execute: executeFn, name: 'noargs' };
    registry.register(cmd);

    await executor.execute('noargs');

    expect(executeFn).toHaveBeenCalledWith([]);
  });

  it('não executa e loga erro para comando inexistente', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(executor.execute('inexistente')).resolves.toBe(false);

    expect(consoleSpy).toHaveBeenCalledWith('Comando inexistente não encontrado');
    consoleSpy.mockRestore();
  });

  it('propaga erro se comando.execute lançar', async () => {
    const error = new Error('Command failed');
    const executeFn = vi.fn().mockRejectedValue(error);
    const cmd: Command = { execute: executeFn, name: 'fails' };
    registry.register(cmd);

    await expect(executor.execute('fails')).rejects.toThrow('Command failed');
  });

  it('imprime os dados devolvidos pelo comando (formato humano)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    registry.register({ execute: () => 'resultado', name: 'dados' });

    await executor.execute('dados');

    expect(logSpy).toHaveBeenCalledWith('resultado');
    logSpy.mockRestore();
  });
});
