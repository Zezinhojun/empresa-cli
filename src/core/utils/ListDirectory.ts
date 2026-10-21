import type { Dirent } from 'node:fs';

import { readdir } from 'node:fs/promises';

/** Lê o diretório; erros (inexistente, sem permissão) são propagados para quem chama decidir. */
export function readDirectory(targetPath: string): Promise<Dirent[]> {
  return readdir(targetPath, { withFileTypes: true });
}

/** Versão silenciosa: `null` se o diretório não existe, não pode ser lido ou está vazio. */
export async function listDirectory(targetPath: string): Promise<Dirent[] | null> {
  try {
    const items = await readDirectory(targetPath);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}
