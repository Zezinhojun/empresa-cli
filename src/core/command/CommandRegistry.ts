import type { Command } from './Command.js';

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  public register(command: Command) {
    this.commands.set(command.name, command);
  }

  public get(name: string) {
    return this.commands.get(name);
  }

  public list() {
    return Array.from(this.commands.values());
  }
}
