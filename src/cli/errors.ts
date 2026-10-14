import chalk from 'chalk';

import { emitJson, SCHEMA_VERSION } from './output.js';
import { getRuntime } from './runtime.js';

/** Códigos de saída estáveis da CLI (documentados em docs/cli-contract.md). */
export const ExitCode = {
  error: 1,
  interrupted: 130,
  missingDependency: 3,
  needsConfirmation: 4,
  ok: 0,
  usage: 2,
} as const;

export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = ExitCode.error,
    public readonly code = 'ERROR',
    public readonly hint?: string | undefined,
    /** Dados extras para quem lê o JSON (ex.: código de saída do script). */
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

interface Friendly {
  code: string;
  hint: string;
  message: string;
}

/** Erros do sistema operacional (EACCES, ENOENT…) em frases que uma pessoa entende. */
function explainSystemError(error: unknown): Friendly | undefined {
  const { code, path } = error as NodeJS.ErrnoException;
  const where = path ? `: ${path}` : '';

  switch (code) {
    case 'EACCES':
    case 'EPERM':
      return {
        code: 'PERMISSION_DENIED',
        hint: 'Confira as permissões da pasta ou do arquivo, ou rode com um usuário que tenha acesso.',
        message: `Sem permissão para acessar o arquivo ou pasta${where}`,
      };
    case 'ENOENT':
      return {
        code: 'NOT_FOUND',
        hint: 'Confira se o caminho está certo.',
        message: `Arquivo ou pasta não encontrado${where}`,
      };
    case 'ENOSPC':
      return {
        code: 'DISK_FULL',
        hint: 'Libere espaço em disco e tente de novo.',
        message: 'Não há espaço livre no disco.',
      };
    default:
      return undefined;
  }
}

/**
 * Reporta o erro e devolve o código de saída. Com --json imprime SÓ o envelope de erro em
 * stdout (nada em stderr: ferramentas de agente costumam juntar os dois fluxos).
 */
export function reportError(error: unknown, verbose = false): number {
  // Ctrl+C dentro de um prompt do inquirer
  if (error instanceof Error && error.name === 'ExitPromptError') return ExitCode.interrupted;

  const friendly = error instanceof CliError ? undefined : explainSystemError(error);
  const exitCode = error instanceof CliError ? error.exitCode : ExitCode.error;
  const code = friendly?.code ?? (error instanceof CliError ? error.code : 'ERROR');
  const hint = friendly?.hint ?? (error instanceof CliError ? error.hint : undefined);
  const details = error instanceof CliError ? error.details : undefined;
  const message = friendly?.message ?? (error instanceof Error ? error.message : String(error));
  const stack = verbose && error instanceof Error ? error.stack : undefined;

  if (getRuntime().json) {
    emitJson({
      error: {
        code,
        message,
        ...(hint && { hint }),
        ...(details !== undefined && { details }),
        ...(stack && { stack }),
      },
      ok: false,
      schemaVersion: SCHEMA_VERSION,
    });
    return exitCode;
  }

  console.error(chalk.red(message));
  if (hint) console.error(hint);
  if (stack) console.error(stack);
  return exitCode;
}
