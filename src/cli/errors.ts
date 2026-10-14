import chalk from 'chalk';

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

/** Imprime o erro em stderr e devolve o código de saída correspondente. */
export function reportError(error: unknown, verbose = false): number {
  // Ctrl+C dentro de um prompt do inquirer
  if (error instanceof Error && error.name === 'ExitPromptError') return ExitCode.interrupted;

  if (error instanceof CliError) {
    console.error(chalk.red(error.message));
    if (error.hint) console.error(error.hint);
    return error.exitCode;
  }

  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  if (verbose && error instanceof Error && error.stack) console.error(error.stack);
  return ExitCode.error;
}
