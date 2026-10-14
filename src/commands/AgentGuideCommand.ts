import type { Command } from '../core/command/Command.js';

import guide from '../../docs/agent-guide.md';
import contract from '../../docs/cli-contract.md';
import { buildCatalog, type Catalog } from '../cli/catalog.js';
import { CommandRegistry } from '../core/command/CommandRegistry.js';

export interface AgentGuideData {
  catalog: Catalog;
  contract: string;
  guide: string;
}

export class AgentGuideCommand implements Command {
  public readonly args = [];
  public readonly name = 'agent-guide';
  public readonly description =
    'Guia de uso da CLI para agentes de IA (com --json: guia + catálogo)';

  execute(): AgentGuideData {
    return { catalog: buildCatalog(CommandRegistry.getInstance()), contract, guide };
  }

  format(data: AgentGuideData) {
    return `${data.guide}\n${data.contract}`;
  }
}

CommandRegistry.getInstance().register(new AgentGuideCommand());
