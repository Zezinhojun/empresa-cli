import { homedir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getFilesPath } from './files.js';

describe('getFilesPath', () => {
  it('fica em ~/mycli/files', () => {
    expect(getFilesPath()).toBe(path.join(homedir(), 'mycli', 'files'));
    expect(getFilesPath('a')).toBe(path.join(homedir(), 'mycli', 'files', 'a'));
  });
});
