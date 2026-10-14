import type { CommandRegistry } from './CommandRegistry.js';

import { printResult } from '../../cli/output.js';

export class CommandExecutor {
  constructor(private readonly registry: CommandRegistry) {}

  /** Executa o comando; retorna `false` se ele não existir. */
  async execute(name: string, args: string[] = []): Promise<boolean> {
    const command = this.registry.get(name);

    if (!command) {
      console.log(`Comando ${name} não encontrado`);
      return false;
    }

    printResult(command, await command.execute(args));
    return true;
  }
}
