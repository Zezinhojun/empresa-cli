import { homedir } from 'node:os';
import path from 'node:path';

/** Pasta de exemplo que o comando `list-files` pode ler: `~/mycli/files`. */
export function getFilesPath(subPath = ''): string {
  return path.join(homedir(), 'mycli', 'files', subPath);
}
