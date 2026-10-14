import type { Command, Risk } from '../core/command/Command.js';
import type { CommandRegistry } from '../core/command/CommandRegistry.js';

import pkg from '../../package.json' with { type: 'json' };
import { usage } from './help.js';

export interface CommandInfo {
  args: { description: string; name: string; required: boolean }[];
  /** Grupo no menu; só os scripts declaram. */
  category?: string;
  description: string;
  interactive: boolean;
  /** `builtin` = comando da CLI; `script` = veio de `vox-scripts/`. */
  kind: 'builtin' | 'script';
  name: string;
  /** Executáveis extras que o comando exige no PATH. */
  requires: string[];
  risk: Risk;
  usage: string;
}

export interface Catalog {
  commands: CommandInfo[];
  version: string;
}

export function describeCommand(command: Command): CommandInfo {
  return {
    args: (command.args ?? []).map((a) => ({
      description: a.description,
      name: a.name,
      required: a.required ?? false,
    })),
    ...(command.category && { category: command.category }),
    description: command.description ?? '',
    interactive: command.interactive ?? false,
    kind: command.kind ?? 'builtin',
    name: command.name,
    requires: command.requires ?? [],
    risk: command.risk ?? 'read',
    usage: usage(command),
  };
}

/** Descrição de todos os comandos: é o que um agente lê para descobrir o que pode fazer. */
export function buildCatalog(registry: CommandRegistry): Catalog {
  return {
    commands: registry
      .list()
      .map((c) => describeCommand(c))
      .sort((a, b) => a.name.localeCompare(b.name)),
    version: pkg.version,
  };
}
