import type { CommandRegistry } from './CommandRegistry.js';

export class CommandExecutor {
  constructor(private readonly registry: CommandRegistry) {}

  async execute(name: string, args: string[] = []) {
    const command = this.registry.get(name);

    if (!command) {
      console.log(`Comando ${name} náo encontrado`);
      return;
    }

    await command.execute(args);
  }
}
