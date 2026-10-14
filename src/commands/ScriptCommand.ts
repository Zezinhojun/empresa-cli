import path from 'node:path';

import type { Command, CommandArg } from '../core/command/Command.js';
import type { AuditOutcome } from '../runner/audit.js';
import type { Manifest } from '../runner/manifest.js';

import pkg from '../../package.json' with { type: 'json' };
import { confirmAction } from '../cli/confirm.js';
import { CliError, ExitCode } from '../cli/errors.js';
import { getRuntime } from '../cli/runtime.js';
import { newEntry, writeAudit } from '../runner/audit.js';
import { buildScriptEnv } from '../runner/env.js';
import { runScript, type ScriptRun } from '../runner/runScript.js';
import { verifyDirectory } from '../runner/scriptIndex.js';
import { which } from '../runner/which.js';

const SYSTEM_NAME: Record<string, string> = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' };

export interface ScriptResult {
  command?: string[];
  dryRun: boolean;
  durationMs: number;
  exitCode: number | null;
  runtime: ScriptRun['runtime'];
  script: string;
  stderr?: string;
  stdout?: string;
}

/** Como cada erro conhecido aparece no log de auditoria. */
const OUTCOME_BY_CODE: Record<string, AuditOutcome> = {
  CANCELLED: 'cancelled',
  CONFIRMATION_REQUIRED: 'denied',
  INTEGRITY_ERROR: 'blocked',
  MISSING_REQUIREMENT: 'blocked',
  MISSING_RUNTIME: 'blocked',
  SCRIPT_FAILED: 'failed',
  SCRIPT_TIMEOUT: 'timeout',
  UNSUPPORTED_OS: 'blocked',
};

/** Um script de `vox-scripts/` exposto como comando da CLI (menu, --help, vox list --json). */
export class ScriptCommand implements Command {
  public readonly args: CommandArg[];
  public readonly category?: string;
  public readonly description: string;
  public readonly kind = 'script' as const;
  public readonly name: string;
  public readonly requires: string[];
  public readonly risk: Manifest['risk'];

  constructor(
    private readonly manifest: Manifest,
    /** Pasta onde o script e seus arquivos de apoio estão instalados. */
    private readonly dir: string,
    /** SHA-256 esperado de cada arquivo da pasta (do índice gerado no build). */
    private readonly files: Record<string, string>,
  ) {
    this.args = manifest.args.map(({ description, name, required }) => ({
      description,
      name,
      required,
    }));
    if (manifest.category) this.category = manifest.category;
    this.description = manifest.description;
    this.name = manifest.name;
    this.requires = manifest.requires;
    this.risk = manifest.risk;
  }

  /** Toda tentativa (inclusive as negadas e bloqueadas) fica no log de auditoria local. */
  async execute(args: string[] = []): Promise<ScriptResult> {
    const started = Date.now();
    const runtime = getRuntime();
    const record = (
      outcome: AuditOutcome,
      extra: { errorCode?: string; exitCode: number | null; scriptRuntime?: string },
    ) =>
      writeAudit(
        newEntry({
          args,
          durationMs: Date.now() - started,
          ...(extra.errorCode && { errorCode: extra.errorCode }),
          exitCode: extra.exitCode,
          interactive: runtime.interactive,
          outcome,
          risk: this.risk,
          ...(extra.scriptRuntime && { runtime: extra.scriptRuntime }),
          script: this.name,
          version: pkg.version,
          yes: runtime.yes,
        }),
      );

    try {
      const result = await this.run(args);
      record(result.dryRun ? 'dry-run' : 'ok', {
        exitCode: result.exitCode,
        scriptRuntime: result.runtime,
      });
      return result;
    } catch (error) {
      const code = error instanceof CliError ? error.code : 'ERROR';
      const details = error instanceof CliError ? error.details : undefined;
      const exitCode =
        typeof (details as { exitCode?: unknown } | undefined)?.exitCode === 'number'
          ? (details as { exitCode: number }).exitCode
          : null;
      record(OUTCOME_BY_CODE[code] ?? 'error', { errorCode: code, exitCode });
      throw error;
    }
  }

  /** Em modo humano o script já escreveu a própria saída; só o --dry-run precisa de texto. */
  format(data: ScriptResult) {
    return data.dryRun && data.command ? `Executaria: ${data.command.join(' ')}` : '';
  }

  private async run(args: string[]): Promise<ScriptResult> {
    const { dryRun, interactive, json, yes } = getRuntime();
    const { entry, name, os, requires, risk, timeoutSec } = this.manifest;

    // 0) Os arquivos instalados são exatamente os que foram revisados e empacotados?
    //    Roda ANTES de qualquer outra coisa: um script alterado não é nem inspecionado.
    const integrity = verifyDirectory(this.dir, this.files);
    if (!integrity.ok) {
      const { changed, extra, missing, symlinks } = integrity;
      throw new CliError(
        `Os arquivos do comando '${name}' foram alterados depois da instalação e ele não foi executado.`,
        ExitCode.error,
        'INTEGRITY_ERROR',
        'Reinstale a vox para restaurar os arquivos originais: npm install -g cli-vox',
        { changed, extra, missing, symlinks },
      );
    }

    // 1) Compatível com este sistema?
    if (os.length > 0 && !os.includes(process.platform)) {
      throw new CliError(
        `O comando '${name}' não funciona no ${SYSTEM_NAME[process.platform] ?? process.platform}.`,
        ExitCode.missingDependency,
        'UNSUPPORTED_OS',
        `Ele funciona em: ${os.map((system) => SYSTEM_NAME[system] ?? system).join(', ')}.`,
        { os, platform: process.platform },
      );
    }

    // 2) Tem o que o script usa (docker, git…)?
    const missing = requires.filter((executable) => !which(executable));
    if (missing.length > 0) {
      throw new CliError(
        `O comando '${name}' precisa d${missing.length > 1 ? 'os programas' : 'o programa'} ${missing.join(', ')}, que não ${missing.length > 1 ? 'estão instalados' : 'está instalado'} neste computador.`,
        ExitCode.missingDependency,
        'MISSING_REQUIREMENT',
        `Instale ${missing.join(' e ')} e abra um novo terminal.`,
        { missing },
      );
    }

    // 3) Quem altera algo pede confirmação (agentes precisam passar --yes; senão, código 4).
    // Em --dry-run nada é executado, então não há o que confirmar.
    if (risk !== 'read' && !dryRun) {
      const warning =
        risk === 'destructive'
          ? `'${name}' pode APAGAR ou sobrescrever dados. Continuar?`
          : `'${name}' vai alterar coisas neste computador. Continuar?`;
      if (!(await confirmAction(warning))) {
        throw new CliError('Operação cancelada.', ExitCode.error, 'CANCELLED');
      }
    }

    const run = await runScript({
      args,
      capture: json,
      cwd: process.cwd(),
      dryRun,
      entry: path.join(this.dir, entry),
      env: buildScriptEnv(process.env, {
        VOX_JSON: json ? '1' : '0',
        VOX_NO_INPUT: interactive ? '0' : '1',
        VOX_SCRIPT_DIR: this.dir,
        VOX_VERSION: pkg.version,
        VOX_YES: yes ? '1' : '0',
      }),
      interactive,
      name,
      timeoutSec,
    });

    return {
      dryRun: run.dryRun,
      durationMs: run.durationMs,
      exitCode: run.exitCode,
      runtime: run.runtime,
      script: name,
      ...(run.dryRun && { command: run.command }),
      ...(run.stdout !== undefined && { stdout: run.stdout }),
      ...(run.stderr !== undefined && { stderr: run.stderr }),
    };
  }
}
