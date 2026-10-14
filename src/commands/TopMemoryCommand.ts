import chalk from 'chalk';
import { execa } from 'execa';

import type { Command } from '../core/command/Command.js';

import { CliError, ExitCode } from '../cli/errors.js';
import { CommandRegistry } from '../core/command/CommandRegistry.js';

const TOP = 10;

export interface ProcessInfo {
  memoryMb: number;
  name: string;
  pid: number;
}

export interface TopMemoryData {
  processes: ProcessInfo[];
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Saída de `ps -axo pid=,rss=,comm=` (igual em Linux e macOS; rss em KB). */
export function parsePs(stdout: string): ProcessInfo[] {
  return stdout
    .split('\n')
    .map((line) => /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(([, pid = '0', rssKb = '0', name = '']) => ({
      memoryMb: Number(rssKb) / 1024,
      name,
      pid: Number(pid),
    }));
}

/** Saída de `ConvertTo-Json` do PowerShell (um objeto quando há só um processo; WS em bytes). */
export function parseWindows(stdout: string): ProcessInfo[] {
  const parsed = JSON.parse(stdout) as WindowsProcess | WindowsProcess[];
  return [parsed].flat().map((p) => ({ memoryMb: p.WS / 1_048_576, name: p.Name, pid: p.Id }));
}

interface WindowsProcess {
  Id: number;
  Name: string;
  WS: number;
}

export class TopMemoryCommand implements Command {
  public readonly args = [];
  public readonly name = 'top-memory';
  public readonly description = `Lista os ${TOP} processos que mais consomem memória`;

  async execute(): Promise<TopMemoryData> {
    let processes: ProcessInfo[];
    try {
      processes = await this.readProcesses();
    } catch (error) {
      throw new CliError(
        `Não foi possível listar os processos: ${error instanceof Error ? error.message : String(error)}`,
        ExitCode.error,
        'COMMAND_FAILED',
      );
    }

    return {
      processes: processes
        .sort((a, b) => b.memoryMb - a.memoryMb)
        .slice(0, TOP)
        .map((p) => ({ ...p, memoryMb: round(p.memoryMb) })),
    };
  }

  format(data: TopMemoryData) {
    const rows = data.processes.map(
      (p) => `${String(p.pid).padStart(7)}  ${p.memoryMb.toFixed(1).padStart(9)} MB  ${p.name}`,
    );
    return [
      chalk.cyan(`Top ${TOP} processos por uso de memória:\n`),
      `${'PID'.padStart(7)}  ${'MEMÓRIA'.padStart(12)}  PROCESSO`,
      ...rows,
    ].join('\n');
  }

  private async readProcesses(): Promise<ProcessInfo[]> {
    if (process.platform === 'win32') {
      const { stdout } = await execa('powershell', [
        '-NoProfile',
        '-Command',
        `Get-Process | Sort-Object WS -Descending | Select-Object -First ${TOP} Name, Id, WS | ConvertTo-Json -Compress`,
      ]);
      return parseWindows(stdout);
    }

    // `ps --sort` não existe no macOS (BSD): lê tudo e ordena em JS para funcionar nos dois.
    const { stdout } = await execa('ps', ['-axo', 'pid=,rss=,comm=']);
    return parsePs(stdout);
  }
}

CommandRegistry.getInstance().register(new TopMemoryCommand());
