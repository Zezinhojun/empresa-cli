import type { Command } from './Command.js';

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();
  private static instance: CommandRegistry;

  public static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }

    return CommandRegistry.instance;
  }

  public register(command: Command) {
    if (this.commands.has(command.name)) {
      throw new Error(`Comando "${command.name}" já está registrado`);
    }
    this.commands.set(command.name, command);
  }

  public get(name: string) {
    return this.commands.get(name);
  }

  public list() {
    return Array.from(this.commands.values());
  }
}
