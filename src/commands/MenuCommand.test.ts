import * as inquirer from '@inquirer/prompts';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import type { Command } from '../core/command/Command.js';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { MenuCommand } from './MenuCommand.js';

const selectedValues = (): unknown[] =>
  (vi.mocked(inquirer.select).mock.calls[0]?.[0].choices ?? []).map(
    (c) => (c as { value: unknown }).value,
  );

describe('MenuCommand', () => {
  let registry: CommandRegistry;
  let menuCmd: MenuCommand;

  beforeEach(() => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    registry = CommandRegistry.getInstance();
    menuCmd = new MenuCommand();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tem nome e descrição corretos', () => {
    expect(menuCmd.name).toBe('menu');
    expect(menuCmd.description).toContain('menu interativo');
  });

  it('exibe mensagem quando nenhum comando disponível', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await menuCmd.execute();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Nenhum comando disponível'));
    consoleSpy.mockRestore();
  });

  it('chama select com opções corretas quando há comandos', async () => {
    const cmd1 = { description: 'Desc 1', execute: vi.fn(), name: 'cmd1' };
    const cmd2 = { execute: vi.fn(), name: 'cmd2' };
    registry.register(cmd1 as unknown as Command);
    registry.register(cmd2 as unknown as Command);

    const selectMock = vi.mocked(inquirer.select);
    selectMock.mockResolvedValueOnce('__exit__');

    await menuCmd.execute();

    expect(selectMock).toHaveBeenCalledOnce();
    expect(selectMock.mock.calls[0]?.[0].message).toContain('Selecione um comando');
    expect(selectedValues()).toEqual(['cmd1', 'cmd2', '__exit__']); // cmd1, cmd2, Sair
  });

  it('sai do loop quando usuário escolhe Sair', async () => {
    const cmd1 = { execute: vi.fn(), name: 'cmd1' };
    registry.register(cmd1 as unknown as Command);

    vi.mocked(inquirer.select).mockResolvedValueOnce('__exit__');

    await menuCmd.execute();

    expect(cmd1.execute).not.toHaveBeenCalled();
  });

  it('executa comando selecionado e continua loop', async () => {
    const executeFn = vi.fn().mockResolvedValue(undefined);
    const cmd1 = { execute: executeFn, name: 'cmd1' };
    registry.register(cmd1 as unknown as Command);

    // Primeira escolha: cmd1, segunda: Sair
    vi.mocked(inquirer.select).mockResolvedValueOnce('cmd1').mockResolvedValueOnce('__exit__');

    await menuCmd.execute();

    expect(executeFn).toHaveBeenCalledOnce();
  });

  it('não inclui a si mesmo na lista de escolhas', async () => {
    const cmd1 = { execute: vi.fn(), name: 'other' };
    registry.register(cmd1 as unknown as Command);
    // menuCmd já se auto-registra no construtor

    vi.mocked(inquirer.select).mockResolvedValueOnce('__exit__');

    await menuCmd.execute();

    const names = selectedValues();
    expect(names).not.toContain('menu');
    expect(names).toContain('other');
  });
});
