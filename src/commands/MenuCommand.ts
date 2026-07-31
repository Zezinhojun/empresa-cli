import { select } from '@inquirer/prompts';
import chalk from 'chalk';

import { CommandExecutor, CommandRegistry, type Command } from '../core/command/index.js';

export class MenuCommand implements Command {
  public readonly name = 'menu';
  public readonly description = 'Exibe um menu interativo com os comandos disponíveis';

  async execute() {
    const registry = CommandRegistry.getInstance();
    const commands = registry.list().filter((command) => command.name !== this.name);

    if (commands.length === 0) {
      console.log(chalk.yellow('Nenhum comando disponível'));
      return;
    }

    const choice = await select({
      choices: commands.map((command) => ({
        name: command.description
          ? `${chalk.bold(command.name)} ${chalk.gray('—')} ${chalk.dim(command.description)}`
          : chalk.bold(command.name),
        value: command.name,
      })),
      message: chalk.cyan('Selecione um comando:'),
    });

    await new CommandExecutor(registry).execute(choice);
  }
}

CommandRegistry.getInstance().register(new MenuCommand());
