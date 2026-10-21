import type { Command } from '../core/command/Command.js';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { readEntries, type Stats, summarize } from '../runner/stats.js';

/** Quais scripts este computador mais usa e onde mais falham (lê `~/.vox/audit.log`). */
export class StatsCommand implements Command {
  public readonly args = [];
  public readonly description =
    'Mostra os scripts mais usados e os erros mais comuns deste computador';
  public readonly name = 'stats';

  execute(): Stats {
    return summarize(readEntries());
  }

  format(data: Stats) {
    if (data.total === 0) return 'Ainda não há execuções de scripts registradas neste computador.';

    const pad = (n: number) => String(n).padStart(4);
    const scripts = data.scripts.map(
      (s) => `  ${pad(s.runs)}  ${s.script}  (${s.failures} com falha)`,
    );
    const errors = data.errors.map((e) => `  ${pad(e.count)}  ${e.script}  ${e.errorCode}`);

    return [
      `${data.total} execuções registradas.\n`,
      'Scripts mais usados:',
      ...scripts,
      ...(errors.length > 0 ? ['', 'Erros mais comuns:', ...errors] : []),
      '',
      'Para reportar ao time, sem dados pessoais: vox report',
    ].join('\n');
  }
}

CommandRegistry.getInstance().register(new StatsCommand());
