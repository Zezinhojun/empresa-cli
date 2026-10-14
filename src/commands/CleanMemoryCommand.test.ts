import type { Result } from 'execa';

import * as inquirer from '@inquirer/prompts';
import * as execaModule from 'execa';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { CleanMemoryCommand } from './CleanMemoryCommand.js';

vi.mock('execa');
vi.mock('@inquirer/prompts');

describe('CleanMemoryCommand', () => {
  let cmd: CleanMemoryCommand;
  const originalPlatform = process.platform;

  beforeEach(() => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    CommandRegistry.getInstance();
    cmd = new CleanMemoryCommand();
    vi.clearAllMocks();
    vi.mocked(execaModule.execa).mockReset();
    vi.mocked(inquirer.confirm).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform });
  });

  it('tem nome e descrição corretos', () => {
    expect(cmd.name).toBe('clean-memory');
    expect(cmd.description).toContain('memória');
  });

  it('chama getTopProcesses no Windows (powershell)', async () => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' });
    vi.mocked(execaModule.execa).mockResolvedValueOnce({
      stdout: 'Process List',
    } as unknown as Result);
    vi.mocked(inquirer.confirm).mockResolvedValueOnce(false);

    await cmd.execute();

    expect(execaModule.execa).toHaveBeenCalledWith('powershell', [
      '-Command',
      'Get-Process | Sort-Object WS -Descending | Select-Object -First 10 Name, Id, WS',
    ]);
  });

  it('chama getTopProcesses no Unix (sh + ps)', async () => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' });
    vi.mocked(execaModule.execa).mockResolvedValueOnce({
      stdout: 'Process List',
    } as unknown as Result);
    vi.mocked(inquirer.confirm).mockResolvedValueOnce(false);

    await cmd.execute();

    expect(execaModule.execa).toHaveBeenCalledWith('sh', [
      '-c',
      'ps aux --sort=-%mem | head -n 10',
    ]);
  });

  it('não lança erro se getTopProcesses falhar', async () => {
    vi.mocked(execaModule.execa).mockRejectedValueOnce(new Error('Command failed'));
    vi.mocked(inquirer.confirm).mockResolvedValueOnce(false);

    await expect(cmd.execute()).resolves.not.toThrow();
  });

  it('não executa limpeza se usuário não confirmar', async () => {
    vi.mocked(execaModule.execa).mockResolvedValueOnce({ stdout: 'list' } as unknown as Result);
    vi.mocked(inquirer.confirm).mockResolvedValueOnce(false);

    await cmd.execute();

    expect(inquirer.confirm).toHaveBeenCalled();
  });

  it('prossegue se usuário confirmar', async () => {
    vi.mocked(execaModule.execa).mockResolvedValueOnce({ stdout: 'list' } as unknown as Result);
    vi.mocked(inquirer.confirm).mockResolvedValueOnce(true);

    await cmd.execute();

    expect(inquirer.confirm).toHaveBeenCalled();
  });
});
