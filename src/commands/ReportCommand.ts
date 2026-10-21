import { execa } from 'execa';

import type { Command } from '../core/command/Command.js';

import pkg from '../../package.json' with { type: 'json' };
import { confirmAction } from '../cli/confirm.js';
import { getRuntime } from '../cli/runtime.js';
import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { readEntries, summarize } from '../runner/stats.js';

export const REPORT_MARKER = '<!-- vox-report -->';

export interface ReportData {
  body: string;
  opened: boolean;
  url: string;
}

/** Como abrir um link no navegador em cada sistema (sem shell: o `&` da URL chega intacto). */
const OPENERS: Record<string, [string, string[]]> = {
  darwin: ['open', []],
  win32: ['rundll32', ['url.dll,FileProtocolHandler']],
};

/** Monta um relatório SEM dados pessoais como issue do GitHub já preenchida; quem envia é a pessoa. */
export class ReportCommand implements Command {
  public readonly args = [];
  public readonly description =
    'Prepara um relatório de uso e erros (sem dados pessoais) para enviar ao time como issue';
  public readonly name = 'report';

  async execute(): Promise<ReportData> {
    const stats = summarize(readEntries());
    const body = [
      REPORT_MARKER,
      `Relatório gerado pela vox ${pkg.version}. Revise antes de enviar: só há nomes de scripts, códigos de erro, versões e sistemas.`,
      '',
      '```json',
      JSON.stringify(stats, null, 2),
      '```',
    ].join('\n');
    const query = new URLSearchParams({
      body,
      labels: 'relatorio-vox',
      title: `Relatório de uso da vox ${pkg.version}`,
    });
    const url = `${pkg.bugs.url}/new?${query.toString()}`;

    const { interactive, json } = getRuntime();
    let opened = false;
    if (
      stats.total > 0 &&
      interactive &&
      !json &&
      (await confirmAction('Abrir o relatório no navegador?'))
    ) {
      const [command, prefix] = OPENERS[process.platform] ?? ['xdg-open', []];
      opened = await execa(command, [...prefix, url]).then(
        () => true,
        () => false, // sem navegador: a pessoa abre o link impresso
      );
    }
    return { body, opened, url };
  }

  format(data: ReportData) {
    return [
      data.opened
        ? 'Abri o relatório no navegador. Confira o texto e clique em enviar.'
        : 'Relatório pronto:',
      '',
      data.body,
      ...(data.opened ? [] : ['', 'Abra este link para enviar ao time:', data.url]),
    ].join('\n');
  }
}

CommandRegistry.getInstance().register(new ReportCommand());
