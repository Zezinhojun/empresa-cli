import { CommandRegistry, CommandExecutor } from '../core/command/index.js';

export function bootstrap() {
  const registry = new CommandRegistry();
  const executor = new CommandExecutor(registry);

  console.log('VOX CLI inicializada');

  const [, , cmd, ...args] = process.argv;

  if (!cmd) {
    console.log('Nenhum comando informado');
    return;
  }

  executor.execute(cmd, args);
}
