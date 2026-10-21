import chalk from 'chalk';
import path from 'node:path';

import type { Command } from '../core/command/Command.js';

import { CliError, ExitCode } from '../cli/errors.js';
import { type Runtime } from '../cli/runtime.js';
import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { readDirectory } from '../core/utils/ListDirectory.js';
import { getFilesPath } from '../workspace/files.js';

export interface ListFilesData {
  items: { name: string; type: 'dir' | 'file' }[];
  path: string;
}

export class ListFilesCommand implements Command {
  public readonly args = [{ description: 'Subpasta de ~/mycli/files', name: 'subpasta' }];
  public readonly name = 'list-files';
  public readonly description = 'Lista o conteúdo da pasta de exemplo ~/mycli/files';

  async execute(args: string[] = []): Promise<ListFilesData> {
    const [subPath = ''] = args;
    const base = getFilesPath();
    const target = getFilesPath(subPath);

    // Só lê dentro de ~/mycli/files: um agente (ou um engano) não pode listar o resto do disco.
    const relative = path.relative(base, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new CliError(
        `Caminho fora de ${base}: ${subPath}`,
        ExitCode.usage,
        'PATH_OUTSIDE_BASE',
        'Informe uma subpasta dentro de ~/mycli/files.',
      );
    }

    let entries;
    try {
      entries = await readDirectory(target);
    } catch (error) {
      const denied = (error as NodeJS.ErrnoException).code === 'EACCES';
      throw new CliError(
        denied ? `Sem permissão para ler ${target}` : `Pasta não encontrada em ${target}`,
        ExitCode.error,
        denied ? 'PERMISSION_DENIED' : 'NOT_FOUND',
      );
    }

    const items = entries
      .map((e) => ({ name: e.name, type: e.isDirectory() ? ('dir' as const) : ('file' as const) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { items, path: target };
  }

  format(data: ListFilesData, runtime: Runtime) {
    if (data.items.length === 0) return `Pasta ${data.path} está vazia`;

    const lines = data.items.map((item) => {
      if (runtime.plain) return item.type === 'dir' ? `${item.name}/` : item.name;
      return `  ${item.type === 'dir' ? '📁' : '📄'} ${item.name}`;
    });
    return [chalk.cyan(`Conteúdo de ${data.path}:\n`), ...lines].join('\n');
  }
}

CommandRegistry.getInstance().register(new ListFilesCommand());
