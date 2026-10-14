import * as inquirer from '@inquirer/prompts';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import type { Command } from '../core/command/Command.js';

import { resetRuntime, setRuntime } from '../cli/runtime.js';
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
    setRuntime({
      dryRun: false,
      interactive: true,
      json: false,
      plain: false,
      verbose: false,
      yes: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetRuntime();
    vi.restoreAllMocks();
  });

  it('tem nome e descrição corretos', () => {
    expect(menuCmd.name).toBe('menu');
    expect(menuCmd.description).toContain('menu interativo');
  });

  it('sem terminal interativo recusa (exit 2) em vez de abrir prompt', async () => {
    setRuntime({
      dryRun: false,
      interactive: false,
      json: false,
      plain: true,
      verbose: false,
      yes: false,
    });

    await expect(menuCmd.execute()).rejects.toMatchObject({
      code: 'INTERACTIVE_REQUIRED',
      exitCode: 2,
    });
    expect(inquirer.select).not.toHaveBeenCalled();
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

  describe('scripts com categoria e risco', () => {
    const choices = () => vi.mocked(inquirer.select).mock.calls[0]?.[0].choices ?? [];
    const names = () => choices().map((c) => (c as { name?: string }).name ?? '');
    const separators = () =>
      choices().filter((c) => (c as { separator?: string }).separator !== undefined);

    const script = (name: string, extra: Record<string, unknown> = {}) =>
      registry.register({ execute: vi.fn(), name, ...extra } as unknown as Command);

    it('agrupa por categoria com separador e ordena dentro de cada grupo', async () => {
      script('zeta', { category: 'setup' });
      script('alfa', { category: 'setup' });
      script('nativo'); // sem categoria -> "geral"
      vi.mocked(inquirer.select).mockResolvedValueOnce('__exit__');

      await menuCmd.execute();

      expect(separators()).toHaveLength(2);
      expect(selectedValues().filter(Boolean)).toEqual(['nativo', 'alfa', 'zeta', '__exit__']);
    });

    it('sem nenhuma categoria não há separadores (menu simples)', async () => {
      script('a');
      script('b');
      vi.mocked(inquirer.select).mockResolvedValueOnce('__exit__');

      await menuCmd.execute();

      expect(separators()).toHaveLength(0);
    });

    it('avisa em português simples o que o comando faz com o computador', async () => {
      script('leitura', { risk: 'read' });
      script('altera', { risk: 'write' });
      script('apaga', { risk: 'destructive' });
      vi.mocked(inquirer.select).mockResolvedValueOnce('__exit__');

      await menuCmd.execute();

      const byName = (n: string) => names().find((label) => label.includes(n)) ?? '';
      expect(byName('leitura')).not.toMatch(/\[/);
      expect(byName('altera')).toContain('[altera coisas]');
      expect(byName('apaga')).toContain('[pode apagar dados]');
    });
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
