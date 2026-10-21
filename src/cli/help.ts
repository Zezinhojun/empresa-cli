import chalk from 'chalk';

import type { Command } from '../core/command/Command.js';
import type { CommandRegistry } from '../core/command/CommandRegistry.js';

import pkg from '../../package.json' with { type: 'json' };

const OPTIONS = `Opções globais (valem para qualquer comando):
  -h, --help      Mostra a ajuda (também: mycli <comando> --help)
  -v, --version   Mostra a versão
      --json      Saída em JSON (apenas dados em stdout)
      --plain     Sem cores nem emojis
      --no-input  Nunca pergunta nada (falha em vez de abrir prompt)
  -y, --yes       Confirma automaticamente as perguntas
      --confirm=<pasta>  Confirma script que apaga, sem terminal (junto com --yes)
      --dry-run   Mostra o que seria executado, sem executar (scripts)
      --verbose   Mostra detalhes técnicos dos erros
  --              Tudo depois é entregue literal ao comando`;

const EXIT_CODES = `Códigos de saída:
  0 sucesso · 1 erro · 2 uso inválido · 3 dependência ausente
  4 requer confirmação · 130 interrompido (Ctrl+C)`;

/** `mycli nome [opcional] <obrigatório>` */
export function usage(command: Command): string {
  const args = (command.args ?? []).map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`));
  return ['mycli', command.name, ...args].join(' ');
}

export function printHelp(registry: CommandRegistry) {
  console.log(`${chalk.bold('mycli')} ${pkg.version}\n`);
  console.log('Uso: mycli [comando] [argumentos] [opções]\n');
  console.log('Comandos:');
  for (const { description = '', name } of registry.list()) {
    console.log(`  ${chalk.cyan(name.padEnd(14))}${description}`);
  }
  console.log(`\n${OPTIONS}\n\n${EXIT_CODES}\n\nMais detalhes: mycli <comando> --help`);
}

export function printCommandHelp(command: Command) {
  console.log(`${chalk.bold(usage(command))}\n`);
  if (command.description) console.log(`${command.description}\n`);
  if (command.args?.length) {
    console.log('Argumentos:');
    for (const arg of command.args) {
      console.log(`  ${arg.name.padEnd(14)}${arg.description}${arg.required ? '' : ' (opcional)'}`);
    }
    console.log();
  }
  console.log(`${OPTIONS}\n\n${EXIT_CODES}`);
}
