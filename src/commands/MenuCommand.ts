import { select } from '@inquirer/prompts';
import chalk from 'chalk';

import { CliError, ExitCode } from '../cli/errors.js';
import { getRuntime } from '../cli/runtime.js';
import { CommandExecutor, CommandRegistry, type Command } from '../core/command/index.js';

const EXIT = '__exit__';

export class MenuCommand implements Command {
  public readonly args = [];
  public readonly name = 'menu';
  public readonly description = 'Exibe um menu interativo com os comandos disponíveis';

  async execute() {
    if (!getRuntime().interactive) {
      throw new CliError(
        'O menu precisa de um terminal interativo.',
        ExitCode.usage,
        'INTERACTIVE_REQUIRED',
        "Use 'vox --help' para ver os comandos e rode o que precisar direto (ex.: vox list-vox).",
      );
    }

    const registry = CommandRegistry.getInstance();
    const executor = new CommandExecutor(registry);

    while (true) {
      const commands = registry.list().filter((command) => command.name !== this.name);

      if (commands.length === 0) {
        console.log(chalk.yellow('Nenhum comando disponível'));
        return;
      }

      const choice = await select({
        choices: [
          ...commands.map((command) => ({
            name: command.description
              ? `${chalk.bold(command.name)} ${chalk.gray('—')} ${chalk.dim(command.description)}`
              : chalk.bold(command.name),
            value: command.name,
          })),
          { name: chalk.red('Sair'), value: EXIT },
        ],
        message: chalk.cyan('Selecione um comando:'),
      });

      if (choice === EXIT) return;

      await executor.execute(choice);
      console.log();
    }
  }
}

CommandRegistry.getInstance().register(new MenuCommand());
