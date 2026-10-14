import type { Dirent } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListVoxCommand } from '../../src/commands/ListVoxCommand.js';
import { listDirectory } from '../../src/core/utils/ListDirectory.js';
import { getVoxArquiteturaPath } from '../../src/vox/directories/VoxArquitetura.js';

vi.mock('../../src/core/utils/ListDirectory.js', () => ({
  listDirectory: vi.fn(),
}));

vi.mock('../../src/vox/directories/VoxArquitetura.js', () => ({
  getVoxArquiteturaPath: vi.fn(),
}));

describe('ListVoxCommand', () => {
  const command = new ListVoxCommand();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('deve ter o name e a description corretos', () => {
    expect(command.name).toBe('list-vox');
    expect(command.description).toBe('Lista o conteúdo da pasta ~/vox');
  });

  it('não deve imprimir nada quando listDirectory retorna null', async () => {
    vi.mocked(getVoxArquiteturaPath).mockReturnValue('/home/user/vox/arquitetura');
    vi.mocked(listDirectory).mockResolvedValue(null);

    await command.execute([]);

    expect(console.log).not.toHaveBeenCalled();
  });

  it('deve imprimir arquivos e pastas com os ícones corretos', async () => {
    vi.mocked(getVoxArquiteturaPath).mockReturnValue('/home/user/vox/arquitetura');
    vi.mocked(listDirectory).mockResolvedValue([
      { isDirectory: () => true, name: 'services' } as Dirent,
      { isDirectory: () => false, name: 'readme.md' } as Dirent,
    ]);

    await command.execute([]);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📁 services'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📄 readme.md'));
  });

  it('deve repassar o subPath informado para getVoxArquiteturaPath', async () => {
    vi.mocked(getVoxArquiteturaPath).mockReturnValue('/home/user/vox/arquitetura/services');
    vi.mocked(listDirectory).mockResolvedValue(null);

    await command.execute(['services']);

    expect(getVoxArquiteturaPath).toHaveBeenCalledWith('services');
  });
});
