import type { Dirent } from 'node:fs';

import * as fsPromises from 'node:fs/promises';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { listDirectory, readDirectory } from './ListDirectory.js';

vi.mock('node:fs/promises');

describe('ListDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fsPromises.readdir).mockReset();
  });

  it('retorna itens quando diretório existe e tem conteúdo', async () => {
    const mockItems = [
      { isDirectory: () => false, isFile: () => true, name: 'file.txt' },
      { isDirectory: () => true, isFile: () => false, name: 'dir' },
    ] as unknown as Dirent[];
    vi.mocked(fsPromises.readdir).mockResolvedValueOnce(mockItems as never);

    const result = await listDirectory('/some/path');

    expect(result).toEqual(mockItems);
    expect(fsPromises.readdir).toHaveBeenCalledWith('/some/path', { withFileTypes: true });
  });

  it('retorna null quando diretório não existe', async () => {
    vi.mocked(fsPromises.readdir).mockRejectedValueOnce(new Error('ENOENT'));

    const result = await listDirectory('/nonexistent');

    expect(result).toBeNull();
  });

  it('retorna null quando diretório vazio', async () => {
    vi.mocked(fsPromises.readdir).mockResolvedValueOnce([]);

    const result = await listDirectory('/empty');

    expect(result).toBeNull();
  });

  it('não imprime nada no console (a saída é responsabilidade de quem chama)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(fsPromises.readdir).mockRejectedValueOnce(new Error('ENOENT'));

    await listDirectory('/nada');

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('readDirectory propaga o erro original (inexistente, sem permissão...)', async () => {
    vi.mocked(fsPromises.readdir).mockRejectedValueOnce(new Error('EACCES'));

    await expect(readDirectory('/x')).rejects.toThrow('EACCES');
  });
});
