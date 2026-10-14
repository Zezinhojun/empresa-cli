import type { Dirent } from 'node:fs';

import { homedir } from 'node:os';
import path from 'node:path';

import { listDirectory } from '../../core/utils/ListDirectory.js';

export function getVoxPath(subPath = ''): string {
  return path.join(homedir(), 'vox', subPath);
}

interface VoxMatcher {
  names?: string[];
  startsWith?: string[];
  endsWith?: string[];
}

const VOX_GROUPS = {
  banList: { names: ['auth-service'] },
  exoticos: { startsWith: ['exotico-', 'legacy-'] },
  externalFront: { endsWith: ['-external-front'] },
  internalFront: { endsWith: ['-internal-front'] },
  service: { endsWith: ['-service'] },
} as const satisfies Record<string, VoxMatcher>;

type VoxGroupName = keyof typeof VOX_GROUPS;

function matchesGroup(name: string, matcher: VoxMatcher): boolean {
  if (matcher.names && !matcher.names.includes(name)) return false;
  if (matcher.startsWith && !matcher.startsWith.some((p) => name.startsWith(p))) return false;
  if (matcher.endsWith && !matcher.endsWith.some((s) => name.endsWith(s))) return false;
  return true;
}

async function getVoxGroup(groupName: VoxGroupName): Promise<Dirent[] | null> {
  const matcher = VOX_GROUPS[groupName];
  const items = await listDirectory(getVoxPath());
  if (!items) return null;

  const matched = items.filter((item) => item.isDirectory() && matchesGroup(item.name, matcher));
  return matched.length > 0 ? matched : null;
}

export const getVoxBanList = () => getVoxGroup('banList');
export const getVoxService = () => getVoxGroup('service');
export const getExternalFront = () => getVoxGroup('externalFront');
export const getInternalFront = () => getVoxGroup('internalFront');
export const getVoxExoticos = () => getVoxGroup('exoticos');
