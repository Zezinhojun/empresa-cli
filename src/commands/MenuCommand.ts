import { select, Separator } from '@inquirer/prompts';
import chalk from 'chalk';

import { CliError, ExitCode } from '../cli/errors.js';
import { getRuntime } from '../cli/runtime.js';
import { CommandExecutor, CommandRegistry, type Command } from '../core/command/index.js';

const EXIT = '__exit__';
const DEFAULT_CATEGORY = 'geral';

/** Aviso em linguagem simples para quem não é dev: o que o comando pode fazer com o computador. */
const RISK_TAG = {
  destructive: chalk.red(' [pode apagar dados]'),
  read: '',
  write: chalk.yellow(' [altera coisas]'),
} as const;

/** Opções do menu. Só agrupa por categoria quando algum comando declara uma (os scripts). */
function menuChoices(commands: Command[]) {
  const grouped = commands.some((command) => command.category);
  const sorted = grouped
    ? [...commands].sort(
        (a, b) =>
          (a.category ?? DEFAULT_CATEGORY).localeCompare(b.category ?? DEFAULT_CATEGORY) ||
          a.name.localeCompare(b.name),
      )
    : commands;

  const choices: (Separator | { name: string; value: string })[] = [];
  let current: string | undefined;

  for (const command of sorted) {
    const category = command.category ?? DEFAULT_CATEGORY;
    if (grouped && category !== current) {
      choices.push(new Separator(chalk.dim(`── ${category} ──`)));
      current = category;
    }
    choices.push({
      name:
        (command.description
          ? `${chalk.bold(command.name)} ${chalk.gray('—')} ${chalk.dim(command.description)}`
          : chalk.bold(command.name)) + RISK_TAG[command.risk ?? 'read'],
      value: command.name,
    });
  }
  return choices;
}

export class MenuCommand implements Command {
  public readonly args = [];
  public readonly interactive = true;
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
        choices: [...menuChoices(commands), { name: chalk.red('Sair'), value: EXIT }],
        message: chalk.cyan('Selecione um comando:'),
      });

      if (choice === EXIT) return;

      await executor.execute(choice);
      console.log();
    }
  }
}

CommandRegistry.getInstance().register(new MenuCommand());
