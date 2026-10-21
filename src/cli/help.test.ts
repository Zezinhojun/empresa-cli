import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Command } from '../core/command/Command.js';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { printCommandHelp, printHelp, usage } from './help.js';

const cmd: Command = {
  args: [
    { description: 'Quem', name: 'alvo', required: true },
    { description: 'Quanto', name: 'extra' },
  ],
  description: 'Faz algo',
  execute: () => {},
  name: 'fazer',
};

describe('help', () => {
  let out: () => string;

  beforeEach(() => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    out = () => spy.mock.calls.flat().join('\n');
  });

  afterEach(() => vi.restoreAllMocks());

  it('usage marca obrigatórios com <> e opcionais com []', () => {
    expect(usage(cmd)).toBe('mycli fazer <alvo> [extra]');
    expect(usage({ execute: () => {}, name: 'x' })).toBe('mycli x');
  });

  it('ajuda geral lista comandos, opções globais e códigos de saída', () => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    const registry = CommandRegistry.getInstance();
    registry.register(cmd);

    printHelp(registry);

    expect(out()).toContain('fazer');
    expect(out()).toContain('Faz algo');
    expect(out()).toContain('--json');
    expect(out()).toContain('130');
  });

  it('ajuda do comando mostra uso, argumentos e (opcional)', () => {
    printCommandHelp(cmd);

    expect(out()).toContain('mycli fazer <alvo> [extra]');
    expect(out()).toContain('Quem');
    expect(out()).toContain('Quanto (opcional)');
    expect(out()).toContain('Códigos de saída');
  });

  it('comando sem args/descrição não quebra', () => {
    printCommandHelp({ execute: () => {}, name: 'simples' });
    expect(out()).toContain('mycli simples');
  });
});
