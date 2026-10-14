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
  ) {
    super(message);
    this.name = 'CliError';
  }
}

/**
 * Reporta o erro e devolve o código de saída. Com --json imprime SÓ o envelope de erro em
 * stdout (nada em stderr: ferramentas de agente costumam juntar os dois fluxos).
 */
export function reportError(error: unknown, verbose = false): number {
  // Ctrl+C dentro de um prompt do inquirer
  if (error instanceof Error && error.name === 'ExitPromptError') return ExitCode.interrupted;

  const exitCode = error instanceof CliError ? error.exitCode : ExitCode.error;
  const code = error instanceof CliError ? error.code : 'ERROR';
  const hint = error instanceof CliError ? error.hint : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const stack = verbose && error instanceof Error ? error.stack : undefined;

  if (getRuntime().json) {
    emitJson({
      error: { code, message, ...(hint && { hint }), ...(stack && { stack }) },
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
