import { describe, expect, it } from 'vitest';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import './index.js';

describe('commands/index', () => {
  it('registra todos os comandos da CLI', () => {
    const names = CommandRegistry.getInstance()
      .list()
      .map((command) => command.name)
      .sort();

    expect(names).toEqual(['agent-guide', 'doctor', 'list', 'list-vox', 'menu', 'top-memory']);
  });
});
