import { beforeEach, describe, expect, it } from 'vitest';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { ListCommand } from './ListCommand.js';

describe('ListCommand', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    registry = CommandRegistry.getInstance();
    registry.register({
      args: [{ description: 'Alvo', name: 'alvo', required: true }],
      description: 'Faz algo',
      execute: () => {},
      name: 'zeta',
      risk: 'write',
    });
    registry.register({ execute: () => {}, interactive: true, name: 'alfa' });
  });

  it('devolve o catálogo ordenado, com risco, args, usage e interatividade', () => {
    const { commands, version } = new ListCommand().execute();

    expect(version).toMatch(/^\d+\.\d+\.\d+/);
    expect(commands.map((c) => c.name)).toEqual(['alfa', 'zeta']);
    expect(commands[0]).toMatchObject({
      args: [],
      description: '',
      interactive: true,
      risk: 'read',
    });
    expect(commands[1]).toEqual({
      args: [{ description: 'Alvo', name: 'alvo', required: true }],
      description: 'Faz algo',
      interactive: false,
      kind: 'builtin',
      name: 'zeta',
      requires: [],
      risk: 'write',
      usage: 'mycli zeta <alvo>',
    });
  });

  it('format: uma linha por comando com nome, risco e descrição', () => {
    const cmd = new ListCommand();
    const out = cmd.format(cmd.execute());

    expect(out.split('\n')).toHaveLength(2);
    expect(out).toMatch(/zeta\s+write\s+Faz algo/);
  });
});
