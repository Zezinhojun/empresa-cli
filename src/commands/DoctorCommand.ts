import chalk from 'chalk';

import type { Runtime as CliRuntime } from '../cli/runtime.js';
import type { Command } from '../core/command/Command.js';
import type { Runtime } from '../runner/interpreters.js';

import pkg from '../../package.json' with { type: 'json' };
import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { installHelp, RUNTIME_LABEL } from '../runner/hints.js';
import { findInterpreter } from '../runner/interpreters.js';

export interface DoctorCheck {
  /** Instruções de instalação, só quando falta ou está fora da versão suportada. */
  install?: string;
  label: string;
  ok: boolean;
  path?: string;
  runtime: Runtime;
  /** Que tipo de script depende dele. */
  usedFor: string;
  version?: string;
}

export interface DoctorData {
  checks: DoctorCheck[];
  /** `true` se nada está faltando. */
  ok: boolean;
  platform: NodeJS.Platform;
}

const USED_FOR: Record<Runtime, string> = {
  bash: 'scripts .sh',
  node: 'a própria mycli e scripts .js',
  python: 'scripts .py',
};

/** Faixa de Node aceita, lida de `engines.node` (ex.: ">=20 <25"). */
function supportedNode(version: string): boolean {
  const match = /^>=(\d+)\s*<(\d+)$/.exec(pkg.engines.node);
  const major = Number(/^v?(\d+)/.exec(version)?.[1]);
  return match ? major >= Number(match[1]) && major < Number(match[2]) : true;
}

export class DoctorCommand implements Command {
  public readonly args = [];
  public readonly name = 'doctor';
  public readonly description =
    'Confere se este computador tem o necessário para rodar os scripts (Node, Bash, Python)';

  async execute(): Promise<DoctorData> {
    const platform = process.platform;
    const runtimes: Runtime[] = ['node', 'bash', 'python'];

    const checks = await Promise.all(
      runtimes.map(async (runtime): Promise<DoctorCheck> => {
        const found = await findInterpreter(runtime);
        const base = { label: RUNTIME_LABEL[runtime], runtime, usedFor: USED_FOR[runtime] };

        if (!found) return { ...base, install: installHelp(runtime, platform), ok: false };

        const ok = runtime !== 'node' || supportedNode(found.version);
        return {
          ...base,
          ...(!ok && {
            install: `Use o Node.js ${pkg.engines.node}. ${installHelp(runtime, platform)}`,
          }),
          ok,
          path: found.command,
          version: found.version,
        };
      }),
    );

    return { checks, ok: checks.every((c) => c.ok), platform };
  }

  format(data: DoctorData, runtime: CliRuntime) {
    const mark = (ok: boolean) => {
      if (runtime.plain) return ok ? '[ok]   ' : '[FALTA]';
      return ok ? chalk.green('✔') : chalk.red('✖');
    };

    const lines = data.checks.flatMap((check) => {
      const problem = check.version ? `versão ${check.version} não é suportada` : 'não encontrado';
      const status = check.ok
        ? `${check.version ?? ''} (${check.usedFor})`
        : `${problem} (${check.usedFor})`;
      const line = `${mark(check.ok)} ${chalk.bold(check.label)}  ${status}`;
      return check.install ? [line, `    Como resolver: ${check.install}`] : [line];
    });

    const missing = data.checks.filter((c) => !c.ok).length;
    const summary =
      missing === 0
        ? 'Tudo certo: este computador roda todos os tipos de script.'
        : `Falta${missing > 1 ? 'm' : ''} ${missing} ${missing > 1 ? 'itens' : 'item'}. Os comandos que dependem ${missing > 1 ? 'deles' : 'dele'} só funcionam depois da instalação.`;

    return ['Verificando este computador:\n', ...lines, '', summary].join('\n');
  }
}

CommandRegistry.getInstance().register(new DoctorCommand());
