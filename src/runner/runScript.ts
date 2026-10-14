import { execa } from 'execa';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { CliError, ExitCode } from '../cli/errors.js';
import { findInterpreter, runtimeOf, type Runtime } from './interpreters.js';

export interface RunOptions {
  args: string[];
  /** Captura stdout/stderr (modo --json). Senão, fluem direto para o terminal. */
  capture: boolean;
  cwd?: string;
  dryRun: boolean;
  /** Caminho absoluto do arquivo do script. */
  entry: string;
  env: Record<string, string>;
  /** Só repassa o stdin se a execução for interativa. */
  interactive: boolean;
  maxOutputBytes?: number;
  /** Nome do comando, usado nas mensagens. */
  name: string;
  timeoutSec: number;
}

export interface ScriptRun {
  /** Linha de comando exata (interpretador, arquivo e argumentos). */
  command: string[];
  dryRun: boolean;
  durationMs: number;
  exitCode: number | null;
  runtime: Runtime;
  stderr?: string;
  stdout?: string;
}

const RUNTIME_LABEL: Record<Runtime, string> = {
  bash: 'o Bash',
  node: 'o Node.js',
  python: 'o Python 3',
};

const DEFAULT_MAX_OUTPUT = 1_000_000;

export async function runScript(options: RunOptions): Promise<ScriptRun> {
  const runtime = runtimeOf(options.entry);
  if (!runtime) {
    throw new CliError(
      `Tipo de script não suportado: ${options.entry}`,
      ExitCode.usage,
      'UNSUPPORTED_SCRIPT_TYPE',
      'Use scripts .js, .sh ou .py.',
    );
  }

  const interpreter = await findInterpreter(runtime);
  if (!interpreter) {
    throw new CliError(
      `Não encontrei ${RUNTIME_LABEL[runtime]} neste computador, e o script '${options.name}' precisa dele.`,
      ExitCode.missingDependency,
      'MISSING_RUNTIME',
      `Instale ${RUNTIME_LABEL[runtime]} e tente de novo.`,
      { runtime },
    );
  }

  const command = [interpreter.command, ...interpreter.args, options.entry, ...options.args];

  if (options.dryRun) return { command, dryRun: true, durationMs: 0, exitCode: null, runtime };

  // Sem shell: o executável e cada argumento vão separados, então nada é interpretado
  // (espaços, aspas, ; & $() chegam literais ao script).
  let spawnArgs = [...interpreter.args, options.entry, ...options.args];
  let env = options.env;
  let cleanup = () => {};

  // O Git Bash (MSYS) interpreta a linha de comando do Windows com regras próprias (aspas simples
  // viram delimitador) e corromperia argumentos com ' ou ". Passamos os argumentos por um arquivo
  // separado por NUL e o bash os relê exatamente como vieram.
  if (runtime === 'bash' && process.platform === 'win32' && options.args.length > 0) {
    const dir = mkdtempSync(path.join(tmpdir(), 'vox-args-'));
    const argsFile = path.join(dir, 'args');
    writeFileSync(argsFile, options.args.map((a) => `${a}\0`).join(''));
    cleanup = () => rmSync(dir, { force: true, recursive: true });
    env = { ...env, VOX_ARGS_FILE: argsFile };
    spawnArgs = [
      '-c',
      'mapfile -d "" -t __vox_args < "$VOX_ARGS_FILE"; exec bash "$0" "${__vox_args[@]}"',
      options.entry,
    ];
  }

  const result = await execa(interpreter.command, spawnArgs, {
    ...(options.cwd && { cwd: options.cwd }),
    env,
    extendEnv: false,
    maxBuffer: options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT,
    reject: false,
    stderr: options.capture ? 'pipe' : 'inherit',
    stdin: options.interactive ? 'inherit' : 'ignore',
    stdout: options.capture ? 'pipe' : 'inherit',
    timeout: options.timeoutSec * 1000,
    windowsHide: true,
  }).finally(cleanup);
  if (result.timedOut) {
    throw new CliError(
      `O script '${options.name}' passou de ${options.timeoutSec}s e foi interrompido.`,
      ExitCode.error,
      'SCRIPT_TIMEOUT',
      'Tente de novo; se persistir, o script pode estar travado.',
      { timeoutSec: options.timeoutSec },
    );
  }

  if (result.isMaxBuffer) {
    throw new CliError(
      `O script '${options.name}' gerou saída demais e foi interrompido.`,
      ExitCode.error,
      'SCRIPT_OUTPUT_TOO_LARGE',
      'Redirecione a saída do script para um arquivo.',
      { maxOutputBytes: options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT },
    );
  }

  const output = options.capture
    ? { stderr: String(result.stderr), stdout: String(result.stdout) }
    : {};

  if (result.exitCode !== 0) {
    throw new CliError(
      `O script '${options.name}' falhou (código ${result.exitCode ?? 'desconhecido'}).`,
      ExitCode.error,
      'SCRIPT_FAILED',
      undefined,
      { exitCode: result.exitCode ?? null, ...output },
    );
  }

  return { command, dryRun: false, durationMs: result.durationMs, exitCode: 0, runtime, ...output };
}
