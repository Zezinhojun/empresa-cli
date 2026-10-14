import chalk from 'chalk';
import { execa } from 'execa';

import type { Command } from '../core/command/Command.js';

import { CommandRegistry } from '../core/command/CommandRegistry.js';

const TOP = 10;

interface Proc {
  mb: number;
  name: string;
  pid: number;
}

/** Parse da saída de `ps -axo pid=,rss=,comm=` (igual em Linux e macOS). */
export function parsePs(stdout: string): Proc[] {
  return stdout
    .split('\n')
    .map((line) => /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(([, pid = '0', rssKb = '0', name = '']) => ({
      mb: Number(rssKb) / 1024,
      name,
      pid: Number(pid),
    }));
}

export class TopMemoryCommand implements Command {
  public readonly args = [];
  public readonly name = 'top-memory';
  public readonly description = `Lista os ${TOP} processos que mais consomem memória`;

  async execute() {
    console.log(chalk.cyan(`Top ${TOP} processos por uso de memória:\n`));

    try {
      console.log(await this.getTopProcesses());
    } catch (error) {
      console.error(
        chalk.red('Erro ao listar processos:'),
        error instanceof Error ? error.message : error,
      );
      process.exitCode = 1;
    }
  }

  private async getTopProcesses(): Promise<string> {
    if (process.platform === 'win32') {
      const { stdout } = await execa('powershell', [
        '-NoProfile',
        '-Command',
        `Get-Process | Sort-Object WS -Descending | Select-Object -First ${TOP} Name, Id, WS`,
      ]);
      return stdout;
    }

    // `ps --sort` não existe no macOS (BSD): ordena em JS para funcionar nos dois.
    const { stdout } = await execa('ps', ['-axo', 'pid=,rss=,comm=']);
    const rows = parsePs(stdout)
      .sort((a, b) => b.mb - a.mb)
      .slice(0, TOP)
      .map((p) => `${String(p.pid).padStart(7)}  ${p.mb.toFixed(1).padStart(9)} MB  ${p.name}`);
    return [`${'PID'.padStart(7)}  ${'MEMÓRIA'.padStart(12)}  PROCESSO`, ...rows].join('\n');
  }
}

CommandRegistry.getInstance().register(new TopMemoryCommand());
