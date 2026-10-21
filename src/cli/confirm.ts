import { confirm } from '@inquirer/prompts';

import { CliError, ExitCode } from './errors.js';
import { getRuntime } from './runtime.js';

/**
 * Pede confirmação ao usuário. Com `--yes` segue direto; sem terminal interativo NUNCA abre
 * prompt: falha com exit 4 dizendo o que fazer (é o que um agente precisa para decidir).
 */
export async function confirmAction(message: string): Promise<boolean> {
  const { interactive, yes } = getRuntime();

  if (yes) return true;

  if (!interactive) {
    throw new CliError(
      `Confirmação necessária: ${message}`,
      ExitCode.needsConfirmation,
      'CONFIRMATION_REQUIRED',
      'Rode o comando de novo com --yes para confirmar.',
    );
  }

  return confirm({ default: false, message });
}
