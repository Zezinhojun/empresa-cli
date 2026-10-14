import { beforeEach, describe, expect, it } from 'vitest';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { AgentGuideCommand } from './AgentGuideCommand.js';

describe('AgentGuideCommand', () => {
  let cmd: AgentGuideCommand;

  beforeEach(() => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    const registry = CommandRegistry.getInstance();
    registry.register({ description: 'Faz algo', execute: () => {}, name: 'foo' });
    cmd = new AgentGuideCommand();
  });

  it('tem nome, descrição e não recebe argumentos', () => {
    expect(cmd.name).toBe('agent-guide');
    expect(cmd.description).toContain('agentes');
    expect(cmd.args).toEqual([]);
  });

  it('devolve o guia, o contrato e o catálogo atual', () => {
    const data = cmd.execute();

    expect(data.guide).toContain('Guia rápido para agentes de IA');
    expect(data.contract).toContain('Códigos de saída');
    expect(data.catalog.commands.map((c) => c.name)).toEqual(['foo']);
  });

  it('o guia ensina o fluxo essencial', () => {
    const { guide } = cmd.execute();

    for (const trecho of ['vox list --json', '--json', 'risk', '--yes', 'interactive', '--']) {
      expect(guide).toContain(trecho);
    }
  });

  it('o contrato documenta todos os códigos de saída da CLI', () => {
    const { contract } = cmd.execute();

    for (const code of ['`0`', '`1`', '`2`', '`3`', '`4`', '`130`']) {
      expect(contract).toContain(code);
    }
  });

  it('format: guia seguido do contrato', () => {
    const out = cmd.format(cmd.execute());

    expect(out.indexOf('Guia rápido')).toBeLessThan(out.indexOf('Contrato de uso da CLI'));
  });
});
