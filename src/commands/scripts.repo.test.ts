import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { buildIndex } from '../runner/scriptIndex.js';
import './builtins.js';

/**
 * Valida o `vox-scripts/` REAL do repositório: manifesto inválido, pasta com nome diferente do
 * "name", entrada inexistente ou nome igual ao de um comando nativo quebram o CI aqui, antes do build.
 */
describe('vox-scripts/ do repositório', () => {
  it('todos os scripts são válidos e não colidem com os comandos nativos', () => {
    const builtins = CommandRegistry.getInstance()
      .list()
      .map((command) => command.name);

    expect(builtins.length).toBeGreaterThan(0);
    expect(() =>
      buildIndex(path.resolve(import.meta.dirname, '../../vox-scripts'), builtins),
    ).not.toThrow();
  });
});
