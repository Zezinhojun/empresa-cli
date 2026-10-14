export interface Command {
  name: string;
  description?: string;
  keepAlive?: boolean;
  execute: (args?: string[]) => void | Promise<void>;
}
