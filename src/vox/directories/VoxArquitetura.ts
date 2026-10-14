import path from 'node:path';

import { getVoxPath } from './VoxHome.js';

export function getVoxArquiteturaPath(subPath = ''): string {
  return path.join(getVoxPath('arquitetura'), subPath);
}
