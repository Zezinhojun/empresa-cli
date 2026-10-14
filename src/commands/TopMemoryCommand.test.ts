import * as execaModule from 'execa';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { parsePs, TopMemoryCommand } from './TopMemoryCommand.js';

vi.mock('execa');

const execaResult = (stdout: string) =>
  ({ stdout }) as unknown as Awaited<ReturnType<typeof execaModule.execa>>;
const originalPlatform = process.platform;
const setPlatform = (value: string) =>
  Object.defineProperty(process, 'platform', { configurable: true, value });

describe('TopMemoryCommand', () => {
  let cmd: TopMemoryCommand;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    CommandRegistry.getInstance();
    cmd = new TopMemoryCommand();
    vi.mocked(execaModule.execa).mockReset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setPlatform(originalPlatform);
    process.exitCode = undefined;
  });

  it('tem nome e descrição corretos', () => {
    expect(cmd.name).toBe('top-memory');
    expect(cmd.description).toContain('memória');
  });

  it('usa PowerShell no Windows', async () => {
    setPlatform('win32');
    vi.mocked(execaModule.execa).mockResolvedValueOnce(execaResult('Process List'));

    await cmd.execute();

    expect(execaModule.execa).toHaveBeenCalledWith('powershell', [
      '-NoProfile',
      '-Command',
      'Get-Process | Sort-Object WS -Descending | Select-Object -First 10 Name, Id, WS',
    ]);
    expect(logSpy).toHaveBeenCalledWith('Process List');
  });

  it.each(['linux', 'darwin'])(
    'usa ps portátil (sem --sort) e ordena por memória em %s',
    async (platform) => {
      setPlatform(platform);
      vi.mocked(execaModule.execa).mockResolvedValueOnce(
        execaResult('  10   2048 small\n  20 409600 big proc\n  30  10240 mid'),
      );

      await cmd.execute();

      expect(execaModule.execa).toHaveBeenCalledWith('ps', ['-axo', 'pid=,rss=,comm=']);
      const table = String(logSpy.mock.calls.at(-1)?.[0]).split('\n');
      expect(table[1]).toContain('big proc');
      expect(table[1]).toContain('400.0 MB');
      expect(table[2]).toContain('mid');
      expect(table[3]).toContain('small');
    },
  );

  it('limita a 10 processos', async () => {
    setPlatform('linux');
    const lines = Array.from({ length: 15 }, (_, i) => `${i + 1} ${(i + 1) * 100} p${i + 1}`).join(
      '\n',
    );
    vi.mocked(execaModule.execa).mockResolvedValueOnce(execaResult(lines));

    await cmd.execute();

    expect(String(logSpy.mock.calls.at(-1)?.[0]).split('\n')).toHaveLength(11); // cabeçalho + 10
  });

  it('em caso de erro, informa e sai com código 1', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(execaModule.execa).mockRejectedValueOnce(new Error('Command failed'));

    await expect(cmd.execute()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.anything(), 'Command failed');
    expect(process.exitCode).toBe(1);
  });

  it('erro que não é Error também é reportado', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(execaModule.execa).mockRejectedValueOnce('falhou');

    await cmd.execute();

    expect(errorSpy).toHaveBeenCalledWith(expect.anything(), 'falhou');
  });
});

describe('parsePs', () => {
  it('ignora linhas inválidas e converte KB em MB', () => {
    expect(parsePs('lixo\n  1 1024 init\n\n')).toEqual([{ mb: 1, name: 'init', pid: 1 }]);
  });
});
