import '../commands/index.js';
import { CommandRegistry, CommandExecutor } from '../core/command/index.js';

export async function bootstrap() {
  const registry = CommandRegistry.getInstance();
  const executor = new CommandExecutor(registry);

  console.log('VOX CLI inicializada');

  const [, , cmd, ...args] = process.argv;

  if (!cmd) {
    executor.execute('menu');
    return;
  }

  await executor.execute(cmd, args);

  const command = registry.get(cmd);

  if (command?.keepAlive) {
    await executor.execute('menu');
  }
}
