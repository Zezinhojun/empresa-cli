import type { GlobalFlags } from './parseArgv.js';

/** Como a CLI está sendo usada nesta execução (pessoa no terminal × agente/CI/pipe). */
export interface Runtime {
  /** Pode abrir prompts? Só com terminal de verdade e sem --no-input/--json/CI. */
  interactive: boolean;
  json: boolean;
  /** Sem cor, emoji ou decoração. */
  plain: boolean;
  verbose: boolean;
  /** Confirma automaticamente as perguntas. */
  yes: boolean;
}

interface Env {
  CI?: string | undefined;
  NO_COLOR?: string | undefined;
}

interface Tty {
  isTTY?: boolean | undefined;
}

export function resolveRuntime(
  flags: Pick<GlobalFlags, 'json' | 'noInput' | 'plain' | 'verbose' | 'yes'>,
  env: Env = process.env,
  stdin: Tty = process.stdin,
  stdout: Tty = process.stdout,
): Runtime {
  const ci = env.CI !== undefined && env.CI !== '' && env.CI !== 'false' && env.CI !== '0';
  const terminal = Boolean(stdin.isTTY && stdout.isTTY);

  return {
    interactive: terminal && !flags.noInput && !flags.json && !ci,
    json: flags.json,
    plain: flags.plain || flags.json || !stdout.isTTY || (env.NO_COLOR ?? '') !== '',
    verbose: flags.verbose,
    yes: flags.yes,
  };
}

let current: Runtime | undefined;

export function setRuntime(runtime: Runtime) {
  current = runtime;
}

/** Runtime da execução atual; se ninguém definiu, deduz do ambiente (sem flags). */
export function getRuntime(): Runtime {
  current ??= resolveRuntime({
    json: false,
    noInput: false,
    plain: false,
    verbose: false,
    yes: false,
  });
  return current;
}

export function resetRuntime() {
  current = undefined;
}
