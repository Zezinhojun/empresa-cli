export interface GlobalFlags {
  /** `--confirm=<pasta alvo>`: confirmação de script `destructive` sem terminal (ADR 0003). */
  confirm?: string | undefined;
  dryRun: boolean;
  help: boolean;
  json: boolean;
  noInput: boolean;
  plain: boolean;
  verbose: boolean;
  version: boolean;
  yes: boolean;
}

export interface ParsedArgv {
  /** Argumentos do comando (sem flags globais). */
  args: string[];
  command: string | undefined;
  flags: GlobalFlags;
  /** Opções começadas por "-" que a CLI não reconhece. */
  unknown: string[];
}

const FLAG_NAMES: Record<string, Exclude<keyof GlobalFlags, 'confirm'>> = {
  '--dry-run': 'dryRun',
  '--help': 'help',
  '--json': 'json',
  '--no-input': 'noInput',
  '--plain': 'plain',
  '--verbose': 'verbose',
  '--version': 'version',
  '--yes': 'yes',
  '-h': 'help',
  '-v': 'version',
  '-y': 'yes',
};

/**
 * Separa flags globais (em qualquer posição) do comando e dos seus argumentos.
 * Tudo depois de `--` é entregue literal ao comando. `vox help [cmd]` equivale a `[cmd] --help`.
 */
export function parseArgv(argv: string[]): ParsedArgv {
  const flags: GlobalFlags = {
    dryRun: false,
    help: false,
    json: false,
    noInput: false,
    plain: false,
    verbose: false,
    version: false,
    yes: false,
  };
  const rest: string[] = [];
  const unknown: string[] = [];

  for (const [index, token] of argv.entries()) {
    if (token === '--') {
      rest.push(...argv.slice(index + 1));
      break;
    }
    if (token.startsWith('--confirm=')) {
      flags.confirm = token.slice('--confirm='.length);
      continue;
    }
    const flag = FLAG_NAMES[token];
    if (flag) flags[flag] = true;
    else if (token.startsWith('-') && token.length > 1) unknown.push(token);
    else rest.push(token);
  }

  if (rest[0] === 'help') {
    flags.help = true;
    rest.shift();
  }

  const [command, ...args] = rest;
  return { args, command, flags, unknown };
}
