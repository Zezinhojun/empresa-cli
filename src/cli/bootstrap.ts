import chalk from 'chalk';

import '../commands/index.js';
import pkg from '../../package.json' with { type: 'json' };
import { CommandExecutor, CommandRegistry, type Command } from '../core/command/index.js';
import { buildCatalog, describeCommand } from './catalog.js';
import { CliError, ExitCode } from './errors.js';
import { printCommandHelp, printHelp, usage } from './help.js';
import { emitData } from './output.js';
import { parseArgv } from './parseArgv.js';
import { resolveRuntime, setRuntime } from './runtime.js';

const HELP_HINT = "Use 'mycli --help' para ver os comandos disponíveis.";

function checkArgs(command: Command, args: string[]) {
  if (!command.args) return;
  const required = command.args.filter((a) => a.required).length;
  if (args.length < required || args.length > command.args.length) {
    throw new CliError(
      `Argumentos inválidos para '${command.name}'. Uso: ${usage(command)}`,
      ExitCode.usage,
      'INVALID_ARGUMENTS',
      `Veja 'mycli ${command.name} --help'.`,
    );
  }
}

export async function bootstrap(argv: string[] = process.argv.slice(2)) {
  const registry = CommandRegistry.getInstance();
  const executor = new CommandExecutor(registry);
  const { args, command: name, flags, unknown } = parseArgv(argv);
  const runtime = resolveRuntime(flags);
  setRuntime(runtime);
  if (runtime.plain) chalk.level = 0;

  /** Ajuda para pessoas, ou o catálogo/descrição do comando em JSON. */
  const showHelp = (command?: Command) => {
    if (runtime.json) emitData('help', command ? describeCommand(command) : buildCatalog(registry));
    else if (command) printCommandHelp(command);
    else printHelp(registry);
  };

  if (unknown.length > 0) {
    throw new CliError(
      `Opção desconhecida: ${unknown[0]}`,
      ExitCode.usage,
      'UNKNOWN_OPTION',
      HELP_HINT,
    );
  }

  if (flags.version) {
    if (runtime.json) emitData('version', { version: pkg.version });
    else console.log(pkg.version);
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
    showHelp(command);
    return;
  }

  if (!command) {
    // Sem terminal interativo (agente, CI, pipe) o menu nunca abre: mostra a ajuda.
    if (!runtime.interactive) {
      showHelp();
      return;
    }
    console.log(chalk.bold('MYCLI CLI inicializada'));
    await executor.execute('menu');
    return;
  }

  checkArgs(command, args);
  await executor.execute(command.name, args);
}
