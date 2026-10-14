import type { Command } from '../core/command/Command.js';

import { buildCatalog, type Catalog } from '../cli/catalog.js';
import { CommandRegistry } from '../core/command/CommandRegistry.js';

export class ListCommand implements Command {
  public readonly args = [];
  public readonly name = 'list';
  public readonly description = 'Lista os comandos disponíveis (com --json: catálogo para agentes)';

  execute(): Catalog {
    return buildCatalog(CommandRegistry.getInstance());
  }

  format(data: Catalog) {
    const width = Math.max(...data.commands.map((c) => c.name.length)) + 2;
    return data.commands
      .map((c) => `${c.name.padEnd(width)}${c.risk.padEnd(12)}${c.description}`)
      .join('\n');
  }
}

CommandRegistry.getInstance().register(new ListCommand());
