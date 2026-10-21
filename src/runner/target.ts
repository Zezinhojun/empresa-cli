import { lstatSync, existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** Pastas que nunca são alvo de script que apaga ou instala (só a própria pasta, não o conteúdo). */
const POSIX_SYSTEM = [
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/lib',
  '/opt',
  '/proc',
  '/sbin',
  '/sys',
  '/usr',
  '/var',
];
/** Variáveis do Windows cujas pastas (e tudo dentro delas) são do sistema. */
const WINDOWS_TREES = ['SystemRoot', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramData'];

const same = (a: string, b: string) =>
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

const inside = (child: string, parent: string) => {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

/**
 * Confere se `cwd` pode ser alvo de um script que apaga ou instala (ADR 0003) e devolve o caminho
 * absoluto real (symlinks resolvidos). Lança `Error` com o motivo em português simples.
 * Também recusa se uma das pastas apagadas (`dirs`, ex.: `node_modules`) for um symlink.
 */
export function resolveTarget(cwd: string, dirs: string[] = []): string {
  const target = realpathSync(cwd);

  const system =
    same(target, path.parse(target).root) ||
    same(target, realpathSync(homedir())) ||
    POSIX_SYSTEM.some((dir) => same(target, dir)) ||
    WINDOWS_TREES.some((name) => {
      const dir = process.env[name];
      return dir !== undefined && dir !== '' && inside(target.toLowerCase(), dir.toLowerCase());
    });
  if (system) throw new Error(`'${target}' é uma pasta pessoal ou do sistema, não um projeto.`);

  if (
    !existsSync(path.join(target, 'package.json')) &&
    !existsSync(path.join(target, 'composer.json'))
  ) {
    throw new Error(`'${target}' não parece um projeto (sem package.json nem composer.json).`);
  }

  for (const dir of dirs) {
    const full = path.join(target, dir);
    if (existsSync(full) && lstatSync(full).isSymbolicLink()) {
      throw new Error(`'${full}' é um link simbólico; por segurança ele não é apagado.`);
    }
  }
  return target;
}
