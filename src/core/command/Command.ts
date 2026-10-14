export interface Command {
  name: string;
  description?: string;
  execute: (args?: string[]) => void | Promise<void>;
}
