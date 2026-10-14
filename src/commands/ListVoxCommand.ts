import chalk from 'chalk';
import path from 'node:path';

import type { Command } from '../core/command/Command.js';

import { CliError, ExitCode } from '../cli/errors.js';
import { type Runtime } from '../cli/runtime.js';
import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { readDirectory } from '../core/utils/ListDirectory.js';
import { getVoxArquiteturaPath } from '../vox/directories/VoxArquitetura.js';

export interface ListVoxData {
  items: { name: string; type: 'dir' | 'file' }[];
  path: string;
}

export class ListVoxCommand implements Command {
  public readonly args = [{ description: 'Subpasta de ~/vox/arquitetura', name: 'subpasta' }];
  public readonly name = 'list-vox';
  public readonly description = 'Lista o conteúdo da pasta ~/vox';

  async execute(args: string[] = []): Promise<ListVoxData> {
    const [subPath = ''] = args;
    const base = getVoxArquiteturaPath();
    const voxPath = getVoxArquiteturaPath(subPath);

    // Só lê dentro de ~/vox/arquitetura: um agente (ou um engano) não pode listar o resto do disco.
    const relative = path.relative(base, voxPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new CliError(
        `Caminho fora de ${base}: ${subPath}`,
        ExitCode.usage,
        'PATH_OUTSIDE_BASE',
        'Informe uma subpasta dentro de ~/vox/arquitetura.',
      );
    }

    let entries;
    try {
      entries = await readDirectory(voxPath);
    } catch (error) {
      const denied = (error as NodeJS.ErrnoException).code === 'EACCES';
      throw new CliError(
        denied ? `Sem permissão para ler ${voxPath}` : `Pasta não encontrada em ${voxPath}`,
        ExitCode.error,
        denied ? 'PERMISSION_DENIED' : 'NOT_FOUND',
      );
    }

    const items = entries
      .map((e) => ({ name: e.name, type: e.isDirectory() ? ('dir' as const) : ('file' as const) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { items, path: voxPath };
  }

  format(data: ListVoxData, runtime: Runtime) {
    if (data.items.length === 0) return `Pasta ${data.path} está vazia`;

    const lines = data.items.map((item) => {
      if (runtime.plain) return item.type === 'dir' ? `${item.name}/` : item.name;
      return `  ${item.type === 'dir' ? '📁' : '📄'} ${item.name}`;
    });
    return [chalk.cyan(`Conteúdo de ${data.path}:\n`), ...lines].join('\n');
  }
}

CommandRegistry.getInstance().register(new ListVoxCommand());
