import chalk from 'chalk';

import '../commands/index.js';
import pkg from '../../package.json' with { type: 'json' };
import { CommandExecutor, CommandRegistry, type Command } from '../core/command/index.js';
import { CliError, ExitCode } from './errors.js';
import { printCommandHelp, printHelp, usage } from './help.js';
import { parseArgv } from './parseArgv.js';

const HELP_HINT = "Use 'vox --help' para ver os comandos disponíveis.";

function checkArgs(command: Command, args: string[]) {
  if (!command.args) return;
  const required = command.args.filter((a) => a.required).length;
  if (args.length < required || args.length > command.args.length) {
    throw new CliError(
      `Argumentos inválidos para '${command.name}'. Uso: ${usage(command)}`,
      ExitCode.usage,
      'INVALID_ARGUMENTS',
      `Veja 'vox ${command.name} --help'.`,
    );
  }
}

export async function bootstrap(argv: string[] = process.argv.slice(2)) {
  const registry = CommandRegistry.getInstance();
  const executor = new CommandExecutor(registry);
  const { args, command: name, flags, unknown } = parseArgv(argv);

  if (unknown.length > 0) {
    throw new CliError(
      `Opção desconhecida: ${unknown[0]}`,
      ExitCode.usage,
      'UNKNOWN_OPTION',
      HELP_HINT,
    );
  }

  if (flags.version) {
    console.log(pkg.version);
    return;
  }

  const command = name ? registry.get(name) : undefined;
  if (name && !command) {
    throw new CliError(
      `Comando ${name} não encontrado`,
      ExitCode.usage,
      'UNKNOWN_COMMAND',
      HELP_HINT,
    );
  }

  if (flags.help) {
    if (command) printCommandHelp(command);
    else printHelp(registry);
    return;
  }

  if (!command) {
    console.log(chalk.bold('VOX CLI inicializada'));
    await executor.execute('menu');
    return;
  }

  checkArgs(command, args);
  await executor.execute(command.name, args);
}
