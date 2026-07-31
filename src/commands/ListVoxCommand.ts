import chalk from 'chalk';

import type { Command } from '../core/command/Command.js';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { listDirectory } from '../core/utils/ListDirectory.js';
import { getVoxPath } from '../vox/directories/VoxHome.js';

export class ListVoxCommand implements Command {
  public readonly name = 'list-vox';
  public readonly description = 'Lista o conteúdo da pasta ~/vox';

  async execute(args: string[] = []) {
    const [subPath = ''] = args;
    const voxPath = getVoxPath(subPath);

    const items = await listDirectory(voxPath);
    if (!items) return;

    console.log(chalk.cyan(`Conteúdo de ${voxPath}:\n`));

    for (const item of items) {
      const icon = item.isDirectory() ? '📁' : '📄';
      console.log(`  ${icon} ${item.name}`);
    }
  }
}

CommandRegistry.getInstance().register(new ListVoxCommand());
