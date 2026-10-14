import type { Dirent } from 'node:fs';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import * as ListDirectory from '../../core/utils/ListDirectory.js';
import * as VoxHome from './VoxHome.js';

vi.mock('../../core/utils/ListDirectory.js');

describe('VoxHome (getVoxPath, groups)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ListDirectory.listDirectory).mockReset();
  });

  describe('getVoxPath', () => {
    it('retorna caminho ~/vox', () => {
      const path = VoxHome.getVoxPath();
      expect(path).toContain('vox');
    });

    it('adiciona subPath corretamente', () => {
      const path = VoxHome.getVoxPath('sub/pasta');
      expect(path).toContain('vox');
      expect(path).toContain('sub');
      expect(path).toContain('pasta');
    });
  });

  describe('getVoxGroup helpers', () => {
    const mockItems = [
      { isDirectory: () => true, name: 'auth-service' },
      { isDirectory: () => true, name: 'api-service' },
      { isDirectory: () => true, name: 'exotico-legacy' },
      { isDirectory: () => true, name: 'legacy-old' },
      { isDirectory: () => true, name: 'front-external-front' },
      { isDirectory: () => true, name: 'admin-internal-front' },
      { isDirectory: () => true, name: 'random-folder' },
    ] as unknown as Dirent[];

    it('getVoxBanList filtra auth-service', async () => {
      vi.mocked(ListDirectory.listDirectory).mockResolvedValueOnce(mockItems);
      const result = await VoxHome.getVoxBanList();
      expect(result).toHaveLength(1);
      expect(result?.[0]?.name).toBe('auth-service');
    });

    it('getVoxService filtra *-service', async () => {
      vi.mocked(ListDirectory.listDirectory).mockResolvedValueOnce(mockItems);
      const result = await VoxHome.getVoxService();
      expect(result).toHaveLength(2);
      expect(result?.map((r) => r.name).sort()).toEqual(['api-service', 'auth-service']);
    });

    it('getVoxExoticos filtra exotico-* e legacy-*', async () => {
      vi.mocked(ListDirectory.listDirectory).mockResolvedValueOnce(mockItems);
      const result = await VoxHome.getVoxExoticos();
      expect(result).toHaveLength(2);
      expect(result?.map((r) => r.name).sort()).toEqual(['exotico-legacy', 'legacy-old']);
    });

    it('getExternalFront filtra *-external-front', async () => {
      vi.mocked(ListDirectory.listDirectory).mockResolvedValueOnce(mockItems);
      const result = await VoxHome.getExternalFront();
      expect(result).toHaveLength(1);
      expect(result?.[0]?.name).toBe('front-external-front');
    });

    it('getInternalFront filtra *-internal-front', async () => {
      vi.mocked(ListDirectory.listDirectory).mockResolvedValueOnce(mockItems);
      const result = await VoxHome.getInternalFront();
      expect(result).toHaveLength(1);
      expect(result?.[0]?.name).toBe('admin-internal-front');
    });

    it('retorna null se listDirectory retornar null', async () => {
      vi.mocked(ListDirectory.listDirectory).mockResolvedValueOnce(null);
      const result = await VoxHome.getVoxService();
      expect(result).toBeNull();
    });

    it('retorna null se nenhum item matcher', async () => {
      vi.mocked(ListDirectory.listDirectory).mockResolvedValueOnce([
        { isDirectory: () => true, name: 'other' },
      ] as unknown as Dirent[]);
      const result = await VoxHome.getVoxService();
      expect(result).toBeNull();
    });

    it('ignora arquivos (não diretórios)', async () => {
      vi.mocked(ListDirectory.listDirectory).mockResolvedValueOnce([
        { isDirectory: () => false, name: 'api-service' },
      ] as unknown as Dirent[]);
      const result = await VoxHome.getVoxService();
      expect(result).toBeNull();
    });
  });
});
