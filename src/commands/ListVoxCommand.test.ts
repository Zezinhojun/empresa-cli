import type { Dirent } from 'node:fs';

import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Runtime } from '../cli/runtime.js';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { readDirectory } from '../core/utils/ListDirectory.js';
import { getVoxArquiteturaPath } from '../vox/directories/VoxArquitetura.js';
import { ListVoxCommand } from './ListVoxCommand.js';

vi.mock('../vox/directories/VoxArquitetura.js', () => ({ getVoxArquiteturaPath: vi.fn() }));
vi.mock('../core/utils/ListDirectory.js', () => ({ readDirectory: vi.fn() }));

const BASE = path.join('/mock', 'arquitetura');
const entry = (name: string, dir: boolean) =>
  ({ isDirectory: () => dir, name }) as unknown as Dirent;
const rt = (plain: boolean): Runtime => ({
  dryRun: false,
  interactive: false,
  json: false,
  plain,
  verbose: false,
  yes: false,
});

describe('ListVoxCommand', () => {
  let cmd: ListVoxCommand;

  beforeEach(() => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    CommandRegistry.getInstance();
    cmd = new ListVoxCommand();
    vi.mocked(getVoxArquiteturaPath).mockImplementation((sub = '') => path.join(BASE, sub));
  });

  afterEach(() => vi.clearAllMocks());

  it('tem nome, descrição e a subpasta como argumento opcional', () => {
    expect(cmd.name).toBe('list-vox');
    expect(cmd.description).toContain('Lista o conteúdo');
    expect(cmd.args).toEqual([{ description: expect.any(String), name: 'subpasta' }]);
  });

  it('devolve os itens como dados, ordenados, com o tipo', async () => {
    vi.mocked(readDirectory).mockResolvedValueOnce([entry('z.txt', false), entry('api', true)]);

    await expect(cmd.execute()).resolves.toEqual({
      items: [
        { name: 'api', type: 'dir' },
        { name: 'z.txt', type: 'file' },
      ],
      path: BASE,
    });
    expect(readDirectory).toHaveBeenCalledWith(BASE);
  });

  it('usa a subpasta informada', async () => {
    vi.mocked(readDirectory).mockResolvedValueOnce([]);

    const data = await cmd.execute(['services']);

    expect(data.path).toBe(path.join(BASE, 'services'));
  });

  it.each([['../..'], ['../outra'], [path.join('a', '..', '..', 'x')]])(
    'recusa subpasta que escapa de arquitetura (%s) com exit 2',
    async (sub) => {
      await expect(cmd.execute([sub])).rejects.toMatchObject({
        code: 'PATH_OUTSIDE_BASE',
        exitCode: 2,
      });
      expect(readDirectory).not.toHaveBeenCalled();
    },
  );

  it('pasta inexistente: erro NOT_FOUND (exit 1)', async () => {
    vi.mocked(readDirectory).mockRejectedValueOnce(
      Object.assign(new Error('x'), { code: 'ENOENT' }),
    );

    await expect(cmd.execute()).rejects.toMatchObject({ code: 'NOT_FOUND', exitCode: 1 });
  });

  it('sem permissão: erro PERMISSION_DENIED', async () => {
    vi.mocked(readDirectory).mockRejectedValueOnce(
      Object.assign(new Error('x'), { code: 'EACCES' }),
    );

    await expect(cmd.execute()).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  describe('format', () => {
    const data = {
      items: [
        { name: 'pasta', type: 'dir' as const },
        { name: 'a.txt', type: 'file' as const },
      ],
      path: BASE,
    };

    it('com decoração: ícones', () => {
      const out = cmd.format(data, rt(false));
      expect(out).toContain('📁 pasta');
      expect(out).toContain('📄 a.txt');
    });

    it('plain: sem emoji; pasta termina com /', () => {
      const out = cmd.format(data, rt(true));
      expect(out).toContain('pasta/');
      expect(out).toContain('a.txt');
      expect(out).not.toMatch(/📁|📄/u);
    });

    it('pasta vazia', () => {
      expect(cmd.format({ items: [], path: BASE }, rt(true))).toContain('está vazia');
    });
  });
});
