import type { Dirent } from 'node:fs';

import chalk from 'chalk';
import { readdir } from 'node:fs/promises';

export async function listDirectory(targetPath: string): Promise<Dirent[] | null> {
  let items;
  try {
    items = await readdir(targetPath, { withFileTypes: true });
  } catch {
    console.log(chalk.red(`Pasta não encontrada em ${targetPath}`));
    return null;
  }

  if (items.length === 0) {
    console.log(chalk.yellow(`Pasta ${targetPath} está vazia`));
    return null;
  }

  return items;
}
