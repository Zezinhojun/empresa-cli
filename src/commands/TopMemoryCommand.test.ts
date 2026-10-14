import * as execaModule from 'execa';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { parsePs, parseWindows, TopMemoryCommand } from './TopMemoryCommand.js';

vi.mock('execa');

const execaResult = (stdout: string) =>
  ({ stdout }) as unknown as Awaited<ReturnType<typeof execaModule.execa>>;
const originalPlatform = process.platform;
const setPlatform = (value: string) =>
  Object.defineProperty(process, 'platform', { configurable: true, value });

describe('TopMemoryCommand', () => {
  let cmd: TopMemoryCommand;

  beforeEach(() => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    CommandRegistry.getInstance();
    cmd = new TopMemoryCommand();
    vi.mocked(execaModule.execa).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setPlatform(originalPlatform);
  });

  it('tem nome e descrição corretos', () => {
    expect(cmd.name).toBe('top-memory');
    expect(cmd.description).toContain('memória');
  });

  it('Windows: PowerShell com ConvertTo-Json; devolve dados em MB', async () => {
    setPlatform('win32');
    const json = JSON.stringify([
      { Id: 1, Name: 'pequeno', WS: 10 * 1_048_576 },
      { Id: 2, Name: 'grande', WS: 400 * 1_048_576 },
    ]);
    vi.mocked(execaModule.execa).mockResolvedValueOnce(execaResult(json));

    const data = await cmd.execute();

    expect(execaModule.execa).toHaveBeenCalledWith('powershell', [
      '-NoProfile',
      '-Command',
      expect.stringContaining('ConvertTo-Json -Compress'),
    ]);
    expect(data.processes).toEqual([
      { memoryMb: 400, name: 'grande', pid: 2 },
      { memoryMb: 10, name: 'pequeno', pid: 1 },
    ]);
  });

  it('Windows com um único processo (PowerShell devolve objeto, não lista)', async () => {
    setPlatform('win32');
    vi.mocked(execaModule.execa).mockResolvedValueOnce(
      execaResult(JSON.stringify({ Id: 7, Name: 'so', WS: 1_048_576 })),
    );

    await expect(cmd.execute()).resolves.toEqual({
      processes: [{ memoryMb: 1, name: 'so', pid: 7 }],
    });
  });

  it.each(['linux', 'darwin'])('%s: ps portátil (sem --sort) ordenado em JS', async (platform) => {
    setPlatform(platform);
    vi.mocked(execaModule.execa).mockResolvedValueOnce(
      execaResult('  10   2048 small\n  20 409600 big proc\n  30  10240 mid'),
    );

    const data = await cmd.execute();

    expect(execaModule.execa).toHaveBeenCalledWith('ps', ['-axo', 'pid=,rss=,comm=']);
    expect(data.processes.map((p) => p.name)).toEqual(['big proc', 'mid', 'small']);
    expect(data.processes[0]).toEqual({ memoryMb: 400, name: 'big proc', pid: 20 });
  });

  it('limita a 10 processos', async () => {
    setPlatform('linux');
    const lines = Array.from({ length: 15 }, (_, i) => `${i + 1} ${(i + 1) * 100} p${i + 1}`).join(
      '\n',
    );
    vi.mocked(execaModule.execa).mockResolvedValueOnce(execaResult(lines));

    expect((await cmd.execute()).processes).toHaveLength(10);
  });

  it('falha do comando vira CliError COMMAND_FAILED (exit 1)', async () => {
    vi.mocked(execaModule.execa).mockRejectedValueOnce(new Error('Command failed'));

    await expect(cmd.execute()).rejects.toMatchObject({
      code: 'COMMAND_FAILED',
      exitCode: 1,
      message: expect.stringContaining('Command failed'),
    });
  });

  it('erro que não é Error também é reportado', async () => {
    vi.mocked(execaModule.execa).mockRejectedValueOnce('falhou');

    await expect(cmd.execute()).rejects.toMatchObject({
      message: expect.stringContaining('falhou'),
    });
  });

  it('format: tabela com cabeçalho e uma linha por processo', () => {
    const out = cmd.format({ processes: [{ memoryMb: 400, name: 'big', pid: 20 }] });

    expect(out).toContain('Top 10');
    expect(out).toContain('PID');
    expect(out).toContain('400.0 MB  big');
  });
});

describe('parsers', () => {
  it('parsePs ignora linhas inválidas e converte KB em MB', () => {
    expect(parsePs('lixo\n  1 1024 init\n\n')).toEqual([{ memoryMb: 1, name: 'init', pid: 1 }]);
  });

  it('parseWindows converte bytes em MB', () => {
    expect(parseWindows('{"Id":3,"Name":"x","WS":2097152}')).toEqual([
      { memoryMb: 2, name: 'x', pid: 3 },
    ]);
  });
});
