import { execa } from 'execa';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { CliError, ExitCode } from '../cli/errors.js';
import { installHelp, RUNTIME_LABEL } from './hints.js';
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

const DEFAULT_MAX_OUTPUT = 1_000_000;
/** Folga para o script limpar o que precisar (trap) antes de ser encerrado à força. */
const FORCE_KILL_AFTER_MS = 3000;

/** Encerra o grupo de processos do script (o líder é o próprio script, via `detached`). */
function killGroup(pid: number | undefined, signal: NodeJS.Signals = 'SIGKILL') {
  if (pid === undefined) return;
  try {
    process.kill(-pid, signal);
  } catch {
    // grupo já vazio: nada a encerrar
  }
}

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
    const install = installHelp(runtime);
    throw new CliError(
      `O comando '${options.name}' precisa do ${RUNTIME_LABEL[runtime]}, que não está instalado neste computador.`,
      ExitCode.missingDependency,
      'MISSING_RUNTIME',
      `${install} Para conferir o que falta: vox doctor`,
      { install, runtime },
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

  // Em POSIX o Node só mata o processo direto; netos ficariam órfãos depois de um timeout. Rodando
  // em grupo próprio dá para encerrar a árvore toda. Só sem terminal: um grupo em segundo plano não
  // pode ler do TTY, e o modo interativo precisa do stdin herdado. No Windows o execa já mata a árvore.
  const ownGroup = process.platform !== 'win32' && !options.interactive;
  const subprocess = execa(interpreter.command, spawnArgs, {
    detached: ownGroup,
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
  });

  // No grupo próprio o Ctrl+C do terminal não chega ao script (só à vox): repassamos o sinal ao grupo
  // e, se o script o ignorar, encerramos à força depois de uma pequena folga.
  let interrupted: NodeJS.Signals | undefined;
  const forward = (signal: NodeJS.Signals) => {
    interrupted = signal;
    killGroup(subprocess.pid, signal);
    setTimeout(() => killGroup(subprocess.pid), FORCE_KILL_AFTER_MS).unref();
  };
  // Um handler por sinal, com o nome já preso: não depende de o emissor passar o argumento.
  const handlers = (['SIGINT', 'SIGTERM', 'SIGHUP'] as const).map(
    (signal) => [signal, () => forward(signal)] as const,
  );
  if (ownGroup) for (const [signal, handler] of handlers) process.on(signal, handler);

  const result = await subprocess.finally(cleanup).finally(() => {
    for (const [signal, handler] of handlers) process.off(signal, handler);
  });
  if (ownGroup && (result.timedOut || result.isMaxBuffer || interrupted)) {
    killGroup(subprocess.pid);
  }
  if (interrupted) {
    throw new CliError(
      `O script '${options.name}' foi interrompido (${interrupted}).`,
      ExitCode.interrupted,
      'INTERRUPTED',
    );
  }
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
      'Se o erro se repetir, rode `vox report` para enviar ao time um relatório sem dados pessoais.',
      { exitCode: result.exitCode ?? null, ...output },
    );
  }

  return {
    command,
    dryRun: false,
    durationMs: Math.round(result.durationMs),
    exitCode: 0,
    runtime,
    ...output,
  };
}
