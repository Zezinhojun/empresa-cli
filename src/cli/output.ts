import type { Command } from '../core/command/Command.js';

import { getRuntime } from './runtime.js';

/** Versão do formato do JSON. Só muda em quebra de compatibilidade. */
export const SCHEMA_VERSION = 1;

/** Uma linha de JSON em stdout. Nunca escreve mais nada em stdout no modo --json. */
export function emitJson(payload: object) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

/** Envelope de sucesso: `{ schemaVersion, ok: true, command, data }`. */
export function emitData(command: string, data: unknown) {
  emitJson({ command, data: data ?? null, ok: true, schemaVersion: SCHEMA_VERSION });
}

/** Imprime o resultado de um comando: JSON (--json) ou texto para pessoas. */
export function printResult(command: Command, data: unknown) {
  const runtime = getRuntime();

  if (runtime.json) {
    emitData(command.name, data);
    return;
  }
  if (data === undefined) return;

  const text = command.format
    ? command.format(data, runtime)
    : typeof data === 'string'
      ? data
      : JSON.stringify(data, null, 2);
  // Texto vazio = o comando já escreveu a própria saída (ex.: script em modo humano).
  if (text !== '') console.log(text);
}
