import { homedir } from 'node:os';
import path from 'node:path';

export function getVoxPath(subPath = ''): string {
  return path.join(homedir(), 'vox', subPath);
}
