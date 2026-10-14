import { accessSync, constants, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Procura um executável no PATH, como o shell faria (no Windows, respeitando PATHEXT).
 * Não executa nada: só olha se o arquivo existe e pode ser executado.
 */
export function which(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const windows = platform === 'win32';
  // No Windows a variável pode se chamar Path ou PATH.
  const pathVar = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? '';
  const dirs = pathVar.split(windows ? ';' : ':').filter(Boolean);
  const extensions = windows
    ? ['', ...(env.PATHEXT ?? '.com;.exe;.bat;.cmd').split(';').filter(Boolean)]
    : [''];

  for (const dir of dirs) {
    for (const extension of extensions) {
      const candidate = path.join(dir, name + extension);
      try {
        if (!statSync(candidate).isFile()) continue;
        if (!windows) accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // não existe ou não é executável: tenta o próximo
      }
    }
  }
  return undefined;
}
