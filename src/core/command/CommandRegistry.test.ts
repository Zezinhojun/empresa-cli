import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Command } from './Command.js';

import { CommandRegistry } from './CommandRegistry.js';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    // Reset singleton para cada teste
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    registry = CommandRegistry.getInstance();
  });

  describe('getInstance', () => {
    it('retorna a mesma instância (singleton)', () => {
      const r1 = CommandRegistry.getInstance();
      const r2 = CommandRegistry.getInstance();
      expect(r1).toBe(r2);
    });
  });

  describe('register', () => {
    it('registra um comando válido', () => {
      const cmd: Command = {
        description: 'Test command',
        execute: vi.fn(),
        name: 'test-cmd',
      };
      registry.register(cmd);
      expect(registry.get('test-cmd')).toBe(cmd);
    });

    it('lança erro ao registrar comando duplicado', () => {
      const cmd: Command = {
        execute: vi.fn(),
        name: 'dup',
      };
      registry.register(cmd);
      expect(() => registry.register(cmd)).toThrow('Comando "dup" já está registrado');
    });
  });

  describe('get', () => {
    it('retorna comando existente', () => {
      const cmd: Command = { execute: vi.fn(), name: 'exists' };
      registry.register(cmd);
      expect(registry.get('exists')).toBe(cmd);
    });

    it('retorna undefined para comando inexistente', () => {
      expect(registry.get('not-exist')).toBeUndefined();
    });
  });

  describe('list', () => {
    it('retorna array vazio quando nenhum comando registrado', () => {
      expect(registry.list()).toEqual([]);
    });

    it('retorna todos os comandos registrados', () => {
      const cmd1: Command = { execute: vi.fn(), name: 'a' };
      const cmd2: Command = { execute: vi.fn(), name: 'b' };
      registry.register(cmd1);
      registry.register(cmd2);
      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list).toContain(cmd1);
      expect(list).toContain(cmd2);
    });
  });
});
