import type { Runtime } from '../../cli/runtime.js';

export interface CommandArg {
  description: string;
  name: string;
  required?: boolean;
}

/** Quanto o comando pode alterar na máquina. Agentes só rodam `destructive` com --yes. */
export type Risk = 'read' | 'write' | 'destructive';

export interface Command {
  /** Argumentos posicionais. Se omitido, a CLI não valida a quantidade. */
  args?: CommandArg[];
  description?: string;
  /**
   * Devolve os DADOS do resultado (objeto serializável); a CLI decide como imprimir:
   * texto via `format` para pessoas, JSON com --json. Retornar `undefined` = nada a mostrar.
   */
  execute(args?: string[]): unknown;
  /** Texto para pessoas a partir dos dados devolvidos por `execute`. */
  format?(data: unknown, runtime: Runtime): string;
  /** Agrupa o comando no menu (usado pelos scripts). */
  category?: string;
  /** Só funciona com terminal interativo (ex.: menu). */
  interactive?: boolean;
  /** De onde vem: comando da própria CLI (padrão) ou script de `vox-scripts/`. */
  kind?: 'builtin' | 'script';
  name: string;
  /** Executáveis extras que precisam estar no PATH (scripts). */
  requires?: string[];
  /** Padrão: `read`. */
  risk?: Risk;
}
