import type { Dirent } from 'node:fs';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { listDirectory } from '../core/utils/ListDirectory.js';
import { getVoxArquiteturaPath } from '../vox/directories/VoxArquitetura.js';
import { ListVoxCommand } from './ListVoxCommand.js';

vi.mock('../vox/directories/VoxArquitetura.js', () => ({
  getVoxArquiteturaPath: vi.fn(),
}));

vi.mock('../core/utils/ListDirectory.js', () => ({
  listDirectory: vi.fn(),
}));

describe('ListVoxCommand', () => {
  let cmd: ListVoxCommand;

  beforeEach(() => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    CommandRegistry.getInstance();
    cmd = new ListVoxCommand();
    vi.clearAllMocks();
    vi.mocked(getVoxArquiteturaPath).mockReset();
    vi.mocked(listDirectory).mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  it('tem nome e descrição corretos', () => {
    expect(cmd.name).toBe('list-vox');
    expect(cmd.description).toContain('Lista o conteúdo');
  });

  it('chama getVoxArquiteturaPath e listDirectory', async () => {
    const mockItems = [
      { isDirectory: () => true, isFile: () => false, name: 'dir1' },
      { isDirectory: () => false, isFile: () => true, name: 'file1.ts' },
    ] as unknown as Dirent[];
    vi.mocked(getVoxArquiteturaPath).mockReturnValue('/mock/vox/arquitetura');
    vi.mocked(listDirectory).mockResolvedValueOnce(mockItems);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmd.execute(['subpath']);
    consoleSpy.mockRestore();

    expect(getVoxArquiteturaPath).toHaveBeenCalledWith('subpath');
    expect(listDirectory).toHaveBeenCalledWith('/mock/vox/arquitetura');
  });

  it('usa string vazia como subPath padrão', async () => {
    vi.mocked(getVoxArquiteturaPath).mockReturnValue('/mock/vox/arquitetura');
    vi.mocked(listDirectory).mockResolvedValueOnce([]);

    await cmd.execute([]);

    expect(getVoxArquiteturaPath).toHaveBeenCalledWith('');
  });

  it('retorna early se listDirectory retornar null', async () => {
    vi.mocked(getVoxArquiteturaPath).mockReturnValue('/mock/path');
    vi.mocked(listDirectory).mockResolvedValueOnce(null);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmd.execute();

    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Conteúdo de'));
    consoleSpy.mockRestore();
  });

  it('lista diretórios e arquivos com ícones corretos', async () => {
    const mockItems = [
      { isDirectory: () => true, isFile: () => false, name: 'pasta' },
      { isDirectory: () => false, isFile: () => true, name: 'arquivo.txt' },
    ] as unknown as Dirent[];
    vi.mocked(getVoxArquiteturaPath).mockReturnValue('/mock/path');
    vi.mocked(listDirectory).mockResolvedValueOnce(mockItems);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmd.execute();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📁 pasta'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📄 arquivo.txt'));
    consoleSpy.mockRestore();
  });
});
