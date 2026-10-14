import chalk from 'chalk';

import '../commands/index.js';
import pkg from '../../package.json' with { type: 'json' };
import { CommandExecutor, CommandRegistry } from '../core/command/index.js';

const VERSION_FLAGS = ['--version', '-v'];
const HELP_FLAGS = ['--help', '-h', 'help'];

function printHelp(registry: CommandRegistry) {
  console.log(`${chalk.bold('vox')} ${pkg.version}\n`);
  console.log('Uso: vox [comando] [argumentos]\n');
  console.log('Comandos:');
  for (const { description = '', name } of registry.list()) {
    console.log(`  ${chalk.cyan(name.padEnd(14))}${description}`);
  }
  console.log('\nOpções:\n  -h, --help     Mostra esta ajuda\n  -v, --version  Mostra a versão');
}

export async function bootstrap(argv: string[] = process.argv.slice(2)) {
  const registry = CommandRegistry.getInstance();
  const executor = new CommandExecutor(registry);
  const [cmd, ...args] = argv;

  if (cmd && VERSION_FLAGS.includes(cmd)) {
    console.log(pkg.version);
    return;
  }

  if (cmd && HELP_FLAGS.includes(cmd)) {
    printHelp(registry);
    return;
  }

  if (!cmd) {
    console.log('VOX CLI inicializada');
    await executor.execute('menu');
    return;
  }

  if (!(await executor.execute(cmd, args))) {
    console.log("Use 'vox --help' para ver os comandos disponíveis.");
    process.exitCode = 1;
  }
}
