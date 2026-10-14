import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { execa } from 'execa';

import type { Command } from '../core/command/Command.js';

import { CommandRegistry } from '../core/command/CommandRegistry.js';

export class CleanMemoryCommand implements Command {
  public readonly name = 'clean-memory';
  public readonly description = 'Mostra os processos que mais consomem memória';

  async execute() {
    console.log(chalk.cyan('Top 10 processos por uso de memória:\n'));

    try {
      const stdout = await this.getTopProcesses();
      console.log(stdout);
    } catch (error) {
      console.log(chalk.red('Erro ao listar processos:'), error);
    }

    const shouldClean = await confirm({
      default: false,
      message: 'Deseja realizar a limpeza de memória?',
    });

    if (!shouldClean) {
      console.log(chalk.yellow('Operação cancelada'));
      return;
    }

    console.log(chalk.green('Prosseguindo com a limpeza...'));
  }

  private async getTopProcesses(): Promise<string> {
    if (process.platform === 'win32') {
      const { stdout } = await execa('powershell', [
        '-Command',
        'Get-Process | Sort-Object WS -Descending | Select-Object -First 10 Name, Id, WS',
      ]);
      return stdout;
    }

    const { stdout } = await execa('sh', ['-c', 'ps aux --sort=-%mem | head -n 10']);
    return stdout;
  }
}

CommandRegistry.getInstance().register(new CleanMemoryCommand());
