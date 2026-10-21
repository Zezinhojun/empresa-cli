import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { resolveTarget } from './target.js';

const root = mkdtempSync(path.join(tmpdir(), 'vox-target-'));
afterAll(() => rmSync(root, { force: true, recursive: true }));

const project = (name: string) => {
  const dir = path.join(root, name);
  mkdirSync(dir);
  writeFileSync(path.join(dir, 'package.json'), '{}');
  return dir;
};

describe('resolveTarget', () => {
  it('aceita um projeto', () => {
    expect(resolveTarget(project('ok'))).toContain('ok');
  });

  it('recusa pasta sem package.json nem composer.json', () => {
    const dir = path.join(root, 'vazia');
    mkdirSync(dir);
    expect(() => resolveTarget(dir)).toThrow(/não parece um projeto/);
  });

  it('recusa a pasta pessoal e a raiz do disco', () => {
    expect(() => resolveTarget(homedir())).toThrow(/pessoal ou do sistema/);
    expect(() => resolveTarget(path.parse(process.cwd()).root)).toThrow(/pessoal ou do sistema/);
  });

  it('recusa apagar pasta que é link simbólico', () => {
    const dir = project('link');
    try {
      symlinkSync(root, path.join(dir, 'node_modules'), 'junction');
    } catch {
      return; // sem permissão para criar link neste sistema
    }
    expect(() => resolveTarget(dir, ['node_modules'])).toThrow(/link simbólico/);
  });
});
