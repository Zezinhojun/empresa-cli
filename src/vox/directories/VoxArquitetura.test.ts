import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getVoxArquiteturaPath } from './VoxArquitetura.js';
import * as VoxHome from './VoxHome.js';

vi.mock('./VoxHome.js');

describe('VoxArquitetura', () => {
  beforeEach(() => {
    // Mock getVoxPath to return a path that includes the subPath
    vi.mocked(VoxHome.getVoxPath).mockImplementation((subPath = '') => {
      return `/home/user/vox/${subPath}`.replace(/\/+$/, '');
    });
  });

  it('getVoxArquiteturaPath combina com getVoxPath', () => {
    const result = getVoxArquiteturaPath('sub/pasta');
    expect(result).toContain('vox');
    expect(result).toContain('arquitetura');
    expect(result).toContain('sub');
    expect(result).toContain('pasta');
  });

  it('getVoxArquiteturaPath sem args retorna apenas arquitetura', () => {
    const result = getVoxArquiteturaPath();
    expect(result).toContain('vox');
    expect(result).toContain('arquitetura');
    expect(result).not.toContain('sub');
  });

  it('delega para getVoxPath com "arquitetura" e junta subPath', () => {
    const spy = vi.spyOn(VoxHome, 'getVoxPath');
    getVoxArquiteturaPath('test');
    // getVoxPath é chamado apenas com "arquitetura", o subPath é feito no path.join
    expect(spy).toHaveBeenCalledWith('arquitetura');
  });
});
