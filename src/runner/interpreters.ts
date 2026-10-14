import { execa } from 'execa';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type Runtime = 'bash' | 'node' | 'python';

export interface Interpreter {
  /** Argumentos que vêm antes do arquivo do script (ex.: `-3` do `py -3`). */
  args: string[];
  command: string;
  runtime: Runtime;
  /** Primeira linha da resposta de `--version` (ex.: "Python 3.12.6"). */
  version: string;
}

const BY_EXTENSION: Record<string, Runtime> = {
  '.cjs': 'node',
  '.js': 'node',
  '.mjs': 'node',
  '.py': 'python',
  '.sh': 'bash',
};

/** O runtime sai da extensão: ninguém precisa dizer como executar um script. */
export function runtimeOf(entry: string): Runtime | undefined {
  return BY_EXTENSION[path.extname(entry).toLowerCase()];
}

type Candidate = Pick<Interpreter, 'args' | 'command'>;

/** Git Bash nos lugares onde o instalador do Git for Windows costuma colocá-lo. */
function gitBashCandidates(env: NodeJS.ProcessEnv): Candidate[] {
  const roots = [
    env.ProgramFiles,
    env['ProgramFiles(x86)'],
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs'),
  ];
  return roots
    .filter((root): root is string => Boolean(root))
    .map((root) => path.join(root, 'Git', 'bin', 'bash.exe'))
    .filter((file) => existsSync(file))
    .map((command) => ({ args: [], command }));
}

function candidatesFor(
  runtime: Runtime,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): Candidate[] {
  switch (runtime) {
    case 'bash':
      // No Windows, o `bash` do PATH costuma ser o launcher do WSL (System32\bash.exe), que não
      // entende caminhos do Windows. Só aceitamos o Git Bash.
      return platform === 'win32' ? gitBashCandidates(env) : [{ args: [], command: 'bash' }];
    case 'node':
      return [{ args: [], command: process.execPath }];
    case 'python':
      return [
        { args: [], command: 'python3' },
        { args: [], command: 'python' },
        { args: ['-3'], command: 'py' },
      ];
  }
}

const PROBE: Partial<Record<Runtime, RegExp>> = {
  bash: /bash/i,
  python: /Python 3\./,
};

/**
 * Só vale o que **funciona**: executa `--version` e devolve a primeira linha da resposta. Isso
 * descarta o atalho vazio da Microsoft Store (`python3` que só abre a loja) e Python 2.
 */
async function probe(candidate: Candidate, runtime: Runtime): Promise<string | undefined> {
  try {
    const result = await execa(candidate.command, [...candidate.args, '--version'], {
      reject: false,
      stdin: 'ignore',
      timeout: 5000,
    });
    const text = `${result.stdout}\n${result.stderr}`;
    const expected = PROBE[runtime];
    if (result.exitCode !== 0 || (expected && !expected.test(text))) return undefined;
    return (
      text
        .split(/\r?\n/)
        .find((line) => line.trim() !== '')
        ?.trim() ?? ''
    );
  } catch {
    return undefined;
  }
}

const cache = new Map<Runtime, Promise<Interpreter | undefined>>();

export function resetInterpreterCache() {
  cache.clear();
}

/** Primeiro interpretador que funciona para o runtime, ou `undefined` se não houver nenhum. */
export function findInterpreter(
  runtime: Runtime,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Interpreter | undefined> {
  const cached = cache.get(runtime);
  if (cached) return cached;

  const search = (async () => {
    for (const candidate of candidatesFor(runtime, platform, env)) {
      if (runtime === 'node') return { ...candidate, runtime, version: process.version };
      const version = await probe(candidate, runtime);
      if (version !== undefined) return { ...candidate, runtime, version };
    }
    return undefined;
  })();
  cache.set(runtime, search);
  return search;
}
