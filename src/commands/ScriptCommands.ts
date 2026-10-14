import path from 'node:path';

import type { CommandRegistry } from '../core/command/CommandRegistry.js';

import { CommandRegistry as Registry } from '../core/command/CommandRegistry.js';
import { findScriptsRoot, readIndex } from '../runner/scriptIndex.js';
import { ScriptCommand } from './ScriptCommand.js';

/**
 * Registra cada script de `vox-scripts/` (lido do índice gerado no build) como um comando.
 * Não varre pastas em tempo de execução. Sem índice = nenhum script instalado.
 *
 * @returns quantos scripts foram registrados
 */
export function registerScriptCommands(
  registry: CommandRegistry = Registry.getInstance(),
  root: string | null = findScriptsRoot() ?? null,
): number {
  const index = root ? readIndex(root) : undefined;
  if (!root || !index) return 0;

  for (const script of index.scripts) {
    registry.register(
      new ScriptCommand(script.manifest, path.join(root, script.dir), script.files),
    );
  }
  return index.scripts.length;
}

registerScriptCommands();
