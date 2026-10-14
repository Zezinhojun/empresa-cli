import { describe, expect, it } from 'vitest';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import './index.js';

describe('commands/index', () => {
  it('registra todos os comandos da CLI', () => {
    // Os scripts de vox-scripts/ também viram comandos; aqui só interessam os nativos.
    const names = CommandRegistry.getInstance()
      .list()
      .filter((command) => command.kind !== 'script')
      .map((command) => command.name)
      .sort();

    expect(names).toEqual(['agent-guide', 'doctor', 'list', 'list-vox', 'menu', 'top-memory']);
  });
});
