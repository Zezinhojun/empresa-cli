import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Estabilidade do contrato para agentes (docs/cli-contract.md): o formato do catálogo `--json` não
 * muda sem querer e nenhuma combinação de argumentos quebra a regra "uma linha de JSON em stdout +
 * exit code da tabela". Se o formato mudar de propósito, atualize este arquivo E o doc.
 */
const DIST = resolve(import.meta.dirname, '../../dist/index.js');
/** Tabela de "Códigos de saída" do contrato. */
const EXIT_CODES = new Set([0, 1, 2, 3, 4, 130]);

let home: string;

function mycli(args: string[]) {
  const env: Record<string, string | undefined> = { ...process.env, HOME: home, USERPROFILE: home };
  for (const key of ['CI', 'NO_COLOR', 'FORCE_COLOR']) delete env[key];
  const r = spawnSync(process.execPath, [DIST, ...args], {
    encoding: 'utf8',
    env,
    input: '',
    timeout: 20_000,
  });
  return { status: r.status, stderr: r.stderr, stdout: r.stdout };
}

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), 'mycli-stability-'));
});
afterAll(() => rmSync(home, { force: true, recursive: true }));

describe('catálogo --json: formato estável', () => {
  it('cada comando nativo mantém nome, risco, tipo e argumentos', () => {
    const r = mycli(['list', '--json']);
    const { data, ok, schemaVersion } = JSON.parse(r.stdout) as {
      data: {
        commands: {
          args: { name: string; required: boolean }[];
          interactive: boolean;
          kind: string;
          name: string;
          requires: string[];
          risk: string;
        }[];
        version: string;
      };
      ok: boolean;
      schemaVersion: number;
    };

    expect({ ok, schemaVersion, status: r.status }).toEqual({
      ok: true,
      schemaVersion: 1,
      status: 0,
    });
    expect(data.version).toMatch(/^\d+\.\d+\.\d+/);
    // Só os nativos: scripts de mycli-scripts/ entram e saem sem quebrar este teste.
    const builtins = data.commands
      .filter((c) => c.kind === 'builtin')
      .map((c) => ({
        args: c.args.map((a) => ({ name: a.name, required: a.required })),
        interactive: c.interactive,
        name: c.name,
        requires: c.requires,
        risk: c.risk,
      }));

    expect(builtins).toEqual([
      { args: [], interactive: false, name: 'agent-guide', requires: [], risk: 'read' },
      { args: [], interactive: false, name: 'doctor', requires: [], risk: 'read' },
      { args: [], interactive: false, name: 'list', requires: [], risk: 'read' },
      {
        args: [{ name: 'subpasta', required: false }],
        interactive: false,
        name: 'list-files',
        requires: [],
        risk: 'read',
      },
      { args: [], interactive: true, name: 'menu', requires: [], risk: 'read' },
      { args: [], interactive: false, name: 'report', requires: [], risk: 'read' },
      { args: [], interactive: false, name: 'stats', requires: [], risk: 'read' },
      { args: [], interactive: false, name: 'top-memory', requires: [], risk: 'read' },
    ]);
  });

  it('toda entrada do catálogo tem exatamente os campos do contrato', () => {
    const { data } = JSON.parse(mycli(['list', '--json']).stdout) as {
      data: { commands: Record<string, unknown>[] };
    };

    for (const command of data.commands) {
      // `category` é opcional: só aparece em scripts que a declaram no manifesto.
      const fields = Object.keys(command).filter((key) => key !== 'category');
      expect(fields.sort()).toEqual(
        ['args', 'description', 'interactive', 'kind', 'name', 'requires', 'risk', 'usage'].sort(),
      );
      expect(['read', 'write', 'destructive']).toContain(command.risk);
    }
  });
});

describe('fuzz leve do parser de flags', () => {
  const TOKENS = [
    'list-files',
    'list',
    'doctor',
    'agent-guide',
    'top-memory',
    'menu',
    'nao-existe',
    '--json',
    '--plain',
    '--help',
    '--version',
    '--yes',
    '-y',
    '--no-input',
    '--verbose',
    '--dry-run',
    '--',
    '-',
    '---',
    '--=',
    '--json=false',
    '--bogus',
    '-x',
    '-',
    '',
    ' ',
    '../..',
    '../../etc',
    'a'.repeat(300),
    'ação',
    '日本語',
    '$(echo x)',
    '`x`',
    ';',
    '&&',
    '|',
    '%PATH%',
    '*',
    '\n',
  ];

  /** Gerador determinístico (mesma sequência em todo run, para reproduzir falhas). */
  const rng = (seed: number) => () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  };
  const random = rng(20_261_014);
  const cases = Array.from({ length: 30 }, () =>
    Array.from(
      { length: 1 + Math.floor(random() * 4) },
      () => TOKENS[Math.floor(random() * TOKENS.length)] ?? '',
    ),
  );

  it.each(cases.map((args) => [JSON.stringify(args), args] as const))(
    'com --json, %s: exit da tabela e UMA linha de JSON válido',
    (_nome, args) => {
      const r = mycli(['--json', ...args]);

      expect(EXIT_CODES.has(r.status ?? -1), `exit ${r.status} fora da tabela`).toBe(true);
      expect(r.stderr, 'stderr deve ficar vazio no modo --json').toBe('');
      expect(r.stdout.trim().split('\n'), 'stdout deve ter exatamente uma linha').toHaveLength(1);
      const body = JSON.parse(r.stdout) as { ok: boolean; schemaVersion: number };
      expect(typeof body.ok).toBe('boolean');
      expect(body.schemaVersion).toBe(1);
      expect(body.ok).toBe(r.status === 0);
    },
  );
});
