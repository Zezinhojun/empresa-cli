import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRuntime, setRuntime } from '../cli/runtime.js';
import { CommandExecutor } from '../core/command/CommandExecutor.js';
import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { buildIndex, INDEX_FILE } from '../runner/scriptIndex.js';
import { registerScriptCommands } from './ScriptCommands.js';

// Os scripts rodam de verdade: usa o execa real, não o mock global do setup.
vi.unmock('execa');

let root: string;
let registry: CommandRegistry;

const addScript = (name: string, manifest: Record<string, unknown> = {}) => {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify({
      description: `Faz ${name}`,
      entry: 'run.js',
      name,
      risk: 'read',
      ...manifest,
    }),
  );
  writeFileSync(path.join(dir, 'run.js'), 'console.log(JSON.stringify(process.argv.slice(2)));');
};
const publish = () => writeFileSync(path.join(root, INDEX_FILE), JSON.stringify(buildIndex(root)));

beforeEach(() => {
  root = path.join(mkdtempSync(path.join(tmpdir(), 'vox-cmds-')), 'vox-scripts');
  mkdirSync(root, { recursive: true });
  (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
  registry = CommandRegistry.getInstance();
});
afterEach(() => {
  resetRuntime();
  rmSync(path.dirname(root), { force: true, recursive: true });
});

describe('registerScriptCommands', () => {
  it('registra cada script do índice como um comando do tipo "script"', () => {
    addScript('alfa', { category: 'setup', risk: 'write' });
    addScript('beta');
    publish();

    expect(registerScriptCommands(registry, root)).toBe(2);

    expect(registry.list().map((c) => c.name)).toEqual(['alfa', 'beta']);
    expect(registry.get('alfa')).toMatchObject({
      category: 'setup',
      kind: 'script',
      risk: 'write',
    });
  });

  it('sem índice (nenhum script instalado) ou sem pasta: 0 e não quebra', () => {
    expect(registerScriptCommands(registry, root)).toBe(0);
    expect(registerScriptCommands(registry, null)).toBe(0);
    expect(registry.list()).toEqual([]);
  });

  it('o script registrado executa pelo mesmo caminho dos demais comandos (JSON no envelope)', async () => {
    addScript('eco');
    publish();
    registerScriptCommands(registry, root);
    setRuntime({
      dryRun: false,
      interactive: false,
      json: true,
      plain: true,
      verbose: false,
      yes: false,
    });
    const writes: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });

    await expect(new CommandExecutor(registry).execute('eco', ['um', 'dois'])).resolves.toBe(true);

    const out = JSON.parse(writes.join('')) as {
      command: string;
      data: { stdout: string };
      ok: boolean;
    };
    expect(out).toMatchObject({ command: 'eco', ok: true });
    expect(JSON.parse(out.data.stdout)).toEqual(['um', 'dois']);
    vi.restoreAllMocks();
  });

  it('nome repetido com um comando já registrado: erro (o build barra isso antes)', () => {
    registry.register({ execute: () => {}, name: 'alfa' });
    addScript('alfa');
    publish();

    expect(() => registerScriptCommands(registry, root)).toThrow(/já está registrado/);
  });
});
