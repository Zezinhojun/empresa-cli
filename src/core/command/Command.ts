export interface CommandArg {
  description: string;
  name: string;
  required?: boolean;
}

export interface Command {
  /** Argumentos posicionais. Se omitido, a CLI não valida a quantidade. */
  args?: CommandArg[];
  description?: string;
  execute: (args?: string[]) => void | Promise<void>;
  name: string;
}
